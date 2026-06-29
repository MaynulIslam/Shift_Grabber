package com.smartcourier.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.smartcourier.config.SkipSelectors
import com.smartcourier.core.ShiftGrabber
import com.smartcourier.model.ParsedShift
import com.smartcourier.model.ShiftPreferences
import com.smartcourier.utils.AccessibilityUtils
import com.smartcourier.utils.NodeParser

/**
 * SkipAccessibilityService — reads the Skip courier UI and taps shift cards.
 *
 * The system owns this instance's lifecycle, so we publish the live instance to
 * [ShiftGrabber] on connect and the ForegroundService drives [runCycle] on its
 * refresh loop. This service does not own any timing itself.
 */
class SkipAccessibilityService : AccessibilityService() {

    private val claimedIds = mutableSetOf<String>()

    override fun onServiceConnected() {
        super.onServiceConnected()
        ShiftGrabber.accessibilityService = this
        ShiftGrabber.log("info", "Accessibility service connected")
        Log.i(TAG, "connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We poll on the ForegroundService loop rather than react to every event
        // (content-changed fires constantly). Events are used only as a hint
        // that the page may have updated; the loop does the real work.
    }

    override fun onInterrupt() {
        Log.w(TAG, "interrupted")
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        if (ShiftGrabber.accessibilityService === this) {
            ShiftGrabber.accessibilityService = null
        }
        ShiftGrabber.log("warning", "Accessibility service disconnected")
        return super.onUnbind(intent)
    }

    /** Package name of the current foreground window, as the service sees it. */
    fun currentForegroundPackage(): String? =
        rootInActiveWindow?.packageName?.toString()

    // -- Driven by ForegroundService -----------------------------------------

    /**
     * One monitoring cycle: ensure we're on the Open Shifts page, scan cards,
     * claim any that match. Returns true if a shift was claimed this cycle.
     */
    fun runCycle(prefs: ShiftPreferences): Boolean {
        val root = rootInActiveWindow ?: run {
            ShiftGrabber.log("info", "No active window yet")
            return false
        }

        // Are we even in Skip?
        if (root.packageName?.toString() != SkipSelectors.PACKAGE) {
            ShiftGrabber.log("info", "Skip not in foreground (saw ${root.packageName})")
            return false
        }

        // Always capture the current screen (the list OR an opened run detail).
        if (SkipSelectors.DEBUG_DUMP_TREE) {
            dumpTreeToLog(root)
        }

        // RECOVERY: if Skip is showing an error popup (e.g. "This run is already
        // taken." after we lost the race), dismiss it — tap OK, else press Back
        // — so we don't get stuck on it and can resume scanning Open Runs.
        if (AccessibilityUtils.findByAnyText(root, SkipSelectors.Texts.ERROR_TEXTS) != null) {
            val ok = AccessibilityUtils.findClickableByAnyText(
                root, SkipSelectors.Texts.DISMISS_BUTTON,
            )
            val dismissed = ok != null && AccessibilityUtils.clickSelfOrAncestor(ok)
            if (!dismissed) {
                performGlobalAction(GLOBAL_ACTION_BACK)
            }
            ShiftGrabber.log("warning", "Lost it — dismissed error, back to Open Runs")
            return false
        }

        // If a run's "Add Run?" confirm screen is up, finish the grab by tapping
        // its ADD RUN button. Done before any navigation so we never leave a
        // confirm screen without completing it.
        if (prefs.autoGrab) {
            val confirm = AccessibilityUtils.findClickableByAnyText(
                root, SkipSelectors.Texts.CONFIRM_BUTTON,
            )
            if (confirm != null) {
                if (AccessibilityUtils.clickSelfOrAncestor(confirm)) {
                    val target = NodeParser.parse(AccessibilityUtils.collectText(root))
                    ShiftGrabber.log("action", "Tapped ADD RUN — checking result…")
                    // The grab resolves on Skip's server a beat later. Read the
                    // screen shortly after to report win vs. lost-the-race.
                    android.os.Handler(mainLooper).postDelayed({
                        // Only celebrate on Skip's explicit success text. A loss
                        // ("already taken") is detected + dismissed by the main
                        // loop's error recovery, so we don't handle it here.
                        val after = AccessibilityUtils
                            .collectText(rootInActiveWindow).lowercase()
                        if (after.contains("added to schedule") ||
                            after.contains("run added")
                        ) {
                            ShiftGrabber.reportShiftClaimed(target)
                            ShiftGrabber.log("success", "✅ Grabbed: ${target.rawText.take(40)}")
                        }
                    }, 900)
                    return true
                }
                ShiftGrabber.log("warning", "Found ADD RUN but the tap failed")
            }
        }

        // Only navigate to the Open Runs tab if we DON'T already see the list.
        // Re-tapping the tab every cycle forces a full reload — disruptive, a
        // likely cause of Skip's network errors, and it can reload a run out
        // from under us. If a run or the empty-state is already on screen, act
        // on it directly without re-navigating.
        val emptyHere = AccessibilityUtils.findByAnyText(root, SkipSelectors.Texts.EMPTY_STATE) != null
        var shifts = if (emptyHere) emptyList() else scanShifts(root)

        if (!emptyHere && shifts.isEmpty()) {
            // Not on the Open Runs list — navigate there, then re-scan.
            ensureOnOpenShifts(root)
            val current = rootInActiveWindow ?: return false
            if (AccessibilityUtils.findByAnyText(current, SkipSelectors.Texts.EMPTY_STATE) != null) {
                ShiftGrabber.log("info", "Page loaded, no shifts available")
                maybeRefresh()
                return false
            }
            shifts = scanShifts(current)
        }

        if (shifts.isEmpty()) {
            ShiftGrabber.log(
                "info",
                if (emptyHere) "Page loaded, no shifts available" else "No shift cards found this scan",
            )
            maybeRefresh()
            return false
        }

        for ((card, shift) in shifts) {
            if (shift.id in claimedIds) continue
            ShiftGrabber.reportShiftFound(shift)
            if (!NodeParser.matches(shift, prefs)) continue

            ShiftGrabber.log("action", "Match: ${shift.rawText.take(60)}")
            if (!prefs.autoGrab) {
                ShiftGrabber.log("info", "Auto-grab off — notify only")
                continue
            }
            // Tap the run card to open its "Add Run?" detail screen. The next
            // cycle detects that screen's ADD RUN button and taps it to complete
            // the grab.
            if (claim(card)) {
                ShiftGrabber.log(
                    "action",
                    "Opened run: ${shift.rawText.take(48)} — confirming…",
                )
                return true
            } else {
                ShiftGrabber.log("warning", "Tap failed for ${shift.id}")
            }
        }
        // Nothing actioned this cycle — refresh to pull new runs next tick.
        maybeRefresh()
        return false
    }

    private var lastRefreshMs = 0L

    /**
     * Throttle the refresh swipe to the user's refresh interval (the scan loop
     * itself runs much faster; this only governs how often we re-query Skip for
     * new runs). Only fires during empty stretches, never while a run is up.
     */
    private fun maybeRefresh() {
        val gapMs = (ShiftGrabber.preferences?.refreshIntervalSec ?: 3) * 1000L
        val now = System.currentTimeMillis()
        if (now - lastRefreshMs >= gapMs) {
            lastRefreshMs = now
            refresh()
        }
    }

    /**
     * Get to the Open Runs page. Two hops: if the Open Runs tab is visible, tap
     * it; otherwise tap the "Scheduling" bottom-nav entry and let the next cycle
     * find the Open Runs tab (Skip nests Open Runs under Scheduling).
     */
    private fun ensureOnOpenShifts(root: AccessibilityNodeInfo) {
        val tab = AccessibilityUtils.find(
            root,
            SkipSelectors.ViewIds.OPEN_SHIFTS_TAB,
            SkipSelectors.Texts.OPEN_SHIFTS_TAB,
        )
        if (tab != null) {
            if (AccessibilityUtils.clickSelfOrAncestor(tab)) {
                ShiftGrabber.log("info", "Navigated to Open Runs")
            }
            return
        }

        // Open Runs not visible — try to reach the Scheduling section first.
        val scheduling = AccessibilityUtils.findByAnyText(root, SkipSelectors.Texts.SCHEDULING_NAV)
        if (scheduling != null) {
            if (AccessibilityUtils.clickSelfOrAncestor(scheduling)) {
                ShiftGrabber.log("info", "Opened Scheduling (heading to Open Runs)")
            }
        }
    }

    /**
     * Find run cards and associate each with its day. CONFIRMED structure: a run
     * is a clickable node whose content-desc looks like "5:00 AM - 8:30 AM,
     * Sudbury"; the runs are grouped under day-name headers ("Tuesday June 30").
     * We collect both in one tree walk, then attach each card to the nearest day
     * header above it (by screen Y) so per-day windows can be enforced.
     */
    private fun scanShifts(root: AccessibilityNodeInfo): List<Pair<AccessibilityNodeInfo, ParsedShift>> {
        val headers = mutableListOf<Pair<Int, String>>() // (topY, "Mon".."Sun")
        val cards = mutableListOf<Triple<AccessibilityNodeInfo, Int, String>>() // node, topY, desc

        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null) return
            val text = n.text?.toString()?.lowercase(java.util.Locale.US).orEmpty()
            if (text.isNotBlank()) {
                val abbrev = DAY_NAME_TO_ABBREV.entries.firstOrNull { text.contains(it.key) }?.value
                if (abbrev != null) {
                    headers.add(boundsTop(n) to abbrev)
                }
            }
            val desc = n.contentDescription?.toString().orEmpty()
            if (n.isClickable && RUN_TIME_PATTERN.containsMatchIn(desc)) {
                cards.add(Triple(n, boundsTop(n), desc))
            }
            for (i in 0 until n.childCount) {
                walk(n.getChild(i))
            }
        }
        walk(root)

