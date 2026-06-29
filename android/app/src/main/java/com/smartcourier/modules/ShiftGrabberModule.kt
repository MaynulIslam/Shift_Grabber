package com.smartcourier.modules

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.smartcourier.core.ShiftGrabber
import com.smartcourier.model.ShiftPreferences
import com.smartcourier.services.ForegroundService
import com.smartcourier.services.SkipAccessibilityService

/**
 * ShiftGrabberModule — the JS-facing bridge. Method names/contract match
 * src/services/BridgeService.ts. All real work is delegated to the
 * ForegroundService and the ShiftGrabber coordinator.
 */
class ShiftGrabberModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    init {
        ShiftGrabber.attachReactContext(reactContext)
    }

    override fun getName(): String = "ShiftGrabberModule"

    @ReactMethod
    fun startMonitoring(prefsJson: String, promise: Promise) {
        try {
            val prefs = ShiftPreferences.fromJson(prefsJson)
            ShiftGrabber.setPreferences(prefs)

            if (!isAccessibilityServiceEnabled()) {
                promise.resolve(false)
                return
            }
            ForegroundService.start(reactContext)
            promise.resolve(true)
        } catch (t: Throwable) {
            promise.reject("START_FAILED", t.message, t)
        }
    }

    @ReactMethod
    fun stopMonitoring(promise: Promise) {
        try {
            ForegroundService.stop(reactContext)
            promise.resolve(true)
        } catch (t: Throwable) {
            promise.reject("STOP_FAILED", t.message, t)
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(ShiftGrabber.status.name)
    }

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        promise.resolve(isAccessibilityServiceEnabled())
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
    }

    /** Whether "Display over other apps" is granted (enables background app launch). */
    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun openOverlaySettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            android.net.Uri.parse("package:${reactContext.packageName}"),
        ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        reactContext.startActivity(intent)
    }

    // -- Required for NativeEventEmitter on iOS-parity; harmless on Android. ---
    @ReactMethod
    fun addListener(eventName: String) { /* no-op; events emitted via DeviceEventManager */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

    // -- Helpers --------------------------------------------------------------

    /** Check Settings.Secure for our AccessibilityService component. */
    private fun isAccessibilityServiceEnabled(): Boolean {
        val expected = ComponentName(
            reactContext,
            SkipAccessibilityService::class.java,
        ).flattenToString()

        val enabled = Settings.Secure.getString(
            reactContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: return false

        val splitter = TextUtils.SimpleStringSplitter(':').apply { setString(enabled) }
        while (splitter.hasNext()) {
            if (splitter.next().equals(expected, ignoreCase = true)) return true
        }
        return false
    }
}
