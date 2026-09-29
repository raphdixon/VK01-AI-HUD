import AudioToolbox
import Cocoa
import CoreAudio
import Foundation
import IOKit.hid

// ============================================================================
// ANTICATER VK01 Native macOS Hardware Interceptor & Bridge
// Triple-Layer Out-of-the-Box Capture for Factory Defaults:
//   Layer 1: CGEventTap (Intercepts NSSystemDefined Media Keys & F14/F15,
//            suppressing macOS Volume/Brightness HUD popup when permitted)
//   Layer 2: IOHIDManager (Reads USB/Bluetooth/2.4GHz Consumer Control 0x0C
//            Volume+/-, Mute, Brightness+/- reports directly with zero permissions)
//   Layer 3: CoreAudio Property Listener (Fallback detector for Volume/Mute
//            deltas with automatic volume restoration so the knob never hits
//            0% or 100% dead-ends even without Accessibility permissions)
// ============================================================================

struct VK01Event: Codable {
    let type: String          // "rotate" | "click" | "status"
    let axis: Int             // 1 = Normal Rotate, 2 = Push + Rotate, 0 = Click/Status
    let delta: Int            // -1 = CCW, +1 = CW, 0 = Click
    let gesture: String       // Human-readable gesture label
    let rawCode: String       // Raw HID / NX / CoreAudio code
    let source: String        // "cgeventtap" | "iohid" | "coreaudio" | "bridge"
    let timestampMs: Int64
}

final class VK01Interceptor {
    static let shared = VK01Interceptor()

    var suppressSystemHUD: Bool = true
    var activeEventTapBlocking: Bool = false
    private var lastEventTimeMs: Int64 = 0
    private var lastGestureKey: String = ""
    private var eventTap: CFMachPort?
    private var hidManager: IOHIDManager?

    // CoreAudio fallback state
    private var defaultOutputDeviceID: AudioDeviceID = kAudioObjectUnknown
    private var baselineVolume: Float32 = 0.5
    private var baselineMuted: UInt32 = 0
    private var isRestoringAudio: Bool = false

    func nowMs() -> Int64 {
        return Int64(Date().timeIntervalSince1970 * 1000.0)
    }

    func emit(_ event: VK01Event) {
        let currentMs = event.timestampMs
        // Deduplicate simultaneous IOHID + CGEventTap + CoreAudio triggers within 35ms
        if event.type != "status" && (currentMs - lastEventTimeMs) < 35 {
            if lastGestureKey == "\(event.type)_\(event.axis)_\(event.delta)" || event.source == "coreaudio" {
                return
            }
        }
        if event.type != "status" {
            lastEventTimeMs = currentMs
            lastGestureKey = "\(event.type)_\(event.axis)_\(event.delta)"
        }

        if let data = try? JSONEncoder().encode(event),
           let jsonString = String(data: data, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        }
    }

    func emitStatus(_ message: String, source: String = "bridge") {
        emit(VK01Event(
            type: "status",
            axis: 0,
            delta: 0,
            gesture: message,
            rawCode: "STATUS",
            source: source,
            timestampMs: nowMs()
        ))
    }

