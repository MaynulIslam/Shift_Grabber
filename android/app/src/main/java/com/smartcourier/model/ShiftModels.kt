package com.smartcourier.model

import org.json.JSONObject

/** Mirrors the TypeScript ServiceStatus union. */
enum class ServiceStatus { OFF, STARTING, RUNNING, ERROR }

/** One day's grab window. Times are minutes from midnight (0–1440). */
data class DayWindow(
    val enabled: Boolean,
    val allDay: Boolean,
    val startMin: Int,
    val endMin: Int,
)

/** Mirrors src/types ShiftPreferences (per-day schedule model). */
data class ShiftPreferences(
    /** Key = "Mon".."Sun". */
    val schedule: Map<String, DayWindow>,
    val zones: List<String>,
    val autoGrab: Boolean,
    val refreshIntervalSec: Int,
) {
    fun windowFor(day: String?): DayWindow? = day?.let { schedule[it] }

    companion object {
        private val DAYS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

        fun fromJson(json: String): ShiftPreferences {
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

            val zonesArr = o.optJSONArray("zones")
            val zones = if (zonesArr != null) {
                (0 until zonesArr.length()).map { zonesArr.getString(it) }
            } else {
                emptyList()
            }

            return ShiftPreferences(
                schedule = schedule,
                zones = zones,
                autoGrab = o.optBoolean("autoGrab", false),
                refreshIntervalSec = o.optInt("refreshIntervalSec", 15).coerceIn(1, 30),
            )
        }
    }
}

/** A shift scraped from a card on the Open Runs page. */
data class ParsedShift(
    val id: String,
    /** "Mon".."Sun", associated from the day header above the card (best effort). */
    val day: String?,
    val dateLabel: String?,
    val startTime: String?,
    val endTime: String?,
    val timeSlot: String?,
    /** Start time as minutes from midnight, for window matching. */
    val startMin: Int?,
    val zone: String?,
    val rawText: String,
)
