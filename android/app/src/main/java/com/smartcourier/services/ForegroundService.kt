package com.smartcourier.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.smartcourier.config.SkipSelectors
import com.smartcourier.core.ShiftGrabber
import com.smartcourier.model.ServiceStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * ForegroundService — owns the persistent "monitoring" notification and the
 * coroutine loop that paces the automation. It does NOT touch the UI itself;
 * each tick it asks the AccessibilityService (via [ShiftGrabber]) to run a
 * cycle and then refresh.
 */
class ForegroundService : Service() {

    private val scope = CoroutineScope(Dispatchers.Default + Job())
    private var loopJob: Job? = null
    private var lastWaitLogMs = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopMonitoring()
                return START_NOT_STICKY
            }
            else -> startMonitoring()
        }
        return START_STICKY
    }

    private fun startMonitoring() {
        startForeground(NOTIF_ID, buildNotification("Monitoring shifts…"))
        ShiftGrabber.updateStatus(ServiceStatus.STARTING)

        loopJob?.cancel()
        loopJob = scope.launch {
            ShiftGrabber.updateStatus(ServiceStatus.RUNNING)
            ShiftGrabber.log("info", "Monitoring loop started")

            while (isActive) {
                val prefs = ShiftGrabber.preferences
                if (prefs == null) {
                    ShiftGrabber.log("error", "No preferences set; stopping")
                    break
                }

                try {
                    runOneTick()
                } catch (t: Throwable) {
                    ShiftGrabber.log("error", "Tick failed: ${t.message}")
                }

                // Scan FAST (fixed, sub-second) so we react to a run the instant
                // it renders and tap ADD RUN immediately — winning runs is a
                // speed race. The user's refreshIntervalSec governs the swipe
                // cadence (REFRESH_MIN_GAP_MS in the accessibility service), not
                // this scan tick.
                delay(SCAN_INTERVAL_MS)
            }
        }
    }

    private suspend fun runOneTick() {
        val service = ShiftGrabber.accessibilityService
        if (service == null) {
            ShiftGrabber.log("warning", "Accessibility service not connected")
            return
        }
        val prefs = ShiftGrabber.preferences ?: return

        // If Skip isn't the foreground app, try to bring it up ourselves. That
        // needs the "Display over other apps" permission (background-activity
        // launch). Without it, we just wait for the user to open Skip manually.
        val fg = withContext(Dispatchers.Main) { service.currentForegroundPackage() }
        if (fg != SkipSelectors.PACKAGE) {
            if (Settings.canDrawOverlays(this)) {
                bringSkipToForeground()
            } else {
                maybeLogWaiting(fg)
            }
            return
        }

        // We're on Skip: scan + claim. runCycle owns its own refresh and only
        // refreshes when Skip is foreground, so we never swipe other apps.
        withContext(Dispatchers.Main) { service.runCycle(prefs) }
    }

    /** Throttled log so we don't spam "waiting" every second. */
    private fun maybeLogWaiting(fg: String?) {
        val now = System.currentTimeMillis()
        if (now - lastWaitLogMs > 5000) {
            lastWaitLogMs = now
            ShiftGrabber.log(
                "info",
                "Waiting for Skip — open it, or grant 'Display over other apps' " +
                    "for auto-open (saw: $fg)",
            )
        }
    }

    /** Launch the Skip courier app so its window becomes the active one. */
    private fun bringSkipToForeground() {
        val launch = packageManager.getLaunchIntentForPackage(SkipSelectors.PACKAGE)
        if (launch == null) {
            ShiftGrabber.log("error", "Skip app not installed (${SkipSelectors.PACKAGE})")
            ShiftGrabber.updateStatus(ServiceStatus.ERROR)
            return
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        startActivity(launch)
        ShiftGrabber.log("info", "Brought Skip to foreground")
    }

    private fun stopMonitoring() {
        loopJob?.cancel()
        loopJob = null
        ShiftGrabber.updateStatus(ServiceStatus.OFF)
        ShiftGrabber.log("info", "Monitoring stopped")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        scope.cancel()
        if (ShiftGrabber.status != ServiceStatus.OFF) {
            ShiftGrabber.updateStatus(ServiceStatus.OFF)
        }
        super.onDestroy()
    }

    // -- Notification ---------------------------------------------------------

    private fun buildNotification(text: String): Notification {
        ensureChannel()
        val stopIntent = Intent(this, ForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPending = android.app.PendingIntent.getService(
            this, 0, stopIntent,
            android.app.PendingIntent.FLAG_IMMUTABLE or
                android.app.PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SmartCourier")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_search)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, "Stop", stopPending)
            .build()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        "Shift monitoring",
                        NotificationManager.IMPORTANCE_LOW,
                    ),
                )
            }
        }
    }

    companion object {
        /** Fast scan tick (ms) — react to runs in well under a second. */
        const val SCAN_INTERVAL_MS = 500L
        const val CHANNEL_ID = "smartcourier-monitoring"
        const val NOTIF_ID = 4201
        const val ACTION_START = "com.smartcourier.START"
        const val ACTION_STOP = "com.smartcourier.STOP"

        fun start(context: Context) {
            val intent = Intent(context, ForegroundService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, ForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }
}
