package com.smartcourier.utils

import android.view.accessibility.AccessibilityNodeInfo

/**
 * Helpers for traversing and acting on AccessibilityNodeInfo trees.
 *
 * AccessibilityNodeInfo is notoriously fiddly: nodes can be stale, the clickable
 * element is often an ancestor of the text node, and findByViewId returns empty
 * unless flagReportViewIds is set. These helpers centralise the workarounds.
 */
object AccessibilityUtils {

    /** Collect all text/contentDescription on a node and its descendants. */
    fun collectText(node: AccessibilityNodeInfo?): String {
        if (node == null) return ""
        val sb = StringBuilder()
        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null) return
            n.text?.let { if (it.isNotBlank()) sb.append(it).append(' ') }
            n.contentDescription?.let { if (it.isNotBlank()) sb.append(it).append(' ') }
            for (i in 0 until n.childCount) {
                walk(n.getChild(i))
            }
        }
        walk(node)
        return sb.toString().trim()
    }

    /**
     * Find the first node matching any of [texts] (case-insensitive contains).
     * Caller owns recycling of the returned node on older APIs.
     */
    fun findByAnyText(
        root: AccessibilityNodeInfo?,
        texts: List<String>,
    ): AccessibilityNodeInfo? {
        if (root == null) return null
        for (t in texts) {
            val matches = root.findAccessibilityNodeInfosByText(t) ?: continue
            val hit = matches.firstOrNull()
            if (hit != null) return hit
        }
        return null
    }

    /**
     * Walk the tree for the first CLICKABLE node whose text or content-desc
     * contains any of [texts] (case-insensitive). Used to target action buttons
     * like "ADD RUN" while skipping non-clickable decoys (e.g. the "Add Run?"
     * header).
     */
    fun findClickableByAnyText(
        root: AccessibilityNodeInfo?,
        texts: List<String>,
    ): AccessibilityNodeInfo? {
        if (root == null) return null
        val needles = texts.map { it.lowercase() }
        var result: AccessibilityNodeInfo? = null
        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null || result != null) return
            if (n.isClickable) {
                val hay = ((n.text?.toString() ?: "") + " " +
                    (n.contentDescription?.toString() ?: "")).lowercase()
                if (needles.any { hay.contains(it) }) {
                    result = n
                    return
                }
            }
            for (i in 0 until n.childCount) walk(n.getChild(i))
        }
        walk(root)
        return result
    }

    /** Find the first node by view id, or null if id is blank / not found. */
    fun findByViewId(
        root: AccessibilityNodeInfo?,
        viewId: String,
    ): AccessibilityNodeInfo? {
        if (root == null || viewId.isBlank()) return null
        return root.findAccessibilityNodeInfosByViewId(viewId)?.firstOrNull()
    }

    /** Try viewId first, then fall back to text. */
    fun find(
        root: AccessibilityNodeInfo?,
        viewId: String,
        texts: List<String>,
    ): AccessibilityNodeInfo? =
        findByViewId(root, viewId) ?: findByAnyText(root, texts)

    /**
     * Walk up from a node to the nearest clickable ancestor (the text label is
     * usually not the clickable element) and perform a click.
     */
    fun clickSelfOrAncestor(node: AccessibilityNodeInfo?): Boolean {
        var current: AccessibilityNodeInfo? = node
        var hops = 0
        while (current != null && hops < 8) {
            if (current.isClickable && current.isEnabled) {
                return current.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            current = current.parent
            hops++
        }
        return false
    }

    /** Attempt to refresh a scrollable list via ACTION_SCROLL_FORWARD. */
    fun scrollForward(node: AccessibilityNodeInfo?): Boolean {
        var current: AccessibilityNodeInfo? = node
        var hops = 0
        while (current != null && hops < 8) {
            if (current.isScrollable) {
                return current.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            }
            current = current.parent
            hops++
        }
        return false
    }
}