    // ------------------------------------------------------------------------
    // Layer 1: CGEventTap (Intercepts NSSystemDefined Media Keys & F14/F15)
    // ------------------------------------------------------------------------
    func startCGEventTap() -> Bool {
        let systemDefinedType = CGEventType(rawValue: 14)!
        let eventMask: CGEventMask =
            (1 << CGEventType.keyDown.rawValue) |
            (1 << CGEventType.keyUp.rawValue) |
            (1 << systemDefinedType.rawValue)

        let callback: CGEventTapCallBack = { (_, type, event, _) -> Unmanaged<CGEvent>? in
            let interceptor = VK01Interceptor.shared

            if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
                if let tap = interceptor.eventTap {
                    CGEvent.tapEnable(tap: tap, enable: true)
                }
                return Unmanaged.passUnretained(event)
            }

            if type.rawValue == 14 {
                if let nsEvent = NSEvent(cgEvent: event), nsEvent.subtype.rawValue == 8 {
                    let data1 = nsEvent.data1
                    let keyCode = Int((data1 & 0xFFFF0000) >> 16)
                    let keyFlags = Int(data1 & 0x0000FFFF)
                    let keyState = ((keyFlags & 0xFF00) >> 8) // 0x0A = keyDown, 0x0B = keyUp
                    let isKeyDown = (keyState == 0x0A)
                    var matched = false

                    switch keyCode {
                    case 0: // NX_KEYTYPE_SOUND_UP -> VK01 Rotate CW
                        matched = true
                        if isKeyDown {
                            interceptor.emit(VK01Event(
                                type: "rotate", axis: 1, delta: 1,
                                gesture: "Rotate CW (Volume+)",
                                rawCode: "NX_SOUND_UP(0)",
                                source: "cgeventtap",
                                timestampMs: interceptor.nowMs()
                            ))
                        }
                    case 1: // NX_KEYTYPE_SOUND_DOWN -> VK01 Rotate CCW
                        matched = true
                        if isKeyDown {
                            interceptor.emit(VK01Event(
                                type: "rotate", axis: 1, delta: -1,
                                gesture: "Rotate CCW (Volume-)",
                                rawCode: "NX_SOUND_DOWN(1)",
                                source: "cgeventtap",
                                timestampMs: interceptor.nowMs()
                            ))
                        }
                    case 7: // NX_KEYTYPE_MUTE -> VK01 Single Click
                        matched = true
                        if isKeyDown {
                            interceptor.emit(VK01Event(
                                type: "click", axis: 0, delta: 0,
                                gesture: "Single Click (Mute)",
                                rawCode: "NX_MUTE(7)",
                                source: "cgeventtap",
                                timestampMs: interceptor.nowMs()
                            ))
                        }
                    case 2: // NX_KEYTYPE_BRIGHTNESS_UP -> VK01 Push + Rotate CW
                        matched = true
                        if isKeyDown {
                            interceptor.emit(VK01Event(
                                type: "rotate", axis: 2, delta: 1,
                                gesture: "Push+Rotate CW (Brightness+)",
                                rawCode: "NX_BRIGHTNESS_UP(2)",
                                source: "cgeventtap",
                                timestampMs: interceptor.nowMs()
                            ))
                        }
                    case 3: // NX_KEYTYPE_BRIGHTNESS_DOWN -> VK01 Push + Rotate CCW
                        matched = true
                        if isKeyDown {
                            interceptor.emit(VK01Event(
                                type: "rotate", axis: 2, delta: -1,
                                gesture: "Push+Rotate CCW (Brightness-)",
                                rawCode: "NX_BRIGHTNESS_DOWN(3)",
                                source: "cgeventtap",
                                timestampMs: interceptor.nowMs()
                            ))
                        }
                    default:
                        break
                    }

                    if matched && interceptor.suppressSystemHUD && interceptor.activeEventTapBlocking {
                        return nil
                    }
                }
            }

            if type == .keyDown || type == .keyUp {
                let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
                let isDown = (type == .keyDown)
                if keyCode == 107 { // F14 -> Push+Rotate CCW
                    if isDown {
                        interceptor.emit(VK01Event(
                            type: "rotate", axis: 2, delta: -1,
                            gesture: "Push+Rotate CCW (F14)",
                            rawCode: "KEY_F14(107)",
                            source: "cgeventtap",
                            timestampMs: interceptor.nowMs()
                        ))
                    }
                    if interceptor.suppressSystemHUD && interceptor.activeEventTapBlocking { return nil }
                } else if keyCode == 113 { // F15 -> Push+Rotate CW
                    if isDown {
                        interceptor.emit(VK01Event(
                            type: "rotate", axis: 2, delta: 1,
                            gesture: "Push+Rotate CW (F15)",
                            rawCode: "KEY_F15(113)",
                            source: "cgeventtap",
                            timestampMs: interceptor.nowMs()
                        ))
                    }
                    if interceptor.suppressSystemHUD && interceptor.activeEventTapBlocking { return nil }
                }
            }

            return Unmanaged.passUnretained(event)
        }

