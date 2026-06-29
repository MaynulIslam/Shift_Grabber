package com.smartcourier.utils

import com.smartcourier.model.ParsedShift
import com.smartcourier.model.ShiftPreferences
import java.util.Locale

/**
 * NodeParser — turns the raw text of a run card into a [ParsedShift] and decides
 * whether it matches the driver's per-day schedule.
 */
object NodeParser {

    private val DAY_PATTERNS = mapOf(
        "Mon" to Regex("\\bmonday", RegexOption.IGNORE_CASE),
        "Tue" to Regex("\\btuesday", RegexOption.IGNORE_CASE),
        "Wed" to Regex("\\bwednesday", RegexOption.IGNORE_CASE),
        "Thu" to Regex("\\bthursday", RegexOption.IGNORE_CASE),
        "Fri" to Regex("\\bfriday", RegexOption.IGNORE_CASE),
        "Sat" to Regex("\\bsaturday", RegexOption.IGNORE_CASE),
        "Sun" to Regex("\\bsunday", RegexOption.IGNORE_CASE),
    )

    // e.g. "5:00 PM - 9:00 PM" or "5 PM – 9 PM"
    private val TIME_RANGE = Regex(
        "(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm))\\s*[-–to]+\\s*(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm))",
        RegexOption.IGNORE_CASE,
    )

    /**
     * @param dayOverride day abbreviation associated from the list header. When
     * null, the day is best-effort detected from the text itself (works on the
     * "Add Run?" detail screen, which contains "Friday July 03").
     */
    fun parse(rawText: String, dayOverride: String? = null): ParsedShift {
        val day = dayOverride
            ?: DAY_PATTERNS.entries.firstOrNull { it.value.containsMatchIn(rawText) }?.key
        val timeMatch = TIME_RANGE.find(rawText)
        val start = timeMatch?.groupValues?.get(1)?.trim()
        val end = timeMatch?.groupValues?.get(2)?.trim()
        val slot = start?.let { slotFromTime(it) }
        val startMin = start?.let { parseMinutes(it) }

        // Run card desc format (confirmed): "5:00 AM - 8:30 AM, Sudbury".
        val zone = if (rawText.contains(',')) {
            rawText.substringAfterLast(',').trim().ifBlank { null }
        } else {
            null
        }

        return ParsedShift(
            id = rawText.hashCode().toString(),
            day = day,
            dateLabel = day,
            startTime = start,
            endTime = end,
            timeSlot = slot,
            startMin = startMin,
            zone = zone,
            rawText = rawText,
        )
    }

    /** Map a start time like "5:00 PM" to a coarse slot (kept for display). */
    fun slotFromTime(time: String): String? {
        val hour = (parseMinutes(time) ?: return null) / 60
        return when (hour) {
            in 5..11 -> "Morning"
            in 12..16 -> "Afternoon"
            in 17..20 -> "Evening"
            else -> "Night"
        }
    }

    /** "5:00 PM" -> minutes from midnight (1020). */
    private fun parseMinutes(time: String): Int? {
        val m = Regex("(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)", RegexOption.IGNORE_CASE)
            .find(time) ?: return null
        var hour = m.groupValues[1].toIntOrNull() ?: return null
        val min = m.groupValues[2].toIntOrNull() ?: 0
        val pm = m.groupValues[3].lowercase(Locale.US) == "pm"
        if (pm && hour != 12) hour += 12
        if (!pm && hour == 12) hour = 0
        return hour * 60 + min
    }

    private fun inWindow(sm: Int, start: Int, end: Int): Boolean =
        if (start <= end) sm in start until end else (sm >= start || sm < end)

    /**
     * Match against the per-day schedule:
     *  - If the run's day is known, enforce that day's window (off → reject; not
     *    all-day → start time must fall inside the window).
     *  - If the day couldn't be associated, fall back to accepting the run if
     *    ANY enabled day's window allows its start time (so time filtering still
     *    works even when day association fails).
     *  - Zones always matched against the raw text when set.
     */
    fun matches(shift: ParsedShift, prefs: ShiftPreferences): Boolean {
        val text = shift.rawText.lowercase(Locale.US)
        val window = prefs.windowFor(shift.day)

        if (shift.day != null && window != null) {
            if (!window.enabled) return false
            if (!window.allDay && shift.startMin != null &&
                !inWindow(shift.startMin, window.startMin, window.endMin)
            ) {
                return false
            }
        } else if (shift.startMin != null && prefs.schedule.isNotEmpty()) {
            val anyAllows = prefs.schedule.values.any { w ->
                w.enabled && (w.allDay || inWindow(shift.startMin, w.startMin, w.endMin))
            }
            if (!anyAllows) return false
        }

        if (prefs.zones.isNotEmpty()) {
            val zoneHit = prefs.zones.any { text.contains(it.lowercase(Locale.US)) }
            if (!zoneHit) return false
        }

        return true
    }
}
