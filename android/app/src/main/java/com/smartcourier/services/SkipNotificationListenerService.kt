package com.smartcourier.services

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.smartcourier.config.SkipSelectors
import com.smartcourier.core.ShiftGrabber

/**
 * SkipNotificationListenerService — optional accelerant.
 *
 * Skip often posts a push notification when new shifts drop. Catching that lets
 * us trigger an immediate scan instead of waiting for the next refresh tick.
 *
 * This is a skeleton: it logs Skip notifications and nudges the accessibility
 * service to run a cycle. Requires the user to grant Notification Access
 * separately (Settings > Notifications > Notification access).
 */
class SkipNotificationListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val pkg = sbn?.packageName ?: return
        if (pkg != SkipSelectors.PACKAGE) return

        val extras = sbn.notification?.extras
        val title = extras?.getCharSequence("android.title")?.toString().orEmpty()
        val text = extras?.getCharSequence("android.text")?.toString().orEmpty()
        ShiftGrabber.log("info", "Skip notification: $title — $text")

        // TODO: optionally filter for "new shift" wording, then trigger an
        // immediate scan on the accessibility service:
        val prefs = ShiftGrabber.preferences
        val service = ShiftGrabber.accessibilityService
        if (prefs != null && service != null) {
            // Run on the main thread; node access must be on the service thread.
            android.os.Handler(mainLooper).post { service.runCycle(prefs) }
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // no-op
    }
}
