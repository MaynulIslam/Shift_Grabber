package com.smartcourier.core

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.smartcourier.model.ParsedShift
import com.smartcourier.model.ServiceStatus
import com.smartcourier.model.ShiftPreferences
import com.smartcourier.services.SkipAccessibilityService

/**
 * ShiftGrabber — process-wide coordinator and single source of truth.
 *
 * The three native pieces don't reference each other directly; they all go
 * through this singleton:
 *   - ShiftGrabberModule (JS bridge) sets prefs, starts/stops, reads status,
 *     and registers the ReactContext so we can emit events to JS.
 *   - ForegroundService drives the refresh loop and calls into the
 *     AccessibilityService instance held here.
 *   - SkipAccessibilityService registers/unregisters its live instance and
 *     reports found/claimed shifts back up.
 *
 * Event names MUST match src/types NativeEvents.
 */
object ShiftGrabber {

    @Volatile var preferences: ShiftPreferences? = null
        private set

    @Volatile var status: ServiceStatus = ServiceStatus.OFF
        private set

    /** Set by SkipAccessibilityService.onServiceConnected; cleared on unbind. */
    @Volatile var accessibilityService: SkipAccessibilityService? = null

    private var reactContext: ReactContext? = null

    fun attachReactContext(ctx: ReactContext) {
        reactContext = ctx
    }

    fun setPreferences(prefs: ShiftPreferences) {
        preferences = prefs
    }

    // -- Status ---------------------------------------------------------------

    fun updateStatus(next: ServiceStatus) {
        status = next
        val map = Arguments.createMap().apply {
            putString("status", next.name)
            putString("app", "skip")
        }
        emit(EVENT_STATUS_CHANGE, map)
    }

    // -- Logging (relayed to the JS Log screen) ------------------------------

    fun log(level: String, message: String) {
        val map = Arguments.createMap().apply {
            putString("level", level)
            putString("message", message)
            putString("app", "skip")
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        emit(EVENT_LOG, map)
    }

    // -- Shift results --------------------------------------------------------

    fun reportShiftFound(shift: ParsedShift) {
        emit(EVENT_SHIFT_FOUND, shiftToMap(shift))
    }

    fun reportShiftClaimed(shift: ParsedShift) {
        val map = Arguments.createMap().apply { putMap("shift", shiftToMap(shift)) }
        emit(EVENT_SHIFT_CLAIMED, map)
    }

    private fun shiftToMap(s: ParsedShift): WritableMap = Arguments.createMap().apply {
        putString("id", s.id)
        s.day?.let { putString("day", it) }
        s.dateLabel?.let { putString("dateLabel", it) }
        s.startTime?.let { putString("startTime", it) }
        s.endTime?.let { putString("endTime", it) }
        s.timeSlot?.let { putString("timeSlot", it) }
        s.zone?.let { putString("zone", it) }
        putString("rawText", s.rawText)
    }

    private fun emit(event: String, params: WritableMap) {
        val ctx = reactContext ?: return
        if (!ctx.hasActiveReactInstance()) return
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, params)
    }

    const val EVENT_STATUS_CHANGE = "SmartCourier.onStatusChange"
    const val EVENT_LOG = "SmartCourier.onLog"
    const val EVENT_SHIFT_FOUND = "SmartCourier.onShiftFound"
    const val EVENT_SHIFT_CLAIMED = "SmartCourier.onShiftClaimed"
}
