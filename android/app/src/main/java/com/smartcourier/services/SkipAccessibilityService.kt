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

    /** True after a lost race, while we close the leftover "Add Run?" page. */
    @Volatile private var closingDetail = false

    /** Last time we verified/re-centered our position on Open Runs. */
    @Volatile private var lastPositionMs = 0L

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

        // RECOVERY step 1 (lost the race): Skip shows an Error popup ("This run
        // is already taken."). Tap OK to dismiss it, then flag that the "Add
        // Run?" page underneath still needs closing — otherwise we'd just re-tap
        // ADD RUN and loop forever on the same taken run.
        if (AccessibilityUtils.findByAnyText(root, SkipSelectors.Texts.ERROR_TEXTS) != null) {
            val ok = AccessibilityUtils.findClickableByAnyText(
                root, SkipSelectors.Texts.DISMISS_BUTTON,
            )
            if (ok == null || !AccessibilityUtils.clickSelfOrAncestor(ok)) {
                performGlobalAction(GLOBAL_ACTION_BACK)
            }
            closingDetail = true
            ShiftGrabber.log("warning", "Lost it — dismissed error")
            return false
        }

        // RECOVERY step 2: after the loss, the "Add Run?" page is still open.
        // Close it (the ✕ / back button at the top) to return to Open Runs,
        // rather than re-tapping ADD RUN. Clear the flag once we're back on the
        // list. The taken run is already in claimedIds, so we won't re-open it.
        if (closingDetail) {
            val onDetail = AccessibilityUtils.findClickableByAnyText(
                root, SkipSelectors.Texts.CONFIRM_BUTTON,
            ) != null
            if (onDetail) {
                val close = AccessibilityUtils.findClickableByAnyText(
                    root, SkipSelectors.Texts.CLOSE_DETAIL,
                )
                if (close == null || !AccessibilityUtils.clickSelfOrAncestor(close)) {
                    performGlobalAction(GLOBAL_ACTION_BACK)
                }
                ShiftGrabber.log("info", "Closed the taken-run page → Open Runs")
                return false
            }
            closingDetail = false // back on the list — resume scanning
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

        // POSITION GATE — Part A (every cycle, reliable): we ONLY operate inside
        // the Scheduling section. The bottom nav exposes which tab is selected,
        // so if "Scheduling" isn't selected (we're on Home / Earnings / Profile),
        // tap it (coordinate tap — the bottom nav ignores ACTION_CLICK) and do
        // nothing else. Skipped when the bottom nav isn't present (e.g. the
        // "Add Run?" detail screen).
        val schedNav = bottomNavNode(root, "Scheduling")
        if (schedNav != null && !schedNav.isSelected) {
            tapByCoordinates(schedNav)
            ShiftGrabber.log("info", "Off Scheduling — returning to Scheduling")
            return false
        }

        // Part B: within Scheduling, keep the Open Runs TOP tab selected. Those
        // tabs DON'T expose a selected state, so every ~5s we re-tap Open Runs to
        // stay centered (vs My Runs / Availability). Skipped on the "Add Run?"
        // screen and when "No Open Runs" already confirms we're on Open Runs.
        val onAddRunScreen = AccessibilityUtils.findClickableByAnyText(
            root, SkipSelectors.Texts.CONFIRM_BUTTON,
        ) != null
        val confirmedOnOpenRuns =
            AccessibilityUtils.findByAnyText(root, SkipSelectors.Texts.EMPTY_STATE) != null
        if (schedNav != null && !onAddRunScreen && !confirmedOnOpenRuns &&
            System.currentTimeMillis() - lastPositionMs >= POSITION_CHECK_MS
        ) {
            lastPositionMs = System.currentTimeMillis()
            val openRunsTab =
                AccessibilityUtils.findByAnyText(root, SkipSelectors.Texts.OPEN_SHIFTS_TAB)
            if (openRunsTab != null && AccessibilityUtils.clickSelfOrAncestor(openRunsTab)) {
                ShiftGrabber.log("info", "Re-centered on Open Runs")
                return false
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
            if (emptyHere) {
                // Confirmed on the Open Runs page, empty — refresh to pull new runs.
                ShiftGrabber.log("info", "Page loaded, no shifts available")
                maybeRefresh()
            } else {
                // We saw neither run cards NOR the "No Open Runs" empty-state, so
                // we're NOT on a settled Open Runs page (Skip Home, an "Add Run?"
                // detail screen, or mid-load). Do NOT swipe here — that's what
                // was refreshing/scrolling the wrong screens. Just wait; the next
                // cycle's navigation lands us on Open Runs.
                ShiftGrabber.log("info", "Not on Open Runs — skipping refresh")
            }
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
            // Tap the run card to open its "Add Run?" detail screen. Mark it
            // tried so we don't re-open the same run (whether we win or lose the
            // race). The next cycle taps that screen's ADD RUN button.
            if (claim(card)) {
                claimedIds.add(shift.id)
                ShiftGrabber.log(
                    "action",
                    "Opened run: ${shift.rawText.take(48)} — confirming…",
                )
                return true
            } else {
                ShiftGrabber.log("warning", "Tap failed for ${shift.id}")
            }
        }
        // Nothing grabbed this cycle. We do NOT refresh here: when run cards are
        // visible we can't be 100% sure it's the Open Runs tab (My Runs shows
        // identical cards), so the swipe-refresh now happens ONLY from the
        // confirmed "No Open Runs" empty state above — which is unique to the
        // Open Runs tab. New runs still get picked up every scan.
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

        // Open Runs not visible — reach the Scheduling section first. The bottom
        // nav ignores ACTION_CLICK, so tap its coordinates.
        val scheduling = AccessibilityUtils.findClickableByAnyText(
            root, SkipSelectors.Texts.SCHEDULING_NAV,
        )
        if (scheduling != null && tapByCoordinates(scheduling)) {
            ShiftGrabber.log("info", "Opened Scheduling (heading to Open Runs)")
        }
    }

    /**
     * Find a bottom-nav item by its EXACT content-description ("Home",
     * "Scheduling", "Earnings", "Profile"). Exact match avoids decoys like the
     * "How Scheduling Works" link. The returned node's isSelected tells us which
     * bottom tab is active.
     */
    private fun bottomNavNode(root: AccessibilityNodeInfo?, desc: String): AccessibilityNodeInfo? {
        if (root == null) return null
        var result: AccessibilityNodeInfo? = null
        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null || result != null) return
            if (n.isClickable && n.contentDescription?.toString() == desc) {
                result = n
                return
            }
            for (i in 0 until n.childCount) walk(n.getChild(i))
        }
        walk(root)
        return result
    }

    /**
     * Tap a node by dispatching a real touch at its center. Use this for
     * controls that ignore AccessibilityNodeInfo.ACTION_CLICK — notably Skip's
     * bottom navigation (Home / Scheduling / Earnings / Profile).
     */
    private fun tapByCoordinates(node: AccessibilityNodeInfo): Boolean {
        val r = android.graphics.Rect().also { node.getBoundsInScreen(it) }
        if (r.width() <= 0 || r.height() <= 0) return false
        val path = Path().apply {
            moveTo(r.exactCenterX(), r.exactCenterY())
            lineTo(r.exactCenterX() + 1f, r.exactCenterY() + 1f)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        return dispatchGesture(
            GestureDescription.Builder().addStroke(stroke).build(), null, null,
        )
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
        // How often to verify we're still parked on Open Runs.
        private const val POSITION_CHECK_MS = 5_000L
        // Day-header text (lowercased) -> our weekday abbreviation.
        private val DAY_NAME_TO_ABBREV = linkedMapOf(
            "monday" to "Mon", "tuesday" to "Tue", "wednesday" to "Wed",
            "thursday" to "Thu", "friday" to "Fri", "saturday" to "Sat", "sunday" to "Sun",
        )
    }
}
