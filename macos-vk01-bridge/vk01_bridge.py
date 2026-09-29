#!/usr/bin/env python3
"""
ANTICATER VK01 Native macOS Hardware Interceptor & Bridge (Pure ctypes + System Frameworks)
Runs inside signed macOS Python3 using ctypes bindings to:
  1. ApplicationServices / CoreGraphics (CGEventTapCreate for NSSystemDefined media keys & F14/F15)
  2. IOKit (IOHIDManagerCreate for zero-permission USB/Bluetooth/2.4GHz Consumer Control 0x0C)
  3. CoreAudio (AudioObjectGetPropertyData for zero-permission Volume/Mute delta detection + volume lock)
Starts in <40ms and never writes unsigned binaries (100% Santa-compatible).
"""

import ctypes
import ctypes.util
import json
import sys
import time

# Load signed macOS system frameworks via ctypes
cg = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
cf = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
iokit = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/IOKit.framework/IOKit")
ca = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/CoreAudio.framework/CoreAudio")
objc = ctypes.cdll.LoadLibrary("/usr/lib/libobjc.A.dylib")

# CoreFoundation types & helpers
CFIndex = ctypes.c_long
CFAllocatorRef = ctypes.c_void_p
CFRunLoopRef = ctypes.c_void_p
CFRunLoopSourceRef = ctypes.c_void_p
CFMachPortRef = ctypes.c_void_p
CFStringRef = ctypes.c_void_p
CFTypeRef = ctypes.c_void_p
IOOptionBits = ctypes.c_uint32
IOReturn = ctypes.c_int32

cf.CFRunLoopGetCurrent.restype = CFRunLoopRef
cf.CFRunLoopRunInMode.argtypes = [CFStringRef, ctypes.c_double, ctypes.c_bool]
cf.CFRunLoopRunInMode.restype = ctypes.c_int32
cf.CFMachPortCreateRunLoopSource.argtypes = [CFAllocatorRef, CFMachPortRef, CFIndex]
cf.CFMachPortCreateRunLoopSource.restype = CFRunLoopSourceRef
cf.CFRunLoopAddSource.argtypes = [CFRunLoopRef, CFRunLoopSourceRef, CFStringRef]

kCFRunLoopCommonModes = ctypes.c_void_p.in_dll(cf, "kCFRunLoopCommonModes")
kCFRunLoopDefaultMode = ctypes.c_void_p.in_dll(cf, "kCFRunLoopDefaultMode")

# State for deduplication
last_event_ms = 0
last_gesture_key = ""
active_blocking_tap = False


def now_ms() -> int:
    return int(time.time() * 1000)


def emit(event_type: str, axis: int, delta: int, gesture: str, raw_code: str, source: str):
    global last_event_ms, last_gesture_key
    t_ms = now_ms()
    key = f"{event_type}_{axis}_{delta}"
    if event_type != "status" and (t_ms - last_event_ms) < 40:
        if last_gesture_key == key or source == "coreaudio":
            return
    if event_type != "status":
        last_event_ms = t_ms
        last_gesture_key = key

    payload = {
        "type": event_type,
        "axis": axis,
        "delta": delta,
        "gesture": gesture,
        "rawCode": raw_code,
        "source": source,
        "timestampMs": t_ms,
    }
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


# ----------------------------------------------------------------------------
# Layer 1: IOHIDManager (Zero-Permission Direct Hardware Consumer Control 0x0C)
# ----------------------------------------------------------------------------
iokit.IOHIDManagerCreate.argtypes = [CFAllocatorRef, IOOptionBits]
iokit.IOHIDManagerCreate.restype = ctypes.c_void_p
iokit.IOHIDManagerSetDeviceMatching.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
iokit.IOHIDManagerScheduleWithRunLoop.argtypes = [ctypes.c_void_p, CFRunLoopRef, CFStringRef]
iokit.IOHIDManagerOpen.argtypes = [ctypes.c_void_p, IOOptionBits]
iokit.IOHIDManagerOpen.restype = IOReturn

