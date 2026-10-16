package com.smartcourier.model

import org.json.JSONObject

/**
 * Rules for the Uride/Sling grabber. Mirrors src/types SlingRules. Reuses the
 * same per-day [DayWindow] shape as the Skip grabber.
 */
data class SlingRules(
    /** Key = "Mon".."Sun". */
    val schedule: Map<String, DayWindow>,
    /** Edge flexibility in minutes (a shift may start this early / end this late). */
    val bufferMin: Int,
    /** Apply automatically to matches (vs just logging them). */
    val autoApply: Boolean,
    /** Wake ~Thursday noon to scan for the weekly drop. */
    val autoWakeThursday: Boolean,
) {
    companion object {
        private val DAYS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

        fun fromJson(json: String): SlingRules {
            val o = JSONObject(json)
            val schedObj = o.optJSONObject("schedule")
            val schedule = mutableMapOf<String, DayWindow>()
            if (schedObj != null) {
                for (d in DAYS) {
                    val w = schedObj.optJSONObject(d) ?: continue
                    schedule[d] = DayWindow(
                        enabled = w.optBoolean("enabled", true),
                        allDay = w.optBoolean("allDay", true),
                        startMin = w.optInt("startMin", 0),
                        endMin = w.optInt("endMin", 1440),
                    )
                }
            }
            return SlingRules(
                schedule = schedule,
                bufferMin = o.optInt("bufferMin", 60).coerceIn(0, 360),
                autoApply = o.optBoolean("autoApply", true),
                autoWakeThursday = o.optBoolean("autoWakeThursday", true),
            )
        }
    }
}

/** One open shift parsed from the Sling "Available" list. */
data class SlingShift(
    /** "Mon".."Sun" from the day header above the card (best effort). */
    val weekday: String?,
    /** Day-of-month number from the header, e.g. "24" (best effort). */
    val dateNum: String?,
    /** Minutes from midnight. */
    val startMin: Int,
    /** Minutes from midnight; may be <= startMin for an overnight shift. */
    val endMin: Int,
    val rawDesc: String,
)
