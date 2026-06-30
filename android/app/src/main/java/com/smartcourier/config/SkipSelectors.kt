package com.smartcourier.config

/**
 * SkipSelectors — the single place where everything app-version-specific lives.
 *
 * Everything in this file is a GUESS until verified against a real install.
 * To discover real values, with the phone connected over USB:
 *
 *   adb shell uiautomator dump && adb pull /sdcard/window_dump.xml
 *   # or use Android Studio's "Layout Inspector" / the legacy uiautomatorviewer
 *
 * Open the Skip courier app on the Open Shifts page and read the dumped XML:
 *   - resource-id="..."   -> viewId selectors below
 *   - text="..."          -> text selectors below
 *
 * Update the values here and NOTHING else in the native code should need to
 * change. The automation logic in SkipAccessibilityService reads only from here.
 */
object SkipSelectors {

    /** Package of the Skip *courier* app (not the consumer app). Verify with:
     *  adb shell pm list packages | grep -i skip   */
    const val PACKAGE = "com.delco.courier" // verified via adb on real device 2026-06-29

    /**
     * When true, the accessibility service logs the FULL node tree (logcat tag
     * "SKIPDUMP") every cycle the Open Runs page is NOT the empty state — i.e.
     * the moment a real run appears, even for a second. Used to capture the run
     * card + claim button selectors. Turn OFF once they're filled in below.
     *
     * OFF as of 2026-06-29 — we've captured the run card, the "Add Run?" confirm
     * screen, and the "already taken" result. Dumping the whole tree every cycle
     * was pure latency in a race we win on speed. Flip back to true only to
     * capture a new/unknown screen.
     */
    const val DEBUG_DUMP_TREE = false

    // --- View IDs ------------------------------------------------------------
    // CONFIRMED 2026-06-29 via live uiautomator dump: the Skip courier app is a
    // React Native app and exposes almost NO android resource-ids — elements
    // carry content-desc/text instead. So we leave these blank and rely on the
    // Texts selectors below. (Kept here in case future app versions add ids.)
    object ViewIds {
        const val OPEN_SHIFTS_TAB = ""
        const val SHIFT_LIST = ""
        const val SHIFT_CARD = ""
        const val CLAIM_BUTTON = ""
    }

    // --- Text selectors (case-insensitive contains; matched on text + desc). --
    object Texts {
        // CONFIRMED: Skip labels the page "Open Runs" (not "Shifts").
        val OPEN_SHIFTS_TAB = listOf("Open Runs")
        // Bottom-nav entry that contains the Open Runs sub-tab. If Skip opens on
        // Home, we tap this first, then Open Runs on the next cycle.
        val SCHEDULING_NAV = listOf("Scheduling")
        // In-card claim button (none exists on Skip's list cards — you tap the
        // whole card, which opens the "Add Run?" detail screen).
        val CLAIM_BUTTON = listOf("Claim", "Grab", "Accept")
        // CONFIRMED 2026-06-29: the button on the "Add Run?" detail screen that
        // actually grabs the run is labelled "ADD RUN".
        val CONFIRM_BUTTON = listOf("ADD RUN", "Add Run")

        // CONFIRMED: when you lose the race, Skip shows an Error dialog reading
        // "This run is already taken." with an OK button. These let us detect it
        // and tap OK to recover instead of getting stuck on the popup.
        val ERROR_TEXTS = listOf(
            "already taken",
            "no longer available",
            "not available",
            "something went wrong",
        )
        val DISMISS_BUTTON = listOf("OK")
        // The ✕ / back control at the top of the "Add Run?" detail screen, used
        // to close it and return to Open Runs after a lost race. CONFIRMED: it's
        // a clickable node with desc/id "navigation-left-button".
        val CLOSE_DETAIL = listOf("navigation-left-button", "Close", "Back")
        // CONFIRMED from the empty Open Runs page.
        val EMPTY_STATE = listOf(
            "No Open Runs",
            "no open runs available",
            "There are no open runs",
        )
    }

    /**
     * Pull-to-refresh strategy. Many lists respond to ACTION_SCROLL_FORWARD on
     * the list node; some need a swipe gesture (dispatchGesture). Toggle here.
     */
    object Refresh {
        const val USE_GESTURE_SWIPE = false // if scroll action doesn't refresh, set true
        // Relative swipe coordinates (fraction of screen) for the gesture fallback.
        const val SWIPE_START_Y_FRACTION = 0.35f
        const val SWIPE_END_Y_FRACTION = 0.80f
        const val SWIPE_DURATION_MS = 350L
    }
}