iokit.IOHIDValueGetElement.argtypes = [ctypes.c_void_p]
iokit.IOHIDValueGetElement.restype = ctypes.c_void_p
iokit.IOHIDValueGetIntegerValue.argtypes = [ctypes.c_void_p]
iokit.IOHIDValueGetIntegerValue.restype = CFIndex
iokit.IOHIDElementGetUsagePage.argtypes = [ctypes.c_void_p]
iokit.IOHIDElementGetUsagePage.restype = ctypes.c_uint32
iokit.IOHIDElementGetUsage.argtypes = [ctypes.c_void_p]
iokit.IOHIDElementGetUsage.restype = ctypes.c_uint32

IOHIDValueCallback = ctypes.CFUNCTYPE(
    None, ctypes.c_void_p, IOReturn, ctypes.c_void_p, ctypes.c_void_p
)
iokit.IOHIDManagerRegisterInputValueCallback.argtypes = [
    ctypes.c_void_p,
    IOHIDValueCallback,
    ctypes.c_void_p,
]


def _iohid_value_cb(context, result, sender, value):
    try:
        int_val = iokit.IOHIDValueGetIntegerValue(value)
        if int_val != 1:
            return
        elem = iokit.IOHIDValueGetElement(value)
        usage_page = iokit.IOHIDElementGetUsagePage(elem)
        usage = iokit.IOHIDElementGetUsage(elem)

        # Consumer Control Page (0x0C)
        if usage_page == 0x0C:
            if usage == 0xE9:  # Volume Increment -> VK01 Rotate CW
                emit("rotate", 1, 1, "Rotate CW (HID Volume+)", "HID_0x0C_0xE9", "iohid")
            elif usage == 0xE0:  # Volume Decrement -> VK01 Rotate CCW
                emit("rotate", 1, -1, "Rotate CCW (HID Volume-)", "HID_0x0C_0xE0", "iohid")
            elif usage == 0xE2:  # Mute -> VK01 Single Click
                emit("click", 0, 0, "Single Click (HID Mute)", "HID_0x0C_0xE2", "iohid")
            elif usage == 0x6F:  # Brightness Increment -> VK01 Push+Rotate CW
                emit("rotate", 2, 1, "Push+Rotate CW (HID Brightness+)", "HID_0x0C_0x6F", "iohid")
            elif usage == 0x70:  # Brightness Decrement -> VK01 Push+Rotate CCW
                emit("rotate", 2, -1, "Push+Rotate CCW (HID Brightness-)", "HID_0x0C_0x70", "iohid")
        # Keyboard Page (0x07) for F14 (0x69) / F15 (0x6A) Brightness keys
        elif usage_page == 0x07:
            if usage == 0x69:  # F14 -> Push+Rotate CCW
                emit("rotate", 2, -1, "Push+Rotate CCW (HID F14)", "HID_0x07_0x69", "iohid")
            elif usage == 0x6A:  # F15 -> Push+Rotate CW
                emit("rotate", 2, 1, "Push+Rotate CW (HID F15)", "HID_0x07_0x6A", "iohid")
    except Exception:
        pass


_iohid_cb_ref = IOHIDValueCallback(_iohid_value_cb)
hid_manager = None


def start_iohid_listener():
    global hid_manager
    hid_manager = iokit.IOHIDManagerCreate(None, 0)
    # Match all HID devices and filter UsagePage 0x0C / 0x07 in callback
    iokit.IOHIDManagerSetDeviceMatching(hid_manager, None)
    iokit.IOHIDManagerRegisterInputValueCallback(hid_manager, _iohid_cb_ref, None)
    iokit.IOHIDManagerScheduleWithRunLoop(
        hid_manager, cf.CFRunLoopGetCurrent(), kCFRunLoopDefaultMode
    )
    res = iokit.IOHIDManagerOpen(hid_manager, 0)
    emit("status", 0, 0, f"IOHIDManager Consumer Control (0x0C) listener active (status={res})", "STATUS", "iohid")


# ----------------------------------------------------------------------------
# Layer 2: CGEventTap (Intercepts Media Keys & Suppresses macOS Volume HUD)
# ----------------------------------------------------------------------------
CGEventTapProxy = ctypes.c_void_p
CGEventType = ctypes.c_uint32
CGEventRef = ctypes.c_void_p
CGEventMask = ctypes.c_uint64

CGEventTapCallBack = ctypes.CFUNCTYPE(
    CGEventRef, CGEventTapProxy, CGEventType, CGEventRef, ctypes.c_void_p
)

