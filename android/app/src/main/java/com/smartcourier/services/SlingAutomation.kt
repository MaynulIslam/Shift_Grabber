package com.smartcourier.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import com.smartcourier.config.SlingSelectors
import com.smartcourier.core.ShiftGrabber
import com.smartcourier.model.DayWindow
import com.smartcourier.model.SlingRules
import com.smartcourier.model.SlingShift

/**
 * SlingAutomation — sweeps the Uride/Sling "Available" tab across every released
 * week, matches open shifts against the driver's rules (per-weekday window +
 * buffer), and either lists them (dry-run) or applies to them.
 *
 * The sweep: scan the visible cards, scroll down through the week, then tap the
 * ▶ arrow to the next week. Stop when a week has no open shifts (not released
 * yet) or after a safety cap. Runs OFF the main thread (it sleeps between taps).
 */
object SlingAutomation {

    private const val MAX_WEEKS = 5
    private const val MAX_SCROLLS = 25

    /** Shifts applied-to this session, so we don't re-apply them. */
    private val handled = java.util.Collections.synchronizedSet(mutableSetOf<String>())

    fun resetSession() = handled.clear()

    /** One full multi-week sweep. */
    fun runSweep(service: AccessibilityService, rules: SlingRules) {
        ensureOnAvailable(service)
        var grandOpen = 0
        var grandMatch = 0

        for (week in 0 until MAX_WEEKS) {
            val (open, match) = sweepWeek(service, rules)
            grandOpen += open
            grandMatch += match
            log("info", "Week ${week + 1}: $open open, $match match your rules")

            if (open == 0) {
                log("info", "Week ${week + 1} is empty — stopping (not released yet)")
                break
            }
            if (week < MAX_WEEKS - 1) {
                tapNextWeek(service)
                sleep(1300)
                ensureOnAvailable(service)
            }
        }

        val verb = if (rules.autoApply) "applied to" else "match (dry-run)"
        log(
            "success",
            "Sweep done — $grandOpen open shifts found, $grandMatch $verb your rules",
        )
    }

    /** Scroll through one week, scanning + handling each unique open card. */
    private fun sweepWeek(service: AccessibilityService, rules: SlingRules): Pair<Int, Int> {
        val seen = mutableSetOf<String>()
        var open = 0
        var match = 0
        var stagnant = 0
        var pass = 0

        while (pass < MAX_SCROLLS) {
            pass++
            val root = service.rootInActiveWindow ?: break
            val shifts = scan(root)
            var newThisPass = 0
            var appliedThisPass = false

            for ((node, shift) in shifts) {
                val key = shiftKey(shift)
                if (seen.contains(key)) continue
                seen.add(key)
                newThisPass++
                open++

                if (matchReason(shift, rules) != null) continue
                match++

                if (rules.autoApply && !handled.contains(key)) {
                    log("action", "Applying: ${label(shift)}")
                    if (applyTo(service, node)) {
                        handled.add(key)
                        log("success", "✓ Applied: ${label(shift)}")
                    } else {
                        log("warning", "Apply failed, will retry: ${label(shift)}")
                    }
                    appliedThisPass = true
                    break // the list changed — re-scan this view
                } else {
                    log("info", "Match: ${label(shift)}")
                }
            }

            if (appliedThisPass) {
                sleep(900)
                continue // re-scan the same position before scrolling
            }
            if (newThisPass == 0) {
                stagnant++
                if (stagnant >= 2) break // reached the bottom
            } else {
                stagnant = 0
            }
            scrollDown(service)
            sleep(750)
        }
        return open to match
    }

    // -- Navigation ----------------------------------------------------------

    private fun ensureOnAvailable(service: AccessibilityService) {
        val root = service.rootInActiveWindow ?: return
        if (findText(root, SlingSelectors.OPEN_MARKER) != null) return // already there
        if (findAny(root, SlingSelectors.AVAILABLE_TAB) == null) {
            findAny(root, SlingSelectors.SHIFTS_NAV)?.let { click(service, it); sleep(800) }
        }
        val root2 = service.rootInActiveWindow ?: return
        findAny(root2, SlingSelectors.AVAILABLE_TAB)?.let { click(service, it); sleep(800) }
    }

    /** Tap the ▶ arrow at the right end of the week date-strip. */
    private fun tapNextWeek(service: AccessibilityService) {
        val dm = service.resources.displayMetrics
        tap(service, dm.widthPixels - 71f, dm.heightPixels * 0.20f)
    }