        val seen = mutableSetOf<String>()
        val results = mutableListOf<Pair<AccessibilityNodeInfo, ParsedShift>>()
        for ((node, topY, desc) in cards) {
            if (!seen.add(desc)) continue
            val day = headers.filter { it.first <= topY }.maxByOrNull { it.first }?.second
            results.add(node to NodeParser.parse(desc, day))
        }
        return results
    }

    private fun boundsTop(n: AccessibilityNodeInfo): Int =
        android.graphics.Rect().also { n.getBoundsInScreen(it) }.top

    /** Tap the claim button within a card (or fall back to clicking the card). */
    private fun claim(card: AccessibilityNodeInfo): Boolean {
        val button = AccessibilityUtils.find(
            card,
            SkipSelectors.ViewIds.CLAIM_BUTTON,
            SkipSelectors.Texts.CLAIM_BUTTON,
        )
        return if (button != null) {
            AccessibilityUtils.clickSelfOrAncestor(button)
        } else {
            AccessibilityUtils.clickSelfOrAncestor(card)
        }
    }

    /** Refresh the list — scroll action, or a swipe gesture fallback. */
    fun refresh() {
        val root = rootInActiveWindow ?: return
        if (!SkipSelectors.Refresh.USE_GESTURE_SWIPE) {
            val list = AccessibilityUtils.findByViewId(root, SkipSelectors.ViewIds.SHIFT_LIST)
            if (AccessibilityUtils.scrollForward(list ?: root)) {
                ShiftGrabber.log("info", "Refreshed via scroll")
                return
            }
        }
        swipeRefresh()
    }

    /** Pull-to-refresh via a synthesized downward swipe gesture. */
    private fun swipeRefresh() {
        val metrics = resources.displayMetrics
        val x = metrics.widthPixels / 2f
        val startY = metrics.heightPixels * SkipSelectors.Refresh.SWIPE_START_Y_FRACTION
        val endY = metrics.heightPixels * SkipSelectors.Refresh.SWIPE_END_Y_FRACTION
        val path = Path().apply {
            moveTo(x, startY)
            lineTo(x, endY)
        }
        val stroke = GestureDescription.StrokeDescription(
            path, 0, SkipSelectors.Refresh.SWIPE_DURATION_MS,
        )
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(g: GestureDescription?) {
                ShiftGrabber.log("info", "Refreshed via swipe")
            }
        }, null)
    }

    /**
     * Log every node with text/desc/id/clickable to logcat (tag SKIPDUMP), with
     * indentation for tree depth. Read back with: adb logcat -s SKIPDUMP
     */
    private fun dumpTreeToLog(root: AccessibilityNodeInfo?) {
        Log.i(TAG_DUMP, "===== SKIP TREE DUMP START =====")
        fun walk(n: AccessibilityNodeInfo?, depth: Int) {
            if (n == null) return
            val txt = n.text?.toString().orEmpty()
            val desc = n.contentDescription?.toString().orEmpty()
            val id = n.viewIdResourceName.orEmpty()
            if (txt.isNotBlank() || desc.isNotBlank() || id.isNotBlank() || n.isClickable) {
                val cls = n.className?.toString()?.substringAfterLast('.').orEmpty()
                val bounds = android.graphics.Rect().also { n.getBoundsInScreen(it) }
                val indent = "  ".repeat(depth)
                Log.i(
                    TAG_DUMP,
                    "$indent<$cls> id=[$id] text=\"$txt\" desc=\"$desc\" " +
                        "click=${n.isClickable} bounds=$bounds",
                )
            }
            for (i in 0 until n.childCount) walk(n.getChild(i), depth + 1)
        }
        walk(root, 0)
        Log.i(TAG_DUMP, "===== SKIP TREE DUMP END =====")
    }

    companion object {
        private const val TAG = "SkipA11yService"
        private const val TAG_DUMP = "SKIPDUMP"
        // A clock time like "5:00 AM" — the signature of a run card's desc.
        private val RUN_TIME_PATTERN = Regex("\\d{1,2}:\\d{2}\\s?(AM|PM)", RegexOption.IGNORE_CASE)
        // Day-header text (lowercased) -> our weekday abbreviation.
        private val DAY_NAME_TO_ABBREV = linkedMapOf(
            "monday" to "Mon", "tuesday" to "Tue", "wednesday" to "Wed",
            "thursday" to "Thu", "friday" to "Fri", "saturday" to "Sat", "sunday" to "Sun",
        )
    }
}