cg.CGEventTapCreate.argtypes = [
    ctypes.c_uint32,
    ctypes.c_uint32,
    ctypes.c_uint32,
    CGEventMask,
    CGEventTapCallBack,
    ctypes.c_void_p,
]
cg.CGEventTapCreate.restype = CFMachPortRef
cg.CGEventTapEnable.argtypes = [CFMachPortRef, ctypes.c_bool]
cg.CGEventGetIntegerValueField.argtypes = [CGEventRef, ctypes.c_uint32]
cg.CGEventGetIntegerValueField.restype = ctypes.c_int64

# Objective-C runtime for `[NSEvent eventWithCGEvent:]` to parse NSSystemDefined (type 14)
objc.objc_getClass.argtypes = [ctypes.c_char_p]
objc.objc_getClass.restype = ctypes.c_void_p
objc.sel_registerName.argtypes = [ctypes.c_char_p]
objc.sel_registerName.restype = ctypes.c_void_p

msg_send_ptr = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p)(
    ("objc_msgSend", objc)
)
msg_send_short = ctypes.CFUNCTYPE(ctypes.c_short, ctypes.c_void_p, ctypes.c_void_p)(
    ("objc_msgSend", objc)
)
msg_send_long = ctypes.CFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.c_void_p)(
    ("objc_msgSend", objc)
)

NSEventClass = objc.objc_getClass(b"NSEvent")
SEL_eventWithCGEvent = objc.sel_registerName(b"eventWithCGEvent:")
SEL_subtype = objc.sel_registerName(b"subtype")
SEL_data1 = objc.sel_registerName(b"data1")

event_tap_ref = None


def _cg_event_cb(proxy, evt_type, event, refcon):
    global event_tap_ref
    try:
        # Re-enable tap if disabled by timeout (0xFFFFFFFE)
        if evt_type in (0xFFFFFFFE, 0xFFFFFFFF):
            if event_tap_ref:
                cg.CGEventTapEnable(event_tap_ref, True)
            return event

        # NSSystemDefined (14) -> Media / Volume / Brightness keys
        if evt_type == 14 and NSEventClass:
            ns_evt = msg_send_ptr(NSEventClass, SEL_eventWithCGEvent, event)
            if ns_evt:
                subtype = msg_send_short(ns_evt, SEL_subtype)
                if subtype == 8:
                    data1 = msg_send_long(ns_evt, SEL_data1)
                    key_code = (data1 & 0xFFFF0000) >> 16
                    key_flags = data1 & 0x0000FFFF
                    key_state = (key_flags & 0xFF00) >> 8  # 0x0A = down, 0x0B = up
                    is_down = key_state == 0x0A
                    matched = False

                    if key_code == 0:  # NX_KEYTYPE_SOUND_UP
                        matched = True
                        if is_down:
                            emit("rotate", 1, 1, "Rotate CW (Volume+)", "NX_SOUND_UP(0)", "cgeventtap")
                    elif key_code == 1:  # NX_KEYTYPE_SOUND_DOWN
                        matched = True
                        if is_down:
                            emit("rotate", 1, -1, "Rotate CCW (Volume-)", "NX_SOUND_DOWN(1)", "cgeventtap")
                    elif key_code == 7:  # NX_KEYTYPE_MUTE
                        matched = True
                        if is_down:
                            emit("click", 0, 0, "Single Click (Mute)", "NX_MUTE(7)", "cgeventtap")
                    elif key_code == 2:  # NX_KEYTYPE_BRIGHTNESS_UP
                        matched = True
                        if is_down:
                            emit("rotate", 2, 1, "Push+Rotate CW (Brightness+)", "NX_BRIGHTNESS_UP(2)", "cgeventtap")
                    elif key_code == 3:  # NX_KEYTYPE_BRIGHTNESS_DOWN
                        matched = True
                        if is_down:
                            emit("rotate", 2, -1, "Push+Rotate CCW (Brightness-)", "NX_BRIGHTNESS_DOWN(3)", "cgeventtap")

                    if matched and active_blocking_tap:
                        return None  # Suppress macOS system Volume/Brightness HUD!

        # Standard keyDown (10) / keyUp (11) for F14 (107) and F15 (113)
        if evt_type in (10, 11):
            keycode = cg.CGEventGetIntegerValueField(event, 9)  # kCGKeyboardEventKeycode = 9
            is_down = evt_type == 10
            if keycode == 107:
                if is_down:
                    emit("rotate", 2, -1, "Push+Rotate CCW (F14)", "KEY_F14(107)", "cgeventtap")
                if active_blocking_tap:
                    return None
            elif keycode == 113:
                if is_down:
                    emit("rotate", 2, 1, "Push+Rotate CW (F15)", "KEY_F15(113)", "cgeventtap")
                if active_blocking_tap:
                    return None
    except Exception:
        pass

    return event


