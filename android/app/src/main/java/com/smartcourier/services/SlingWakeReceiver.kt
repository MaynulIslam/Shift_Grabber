package com.smartcourier.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.smartcourier.core.ShiftGrabber

/**
 * Fired by [SlingScheduler] on the weekly Thursday-noon alarm. Loads the saved
 * rules, points the coordinator at Sling, kicks off the monitoring loop, then
 * reschedules next week.
 */
class SlingWakeReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ACTION_WAKE) return

        val rules = SlingScheduler.savedRules(context)
        if (rules != null) {
            ShiftGrabber.setTarget(ShiftGrabber.Target.SLING)
            ShiftGrabber.setSlingRules(rules)
            SlingAutomation.resetSession()
            ShiftGrabber.log("info", "Uride: Thursday auto-wake — scanning")
            ForegroundService.start(context)
        } else {
            ShiftGrabber.log("warning", "Uride: auto-wake fired but no saved rules")
        }

        // Re-arm for next week.
        SlingScheduler.schedule(context)
    }

    companion object {
        const val ACTION_WAKE = "com.smartcourier.SLING_WAKE"
    }
}
