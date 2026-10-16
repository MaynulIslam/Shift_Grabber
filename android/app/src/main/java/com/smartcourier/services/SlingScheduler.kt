package com.smartcourier.services

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.smartcourier.core.ShiftGrabber
import com.smartcourier.model.SlingRules
import java.util.Calendar

/**
 * Schedules a weekly wake (~Thursday noon) to auto-scan Sling when Uride drops
 * next week's shifts. Best-effort: uses an inexact allow-while-idle alarm (no
 * special permission), but Samsung's battery optimisation can still delay or
 * kill it — the user should disable battery optimisation for reliable firing.
 */
object SlingScheduler {

    private const val PREFS = "sling"
    private const val KEY_RULES = "rules"
    private const val REQUEST_CODE = 7301

    /** Persist rules and schedule the next Thursday-noon wake. */
    fun enable(context: Context, rulesJson: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_RULES, rulesJson).apply()
        schedule(context)
    }

    fun disable(context: Context) {
        alarmManager(context).cancel(pendingIntent(context))
        ShiftGrabber.log("info", "Uride: auto-wake cancelled")
    }

    /** (Re)arm the alarm for the next Thursday at ~12:00 PM. */
    fun schedule(context: Context) {
        val next = nextThursdayNoon()
        alarmManager(context).setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            next.timeInMillis,
            pendingIntent(context),
        )
        ShiftGrabber.log("info", "Uride: auto-wake armed for ${next.time}")
    }

    /** Load the saved rules (used by the receiver after a wake). */
    fun savedRules(context: Context): SlingRules? {
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_RULES, null) ?: return null
        return runCatching { SlingRules.fromJson(json) }.getOrNull()
    }

    private fun nextThursdayNoon(): Calendar {
        val c = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 12)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        while (c.get(Calendar.DAY_OF_WEEK) != Calendar.THURSDAY ||
            c.timeInMillis <= System.currentTimeMillis()
        ) {
            c.add(Calendar.DAY_OF_MONTH, 1)
            c.set(Calendar.HOUR_OF_DAY, 12)
            c.set(Calendar.MINUTE, 0)
        }
        return c
    }

    private fun alarmManager(context: Context): AlarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun pendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, SlingWakeReceiver::class.java).apply {
            action = SlingWakeReceiver.ACTION_WAKE
        }
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