_cg_cb_ref = CGEventTapCallBack(_cg_event_cb)


def start_cgeventtap():
    global event_tap_ref, active_blocking_tap
    mask = (1 << 10) | (1 << 11) | (1 << 14)
    # 1 = kCGSessionEventTap, 0 = kCGHeadInsertEventTap, 0 = kCGEventTapOptionDefault
    tap = cg.CGEventTapCreate(1, 0, 0, mask, _cg_cb_ref, None)
    if tap:
        event_tap_ref = tap
        active_blocking_tap = True
        src = cf.CFMachPortCreateRunLoopSource(None, tap, 0)
        cf.CFRunLoopAddSource(cf.CFRunLoopGetCurrent(), src, kCFRunLoopCommonModes)
        cg.CGEventTapEnable(tap, True)
        emit("status", 0, 0, "CGEventTap active (HUD suppression enabled)", "STATUS", "cgeventtap")
        return

    # Fallback: listen-only tap (1 = kCGEventTapOptionListenOnly)
    listen_tap = cg.CGEventTapCreate(1, 0, 1, mask, _cg_cb_ref, None)
    if listen_tap:
        event_tap_ref = listen_tap
        active_blocking_tap = False
        src = cf.CFMachPortCreateRunLoopSource(None, listen_tap, 0)
        cf.CFRunLoopAddSource(cf.CFRunLoopGetCurrent(), src, kCFRunLoopCommonModes)
        cg.CGEventTapEnable(listen_tap, True)
        emit("status", 0, 0, "CGEventTap listen-only active", "STATUS", "cgeventtap")
        return

    emit("status", 0, 0, "CGEventTap awaiting Accessibility; IOHID + CoreAudio active", "STATUS", "cgeventtap")


# ----------------------------------------------------------------------------
# Layer 3: CoreAudio Default Output Volume/Mute Poller (Zero-Permission Fallback)
# Detects any Bluetooth/USB volume/mute tick and restores baseline volume so
# the VK01 can rotate infinitely even if CGEventTap is not blocking.
# ----------------------------------------------------------------------------
class AudioObjectPropertyAddress(ctypes.Structure):
    _fields_ = [
        ("mSelector", ctypes.c_uint32),
        ("mScope", ctypes.c_uint32),
        ("mElement", ctypes.c_uint32),
    ]


ca.AudioObjectGetPropertyData.argtypes = [
    ctypes.c_uint32,
    ctypes.POINTER(AudioObjectPropertyAddress),
    ctypes.c_uint32,
    ctypes.c_void_p,
    ctypes.POINTER(ctypes.c_uint32),
    ctypes.c_void_p,
]
ca.AudioObjectGetPropertyData.restype = ctypes.c_int32

ca.AudioObjectSetPropertyData.argtypes = [
    ctypes.c_uint32,
    ctypes.POINTER(AudioObjectPropertyAddress),
    ctypes.c_uint32,
    ctypes.c_void_p,
    ctypes.c_uint32,
    ctypes.c_void_p,
]
ca.AudioObjectSetPropertyData.restype = ctypes.c_int32


def fourcc(s: str) -> int:
    b = s.encode("ascii")
    return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]


kAudioObjectSystemObject = 1
kAudioHardwarePropertyDefaultOutputDevice = fourcc("dOut")
kAudioObjectPropertyScopeGlobal = fourcc("glob")
kAudioDevicePropertyScopeOutput = fourcc("outp")
kAudioObjectPropertyElementMain = 0
kAudioHardwareServiceDeviceProperty_VirtualMainVolume = fourcc("vmvc")
kAudioDevicePropertyMute = fourcc("mute")


