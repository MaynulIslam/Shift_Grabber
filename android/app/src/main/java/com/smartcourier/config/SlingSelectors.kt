package com.smartcourier.config

/**
 * Single source of truth for Uride/Sling UI selectors, captured live via adb
 * uiautomator. Mirrors SkipSelectors. Tune these against the real screen.
 */
object SlingSelectors {
    const val PACKAGE = "com.gangverk.sling"

    /** Bottom-nav item that opens the shifts view. */
    val SHIFTS_NAV = listOf("Shifts")

    /** The tab listing open/claimable shifts. */
    val AVAILABLE_TAB = listOf("Available")

    /** An available (unclaimed) card's content-desc contains this. */
    const val OPEN_MARKER = "No employee"

    /** Overflow (⋮) menu and its actions. */
    val OVERFLOW = listOf("More options", "More")
    val APPLY_BUTTON = listOf("Apply for shift")
    val CANCEL_BUTTON = listOf("Cancel")

    /** "12:00 AM - 1:00 AM" inside a card desc. */
    val TIME_RANGE = Regex(
        "(\\d{1,2}:\\d{2}\\s*[AP]M)\\s*-\\s*(\\d{1,2}:\\d{2}\\s*[AP]M)",
        RegexOption.IGNORE_CASE,
    )

    /** A single clock time, e.g. "9:00 PM". */
    val CLOCK = Regex("(\\d{1,2}):(\\d{2})\\s*([AP]M)", RegexOption.IGNORE_CASE)

    /** A weekday word at a word boundary (abbrev or full: "Sat", "Saturday"). */
    val WEEKDAY = Regex(
        "\\b(mon|tue|wed|thu|fri|sat|sun)(day|sday|nesday|rsday|urday)?\\b",
        RegexOption.IGNORE_CASE,
    )
}