    private fun scrollDown(service: AccessibilityService) {
        val dm = service.resources.displayMetrics
        val x = dm.widthPixels / 2f
        val path = Path().apply {
            moveTo(x, dm.heightPixels * 0.72f)
            lineTo(x, dm.heightPixels * 0.30f)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 250))
            .build()
        service.dispatchGesture(gesture, null, null)
    }

    // -- Scan ----------------------------------------------------------------

    private fun scan(root: AccessibilityNodeInfo): List<Pair<AccessibilityNodeInfo, SlingShift>> {
        val out = mutableListOf<Pair<AccessibilityNodeInfo, SlingShift>>()
        var currentDay: String? = null
        var currentDate: String? = null

        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null) return
            val text = n.text?.toString()?.trim().orEmpty()
            val desc = n.contentDescription?.toString()?.trim().orEmpty()

            if (desc.contains(SlingSelectors.OPEN_MARKER, true)) {
                SlingSelectors.TIME_RANGE.find(desc)?.let { m ->
                    val s = parseMin(m.groupValues[1])
                    val e = parseMin(m.groupValues[2])
                    if (s != null && e != null) {
                        out.add(n to SlingShift(currentDay, currentDate, s, e, desc))
                    }
                }
            } else {
                val lbl = if (text.isNotEmpty()) text else desc
                if (lbl.isNotEmpty() && lbl.length <= 24) {
                    if (lbl.matches(Regex("\\d{1,2}"))) currentDate = lbl
                    weekdayOf(lbl)?.let { currentDay = it }
                }
            }
            for (i in 0 until n.childCount) walk(n.getChild(i))
        }
        walk(root)
        return out
    }

    // -- Matching ------------------------------------------------------------

    /** null = the shift matches (should apply); otherwise a human reason. */
    private fun matchReason(shift: SlingShift, rules: SlingRules): String? {
        val days = if (shift.weekday != null) {
            listOf(shift.weekday)
        } else {
            rules.schedule.filterValues { it.enabled }.keys.toList()
        }
        if (days.isEmpty()) return "no enabled days"
        for (d in days) {
            val w = rules.schedule[d] ?: continue
            if (w.enabled && fits(shift, w, rules.bufferMin)) return null
        }
        return "outside window"
    }

    private fun fits(shift: SlingShift, w: DayWindow, buffer: Int): Boolean {
        if (w.allDay) return true
        var ws = w.startMin
        var we = w.endMin
        if (we <= ws) we += 1440
        var ss = shift.startMin
        var se = shift.endMin
        if (se <= ss) se += 1440
        val effStart = ws - buffer
        val effEnd = we + buffer
        return (ss >= effStart && se <= effEnd) ||
            (ss + 1440 >= effStart && se + 1440 <= effEnd) ||
            (ss - 1440 >= effStart && se - 1440 <= effEnd)
    }

    // -- Apply ---------------------------------------------------------------

    private fun applyTo(service: AccessibilityService, card: AccessibilityNodeInfo): Boolean {
        if (!click(service, card)) return false
        sleep(1000)

        val root = service.rootInActiveWindow
        val overflow = root?.let { findAny(it, SlingSelectors.OVERFLOW) }
        if (overflow != null) click(service, overflow) else tapTopRight(service)
        sleep(700)

        val root2 = service.rootInActiveWindow
        val apply = root2?.let { findAny(it, SlingSelectors.APPLY_BUTTON) }
        if (apply == null) {
            service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
            sleep(400)
            return false
        }
        val ok = click(service, apply)
        sleep(1000)
        service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
        sleep(500)
        return ok
    }

    private fun tapTopRight(service: AccessibilityService) {
        val dm = service.resources.displayMetrics
        tap(service, dm.widthPixels - 80f, 250f)
    }

    // -- Node helpers --------------------------------------------------------

    private fun findText(root: AccessibilityNodeInfo, needle: String): AccessibilityNodeInfo? {
        var found: AccessibilityNodeInfo? = null
        fun walk(n: AccessibilityNodeInfo?) {
            if (n == null || found != null) return
            val hay = (n.text?.toString() ?: "") + " " + (n.contentDescription?.toString() ?: "")
            if (hay.contains(needle, true)) {
                found = n
                return
            }
            for (i in 0 until n.childCount) walk(n.getChild(i))
        }
        walk(root)
        return found
    }

    private fun findAny(root: AccessibilityNodeInfo, candidates: List<String>): AccessibilityNodeInfo? {
        for (c in candidates) findText(root, c)?.let { return it }
        return null
    }

    private fun click(service: AccessibilityService, node: AccessibilityNodeInfo): Boolean {
        var n: AccessibilityNodeInfo? = node
        var depth = 0
        while (n != null && depth < 6) {
            if (n.isClickable && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
            n = n.parent
            depth++
        }
        return tapCenter(service, node)
    }

    private fun tapCenter(service: AccessibilityService, node: AccessibilityNodeInfo): Boolean {
        val r = Rect()
        node.getBoundsInScreen(r)
        if (r.width() <= 0 || r.height() <= 0) return false
        return tap(service, r.exactCenterX(), r.exactCenterY())
    }

    private fun tap(service: AccessibilityService, x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 60))
            .build()
        return service.dispatchGesture(gesture, null, null)
    }

    // -- Parsing helpers -----------------------------------------------------

    private fun weekdayOf(s: String): String? {
        val m = SlingSelectors.WEEKDAY.find(s) ?: return null
        return when (m.value.lowercase().take(3)) {
            "mon" -> "Mon"
            "tue" -> "Tue"
            "wed" -> "Wed"
            "thu" -> "Thu"
            "fri" -> "Fri"
            "sat" -> "Sat"
            "sun" -> "Sun"
            else -> null
        }
    }

    private fun parseMin(s: String): Int? {
        val m = SlingSelectors.CLOCK.find(s) ?: return null
        var h = m.groupValues[1].toInt() % 12
        val min = m.groupValues[2].toInt()
        if (m.groupValues[3].equals("PM", true)) h += 12
        return h * 60 + min
    }

    private fun label(s: SlingShift): String {
        val day = s.weekday ?: "?"
        val date = s.dateNum?.let { " $it" } ?: ""
        return "$day$date ${fmt(s.startMin)}–${fmt(s.endMin)}"
    }

    private fun fmt(min: Int): String {
        val m = ((min % 1440) + 1440) % 1440
        val h24 = m / 60
        val mm = m % 60
        val ap = if (h24 < 12) "AM" else "PM"
        val h = if (h24 % 12 == 0) 12 else h24 % 12
        return "%d:%02d %s".format(h, mm, ap)
    }

    private fun shiftKey(s: SlingShift): String =
        "${s.weekday}-${s.dateNum}-${s.startMin}-${s.endMin}"

    private fun sleep(ms: Long) {
        try {
            Thread.sleep(ms)
        } catch (_: InterruptedException) {
        }
    }

    private fun log(level: String, msg: String) = ShiftGrabber.log(level, "Uride: $msg")
}
