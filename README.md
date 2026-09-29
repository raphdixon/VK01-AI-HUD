# VECTR // ANTICATER VK01 Bimodal AI Operating Surface

**Eyes Select the Noun · Rotary Encoder Modulates the Verb · Click Commits.**

An interactive bimodal AI operating surface built for the **ANTICATER VK01 CNC 6063 Aluminum Desktop Knob** on macOS, combining:
1. **60 FPS Webcam Iris Gaze Tracking** (MediaPipe `FaceLandmarker` + One-Euro `1€` filter + hands-free 4-corner VK01 click calibration).
2. **JEV System-1 Speculative Computer Use (`01 // CHRONOS & JEV-CLUTCH`)** — Scrubbing forward and backward through predicted DOM actions (`t0 ↔ t+5`) and competing calibrated `Choice`, `Score`, and `Noul` probability branches (`19–24 ms` single-pass architecture).
3. **DiffusionGemma 26B-A4B Block-Diffusion Entropy Sculptor (`02 // ENTROPY SCULPTOR`)** — Scrubbing across 48 discrete entropy-bounded denoising steps on a 256-token parallel canvas to melt high-entropy words back into live superposition while low-entropy structural anchor tokens stay frozen solid.
4. **Gaze + Dial Semantic Lens (`03 // LADDER OF ABSTRACTION`)** — Scrubbing code and technical prose across 7 discrete semantic zoom detents (`L-3: 3-Word Chip` ↔ `L0: Canonical Source` ↔ `L+3: Adversarial Invariant Audit`) and 4 Role Persona lenses.

---

## Hardware Architecture: The ANTICATER VK01’s 5 Native Gestures

The ANTICATER VK01 microcontroller natively distinguishes **5 physical gestures in firmware**, giving a single rotary knob **two orthogonal continuous axes + a commit trigger**:

| Gesture | Physical Action on VK01 | Factory Default HID Event | VECTR AI Mapping |
| :--- | :--- | :--- | :--- |
| **Axis 1 (CCW)** | Rotate Counter-Clockwise | `Volume -` (`0xE0`) | **Rewind Future (`t-1`) / Melt High-Entropy Words / Zoom Out (`L-3`)** |
| **Axis 1 (CW)** | Rotate Clockwise | `Volume +` (`0xE9`) | **Advance Future (`t+1`) / Crystallize Canvas / Zoom In (`L+3`)** |
| **Trigger** | Single Push Click | `Mute` (`0xE2`) | **Commit & Execute Horizon / Re-Crystallize Fluid Spans / Lock Calibration** |
| **Axis 2 (CCW)** | **Hold Down + Rotate CCW** | `Brightness -` (`F14`) | **Previous JEV Choice Branch / Shift Architecture Vector / Prev Role Lens** |
| **Axis 2 (CW)** | **Hold Down + Rotate CW** | `Brightness +` (`F15`) | **Next JEV Choice Branch / Shift Architecture Vector / Next Role Lens** |

### Triple-Layer Zero-Config macOS Hardware Bridge (`macos-vk01-bridge/vk01_bridge.py`)
Works out-of-the-box with factory defaults over **Bluetooth (`ANTICATER_MINI`), 2.4GHz Wireless, or USB-C** without requiring third-party remapping software:
1. **`CGEventTap` (`ApplicationServices`)**: Intercepts `NSSystemDefined` media keys (`Volume +/-`, `Mute`, `Brightness +/-`, `F14`/`F15`) and **suppresses the macOS system Volume/Brightness popup HUD**.
2. **`IOHIDManager` (`IOKit`)**: Reads raw Consumer Control (`UsagePage 0x0C`) hardware reports (`0xE9`, `0xE0`, `0xE2`, `0x6F`, `0x70`) at `<1ms` latency with zero permissions.
3. **`CoreAudio` Output Listener**: Detects any Bluetooth/USB audio volume/mute delta and automatically restores baseline volume so the knob never hits a `0%` or `100%` dead-end.

---

## Quickstart

```bash
npm start
```

Then open **`http://localhost:4321`** in your browser.

### Keyboard & Trackpad Fallbacks (No Hardware Required to Test)
- **Axis 1 Rotate (CCW / CW)**: `[` / `]` or `←` / `→` (or scroll wheel over the CNC knob twin / `Option + Scroll` anywhere)
- **Axis 2 Push + Rotate (CCW / CW)**: `{` / `}` or `↑` / `↓` (or `Shift + Scroll`)
- **Single Click (Commit)**: `Space` (or click the CNC knob twin)
- **Cycle Active Target Noun**: `Tab`