def get_default_output_device() -> int:
    addr = AudioObjectPropertyAddress(
        kAudioHardwarePropertyDefaultOutputDevice,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain,
    )
    dev_id = ctypes.c_uint32(0)
    size = ctypes.c_uint32(ctypes.sizeof(dev_id))
    res = ca.AudioObjectGetPropertyData(
        kAudioObjectSystemObject, ctypes.byref(addr), 0, None, ctypes.byref(size), ctypes.byref(dev_id)
    )
    return dev_id.value if res == 0 else 0


def read_volume(dev_id: int):
    for sel in (kAudioHardwareServiceDeviceProperty_VirtualMainVolume, fourcc("volm")):
        for elem in (0, 1):
            addr = AudioObjectPropertyAddress(sel, kAudioDevicePropertyScopeOutput, elem)
            vol = ctypes.c_float(0.0)
            size = ctypes.c_uint32(ctypes.sizeof(vol))
            if ca.AudioObjectGetPropertyData(dev_id, ctypes.byref(addr), 0, None, ctypes.byref(size), ctypes.byref(vol)) == 0:
                return vol.value, sel, elem
    return None, 0, 0


def set_volume(dev_id: int, val: float, sel: int, elem: int):
    addr = AudioObjectPropertyAddress(sel, kAudioDevicePropertyScopeOutput, elem)
    vol = ctypes.c_float(val)
    ca.AudioObjectSetPropertyData(dev_id, ctypes.byref(addr), 0, None, ctypes.sizeof(vol), ctypes.byref(vol))


def read_mute(dev_id: int):
    addr = AudioObjectPropertyAddress(kAudioDevicePropertyMute, kAudioDevicePropertyScopeOutput, 0)
    muted = ctypes.c_uint32(0)
    size = ctypes.c_uint32(ctypes.sizeof(muted))
    if ca.AudioObjectGetPropertyData(dev_id, ctypes.byref(addr), 0, None, ctypes.byref(size), ctypes.byref(muted)) == 0:
        return muted.value
    return None


def set_mute(dev_id: int, val: int):
    addr = AudioObjectPropertyAddress(kAudioDevicePropertyMute, kAudioDevicePropertyScopeOutput, 0)
    muted = ctypes.c_uint32(val)
    ca.AudioObjectSetPropertyData(dev_id, ctypes.byref(addr), 0, None, ctypes.sizeof(muted), ctypes.byref(muted))


def main():
    start_cgeventtap()
    start_iohid_listener()

    dev_id = get_default_output_device()
    base_vol, vol_sel, vol_elem = (None, 0, 0)
    base_mute = None
    if dev_id:
        base_vol, vol_sel, vol_elem = read_volume(dev_id)
        if base_vol is not None and (base_vol < 0.10 or base_vol > 0.90):
            base_vol = 0.50
            set_volume(dev_id, base_vol, vol_sel, vol_elem)
        base_mute = read_mute(dev_id)
        emit("status", 0, 0, "CoreAudio zero-permission Volume/Mute detector active", "STATUS", "coreaudio")

    emit("status", 0, 0, "VK01 Triple-Layer macOS Hardware Bridge Ready", "STATUS", "bridge")

    while True:
        # Pump CFRunLoop for 15ms slices while checking CoreAudio fallback
        cf.CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.015, False)
        if dev_id and not active_blocking_tap:
            cur_vol, _, _ = read_volume(dev_id)
            if cur_vol is not None and base_vol is not None:
                diff = cur_vol - base_vol
                if abs(diff) > 0.004:
                    delta = 1 if diff > 0 else -1
                    emit(
                        "rotate",
                        1,
                        delta,
                        "Rotate CW (Audio Volume+)" if delta > 0 else "Rotate CCW (Audio Volume-)",
                        f"AUDIO_VOL_DELTA({diff:+.3f})",
                        "coreaudio",
                    )
                    set_volume(dev_id, base_vol, vol_sel, vol_elem)
            cur_mute = read_mute(dev_id)
            if cur_mute is not None and base_mute is not None and cur_mute != base_mute:
                emit("click", 0, 0, "Single Click (Audio Mute)", "AUDIO_MUTE_TOGGLE", "coreaudio")
                set_mute(dev_id, base_mute)


if __name__ == "__main__":
    main()
