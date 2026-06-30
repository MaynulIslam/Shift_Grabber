package com.smartcourier.services

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.smartcourier.config.SkipSelectors
import com.smartcourier.core.ShiftGrabber

/**
 * Watches notifications from the Skip courier app. This is the cross-app "radar"
 * for orders — it sees order alerts even when Skip isn't in the foreground.
 *
 * Right now it's in CAPTURE mode: when a Skip notification fires it logs the full
 * notification content (logcat tag SKIPNOTIF) and dumps the on-screen order page
 * (tag SKIPDUMP), so we can learn what an incoming order looks like and build
 * auto-accept. Requires Notification Access (Settings > Notification access).
 */
class SkipNotificationListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val pkg = sbn?.packageName ?: return
        if (pkg != SkipSelectors.PACKAGE) return

        val extras = sbn.notification?.extras
        fun ex(key: String) = extras?.getCharSequence(key)?.toString().orEmpty()
        val title = ex("android.title")
        val text = ex("android.text")
        val bigText = ex("android.bigText")
        val subText = ex("android.subText")
        val infoText = ex("android.infoText")

        // Full dump to logcat for discovery.
        Log.i(TAG, "===== SKIP NOTIFICATION =====")
        Log.i(TAG, "title=[$title]")
        Log.i(TAG, "text=[$text]")
        Log.i(TAG, "bigText=[$bigText]")
        Log.i(TAG, "subText=[$subText] infoText=[$infoText]")
        Log.i(TAG, "category=[${sbn.notification?.category}] channel=[${sbn.notification?.channelId}]")

        // Short line in the in-app Log screen too.
        ShiftGrabber.log("info", "🔔 Skip notif: ${title.take(28)} — ${text.take(40)}")

        // Persist the full notification to a file (survives logcat rotation).
        try {
            val dir = java.io.File(filesDir, "captures")
            dir.mkdirs()
            java.io.File(dir, "notif-${System.currentTimeMillis()}.txt").writeText(
                "title=[$title]\ntext=[$text]\nbigText=[$bigText]\n" +
                    "subText=[$subText] infoText=[$infoText]\n" +
                    "category=[${sbn.notification?.category}] channel=[${sbn.notification?.channelId}]\n",
            )
        } catch (_: Throwable) {
        }

        // Capture the on-screen order page a beat later (it needs a moment to render).
        ShiftGrabber.accessibilityService?.let { service ->
            android.os.Handler(mainLooper).postDelayed(
                { service.captureScreen("after Skip notification") },
                500,
            )
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // no-op
    }

    companion object {
        private const val TAG = "SKIPNOTIF"
    }
}