        if let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: eventMask,
            callback: callback,
            userInfo: nil
        ) {
            self.eventTap = tap
            self.activeEventTapBlocking = true
            let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
            CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
            CGEvent.tapEnable(tap: tap, enable: true)
            emitStatus("CGEventTap active (HUD suppression enabled)", source: "cgeventtap")
            return true
        }

        if let listenTap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .listenOnly,
            eventsOfInterest: eventMask,
            callback: callback,
            userInfo: nil
        ) {
            self.eventTap = listenTap
            self.activeEventTapBlocking = false
            let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, listenTap, 0)
            CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
            CGEvent.tapEnable(tap: listenTap, enable: true)
            emitStatus("CGEventTap listen-only active", source: "cgeventtap")
            return true
        }

        emitStatus("CGEventTap awaiting Accessibility permission; IOHID + CoreAudio active", source: "cgeventtap")
        return false
    }

    // ------------------------------------------------------------------------
    // Layer 2: IOHIDManager (Zero-Permission Direct Hardware Consumer Control)
    // ------------------------------------------------------------------------
    func startIOHIDListener() {
        let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
        self.hidManager = manager

        let consumerMatch: [String: Any] = [
            kIOHIDDeviceUsagePageKey as String: 0x0C
        ]
        IOHIDManagerSetDeviceMatchingMultiple(manager, [consumerMatch as CFDictionary] as CFArray)

        let inputCallback: IOHIDValueCallback = { (_, _, _, value) in
            let element = IOHIDValueGetElement(value)
            let usagePage = IOHIDElementGetUsagePage(element)
            let usage = IOHIDElementGetUsage(element)
            let intValue = IOHIDValueGetIntegerValue(value)

            guard intValue == 1 else { return }
            let interceptor = VK01Interceptor.shared

            if usagePage == 0x0C {
                switch usage {
                case 0xE9: // Volume Increment -> VK01 Rotate CW
                    interceptor.emit(VK01Event(
                        type: "rotate", axis: 1, delta: 1,
                        gesture: "Rotate CW (HID Volume+)",
                        rawCode: "HID_0x0C_0xE9",
                        source: "iohid",
                        timestampMs: interceptor.nowMs()
                    ))
                case 0xE0: // Volume Decrement -> VK01 Rotate CCW
                    interceptor.emit(VK01Event(
                        type: "rotate", axis: 1, delta: -1,
                        gesture: "Rotate CCW (HID Volume-)",
                        rawCode: "HID_0x0C_0xE0",
                        source: "iohid",
                        timestampMs: interceptor.nowMs()
                    ))
                case 0xE2: // Mute -> VK01 Single Click
                    interceptor.emit(VK01Event(
                        type: "click", axis: 0, delta: 0,
                        gesture: "Single Click (HID Mute)",
                        rawCode: "HID_0x0C_0xE2",
                        source: "iohid",
                        timestampMs: interceptor.nowMs()
                    ))
                case 0x6F: // Brightness Increment -> VK01 Push+Rotate CW
                    interceptor.emit(VK01Event(
                        type: "rotate", axis: 2, delta: 1,
                        gesture: "Push+Rotate CW (HID Brightness+)",
                        rawCode: "HID_0x0C_0x6F",
                        source: "iohid",
                        timestampMs: interceptor.nowMs()
                    ))
                case 0x70: // Brightness Decrement -> VK01 Push+Rotate CCW
                    interceptor.emit(VK01Event(
                        type: "rotate", axis: 2, delta: -1,
                        gesture: "Push+Rotate CCW (HID Brightness-)",
                        rawCode: "HID_0x0C_0x70",
                        source: "iohid",
                        timestampMs: interceptor.nowMs()
                    ))
                default:
                    break
                }
            }
        }

        IOHIDManagerRegisterInputValueCallback(manager, inputCallback, nil)
        IOHIDManagerScheduleWithRunLoop(manager, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
        _ = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
        emitStatus("IOHIDManager Consumer Control (0x0C) listener active", source: "iohid")
    }

    // ------------------------------------------------------------------------
    // Layer 3: CoreAudio Default Output Device Volume/Mute Listener
    // Ensures 100% zero-permission capture even over Bluetooth Audio/Media HID
    // ------------------------------------------------------------------------
    func startCoreAudioListener() {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultOutputDevice,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var deviceID = AudioDeviceID(0)
        var size = UInt32(MemoryLayout<AudioDeviceID>.size)
        let status = AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject),
            &address,
            0,
            nil,
            &size,
            &deviceID
        )
        guard status == noErr && deviceID != kAudioObjectUnknown else { return }
        self.defaultOutputDeviceID = deviceID

        self.baselineVolume = readVolume(deviceID: deviceID) ?? 0.5
        if self.baselineVolume < 0.12 || self.baselineVolume > 0.88 {
            self.baselineVolume = 0.5
            setVolume(deviceID: deviceID, volume: 0.5)
        }
        self.baselineMuted = readMute(deviceID: deviceID) ?? 0

        var volAddr = AudioObjectPropertyAddress(
            mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainVolume,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: kAudioObjectPropertyElementMain
        )
        AudioObjectAddPropertyListenerBlock(deviceID, &volAddr, DispatchQueue.main) { [weak self] (_, _) in
            guard let self = self, !self.isRestoringAudio else { return }
            guard let newVol = self.readVolume(deviceID: self.defaultOutputDeviceID) else { return }
            let diff = newVol - self.baselineVolume
            if abs(diff) > 0.004 {
                let delta = diff > 0 ? 1 : -1
                self.emit(VK01Event(
                    type: "rotate", axis: 1, delta: delta,
                    gesture: delta > 0 ? "Rotate CW (Audio Volume+)" : "Rotate CCW (Audio Volume-)",
                    rawCode: String(format: "AUDIO_VOL_DELTA(%+.3f)", diff),
                    source: "coreaudio",
                    timestampMs: self.nowMs()
                ))
                // Restore baseline volume so knob never gets stuck at 0.0 or 1.0
                self.isRestoringAudio = true
                self.setVolume(deviceID: self.defaultOutputDeviceID, volume: self.baselineVolume)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) {
                    self.isRestoringAudio = false
                }
            }
        }

        var muteAddr = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyMute,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: kAudioObjectPropertyElementMain
        )
        AudioObjectAddPropertyListenerBlock(deviceID, &muteAddr, DispatchQueue.main) { [weak self] (_, _) in
            guard let self = self, !self.isRestoringAudio else { return }
            guard let newMute = self.readMute(deviceID: self.defaultOutputDeviceID) else { return }
            if newMute != self.baselineMuted {
                self.emit(VK01Event(
                    type: "click", axis: 0, delta: 0,
                    gesture: "Single Click (Audio Mute)",
                    rawCode: "AUDIO_MUTE_TOGGLE",
                    source: "coreaudio",
                    timestampMs: self.nowMs()
                ))
                self.isRestoringAudio = true
                self.setMute(deviceID: self.defaultOutputDeviceID, muted: self.baselineMuted)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) {
                    self.isRestoringAudio = false
                }
            }
        }

        emitStatus("CoreAudio Volume/Mute zero-permission listener active", source: "coreaudio")
    }

    private func readVolume(deviceID: AudioDeviceID) -> Float32? {
        var addr = AudioObjectPropertyAddress(
            mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainVolume,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: kAudioObjectPropertyElementMain
        )
        var vol: Float32 = 0
        var size = UInt32(MemoryLayout<Float32>.size)
        if AudioObjectGetPropertyData(deviceID, &addr, 0, nil, &size, &vol) == noErr {
            return vol
        }
        return nil
    }

    private func setVolume(deviceID: AudioDeviceID, volume: Float32) {
        var addr = AudioObjectPropertyAddress(
            mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainVolume,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: kAudioObjectPropertyElementMain
        )
        var vol = volume
        let size = UInt32(MemoryLayout<Float32>.size)
        _ = AudioObjectSetPropertyData(deviceID, &addr, 0, nil, size, &vol)
    }

    private func readMute(deviceID: AudioDeviceID) -> UInt32? {
        var addr = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyMute,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: kAudioObjectPropertyElementMain
        )
        var muted: UInt32 = 0
        var size = UInt32(MemoryLayout<UInt32>.size)
        if AudioObjectGetPropertyData(deviceID, &addr, 0, nil, &size, &muted) == noErr {
            return muted
        }
        return nil
    }

    private func setMute(deviceID: AudioDeviceID, muted: UInt32) {
        var addr = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyMute,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: kAudioObjectPropertyElementMain
        )
        var m = muted
        let size = UInt32(MemoryLayout<UInt32>.size)
        _ = AudioObjectSetPropertyData(deviceID, &addr, 0, nil, size, &m)
    }
}

let interceptor = VK01Interceptor.shared
_ = interceptor.startCGEventTap()
interceptor.startIOHIDListener()
interceptor.startCoreAudioListener()
interceptor.emitStatus("VK01 Triple-Layer macOS Hardware Bridge Ready", source: "bridge")

CFRunLoopRun()
