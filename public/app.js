// ============================================================================
// VECTR // ANTICATER VK01 BIMODAL AI OPERATING SURFACE
// Client Engine: Native macOS VK01 SSE Bridge + WebAudio EC11 Haptics +
// 1€ Filtered MediaPipe Iris Gaze + JEV System-1 + DiffusionGemma + Semantic Lens
// ============================================================================

// ----------------------------------------------------------------------------
// 1. One-Euro Filter for Jitter-Free 60FPS Webcam Gaze Tracking
// ----------------------------------------------------------------------------
class LowPassFilter {
  constructor(alpha, initVal = 0) {
    this.y = initVal;
    this.s = initVal;
    this.initialized = false;
    this.setAlpha(alpha);
  }
  setAlpha(alpha) {
    this.alpha = Math.max(0.0001, Math.min(1.0, alpha));
  }
  filter(value, alpha) {
    if (alpha !== undefined) this.setAlpha(alpha);
    let result;
    if (this.initialized) {
      result = this.alpha * value + (1.0 - this.alpha) * this.s;
    } else {
      result = value;
      this.initialized = true;
    }
    this.y = value;
    this.s = result;
    return result;
  }
  lastValue() {
    return this.y;
  }
}

class OneEuroFilter {
  constructor(freq = 60, minCutoff = 1.1, beta = 0.015, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPassFilter(this.alpha(minCutoff));
    this.dx = new LowPassFilter(this.alpha(dCutoff));
    this.lastTime = null;
  }
  alpha(cutoff) {
    const te = 1.0 / this.freq;
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }
  filter(value, timestampMs = performance.now()) {
    if (this.lastTime !== null && timestampMs > this.lastTime) {
      this.freq = 1000.0 / Math.max(1, timestampMs - this.lastTime);
    }
    this.lastTime = timestampMs;
    const dvalue = this.x.initialized ? (value - this.x.lastValue()) * this.freq : 0.0;
    const edvalue = this.dx.filter(dvalue, this.alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edvalue);
    return this.x.filter(value, this.alpha(cutoff));
  }
}

// ----------------------------------------------------------------------------
// 2. Precision Web Audio Synthesizer for EC11 Mechanical Rotary Detents
// ----------------------------------------------------------------------------
class TactileAudioEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }
  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
  playDetent(axis = 1, delta = 1) {
    if (!this.enabled) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Distinct mechanical click signature for Axis 1 vs Axis 2
      const baseFreq = axis === 1 ? (delta > 0 ? 185 : 155) : (delta > 0 ? 310 : 265);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.022);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(axis === 1 ? 950 : 1450, now);
      filter.Q.setValueAtTime(2.4, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch {
      // Ignore audio errors before user interaction
    }
  }
  playCommitClick() {
    if (!this.enabled) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.045);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Ignore
    }
  }
}

const audio = new TactileAudioEngine();

// ----------------------------------------------------------------------------
// 3. Domain Data: JEV System-1 Scenarios, DiffusionGemma Canvas, Semantic Lens
// ----------------------------------------------------------------------------
const JEV_SCENARIOS = {
  incident: {
    windowTitle: 'DOM STATE // prod-us-east-1.console.internal (14 indexed nodes)',
    latencyMs: 19.8,
    nodes: [
      { id: 'node-1', tag: '[1] button#drain-canary', label: 'Drain Canary Pod v4.18.2', value: 'p99 Latency: 1,420ms (ALERT)' },
      { id: 'node-2', tag: '[2] select#traffic-weight', label: 'Route Shift: Stable v4.18.1', value: 'Weight: 10% → 100%' },
      { id: 'node-3', tag: '[3] input#redis-flush-key', label: 'Invalidate Stale Shard Locks', value: 'Key:_shard:eu-central:lock*' },
      { id: 'node-4', tag: '[4] button#pagerduty-ack', label: 'Post RCA & Resolve Incident #892', value: 'SLO Burn Rate: 0.0% Restored' },
    ],
    branches: [
      {
        rank: 1,
        name: 'Zero-Downtime Canary Rollback',
        prob: 0.724,
        riskScore: 0.34,
        noulSafe: 0.974,
        steps: [
          { tLabel: 't0 // PRESENT', ms: 0, nodeIdx: 0, cursor: [26, 36], action: 'INSPECT #drain-canary (72.4%)' },
          { tLabel: 't+1 // +180ms', ms: 180, nodeIdx: 0, cursor: [28, 38], action: 'CLICK [1] Drain Canary v4.18.2', mutatedValue: 'Status: DRAINING (0 active reqs)' },
          { tLabel: 't+2 // +410ms', ms: 410, nodeIdx: 1, cursor: [74, 38], action: 'SELECT [2] Shift 100% → v4.18.1', mutatedValue: 'Weight: 100% STABLE (p99: 38ms)' },
          { tLabel: 't+3 // +690ms', ms: 690, nodeIdx: 2, cursor: [28, 78], action: 'CLICK [3] Purge Stale Locks', mutatedValue: 'Purged 142 orphaned shard leases' },
          { tLabel: 't+4 // +950ms', ms: 950, nodeIdx: 3, cursor: [74, 78], action: 'TYPE_TEXT [4] DiffusionGemma RCA', mutatedValue: 'RCA Drafted (256 tokens in 190ms)' },
          { tLabel: 't+5 // +1.1s', ms: 1120, nodeIdx: 3, cursor: [76, 80], action: 'COMMIT [4] Resolve Incident #892', mutatedValue: 'RESOLVED · p99 = 34ms · 0 Errors' },
        ],
      },
      {
        rank: 2,
        name: 'Live Hot-Patch & Scale Read Replicas',
        prob: 0.186,
        riskScore: 1.18,
        noulSafe: 0.842,
        steps: [
          { tLabel: 't0 // PRESENT', ms: 0, nodeIdx: 1, cursor: [70, 36], action: 'INSPECT #traffic-weight (18.6%)' },
          { tLabel: 't+1 // +210ms', ms: 210, nodeIdx: 1, cursor: [72, 38], action: 'SELECT [2] Clamp Canary at 5%', mutatedValue: 'Canary Clamped: 5% Shadow Traffic' },
          { tLabel: 't+2 // +480ms', ms: 480, nodeIdx: 2, cursor: [30, 76], action: 'TYPE_TEXT [3] Scale Pool +8 Nodes', mutatedValue: 'Replica Pool: 12 → 20 Ready' },
          { tLabel: 't+3 // +760ms', ms: 760, nodeIdx: 0, cursor: [28, 38], action: 'CLICK [1] Inject BPF Rate Filter', mutatedValue: 'BPF Filter Active · p99: 62ms' },
          { tLabel: 't+4 // +1.0s', ms: 1020, nodeIdx: 3, cursor: [74, 78], action: 'TYPE_TEXT [4] Attach Flamegraph', mutatedValue: 'Attached Trace #eb91a to PagerDuty' },
          { tLabel: 't+5 // +1.3s', ms: 1310, nodeIdx: 3, cursor: [76, 80], action: 'COMMIT [4] Close Incident #892', mutatedValue: 'MITIGATED · Hot-Patch Verified' },
        ],
      },
      {
        rank: 3,
        name: 'Regional Failover to eu-west-1 Standby',
        prob: 0.068,
        riskScore: 2.15,
        noulSafe: 0.685,
        steps: [
          { tLabel: 't0 // PRESENT', ms: 0, nodeIdx: 2, cursor: [26, 76], action: 'INSPECT #redis-flush-key (6.8%)' },
          { tLabel: 't+1 // +240ms', ms: 240, nodeIdx: 2, cursor: [28, 78], action: 'CLICK [3] Freeze Write Quorum', mutatedValue: 'Quorum Frozen (Seq #994812)' },
          { tLabel: 't+2 // +520ms', ms: 520, nodeIdx: 1, cursor: [74, 38], action: 'SELECT [2] BGP Anycast → eu-west-1', mutatedValue: 'DNS/Anycast Cutover: eu-west-1' },
          { tLabel: 't+3 // +840ms', ms: 840, nodeIdx: 0, cursor: [28, 38], action: 'CLICK [1] Terminate us-east Pod', mutatedValue: 'us-east-1 Isolated for Forensics' },
          { tLabel: 't+4 // +1.1s', ms: 1140, nodeIdx: 3, cursor: [74, 78], action: 'TYPE_TEXT [4] Notify StatusPage', mutatedValue: 'StatusPage Updated via DiffusionGemma' },
          { tLabel: 't+5 // +1.4s', ms: 1420, nodeIdx: 3, cursor: [76, 80], action: 'COMMIT [4] Finalize Failover', mutatedValue: 'FAILOVER COMPLETE · 0 Data Loss' },
        ],
      },
    ],
  },
  flights: {
    windowTitle: 'DOM STATE // flights.google.com/booking (jev-ultrafast mode · 24.1ms)',
    latencyMs: 24.1,
    nodes: [
      { id: 'node-1', tag: '[1] combobox#origin-dest', label: 'Route: Zürich (ZRH) → Tokyo (HND)', value: 'Depart: Oct 14 · Nonstop Filter' },
      { id: 'node-2', tag: '[2] card#flight-lx160', label: 'SWISS LX 160 · Boeing 777-300ER', value: '13:05 ZRH → 08:55+1 HND · CHF 1,140' },
      { id: 'node-3', tag: '[3] button#seat-4a-aisle', label: 'Cabin Seat Selection & Meal Spec', value: 'Seat 4A Window · Low-Latency Wi-Fi' },
      { id: 'node-4', tag: '[4] input#expense-memo', label: 'Corporate Policy & Expense Note', value: 'Awaiting DiffusionGemma justification' },
    ],
    branches: [
      {
        rank: 1,
        name: 'Direct SWISS LX160 + Auto-Expense Justification',
        prob: 0.812,
        riskScore: 0.22,
        noulSafe: 0.982,
        steps: [
          { tLabel: 't0 // PRESENT', ms: 0, nodeIdx: 0, cursor: [26, 36], action: 'INSPECT #origin-dest (81.2%)' },
          { tLabel: 't+1 // +150ms', ms: 150, nodeIdx: 0, cursor: [28, 38], action: 'CLICK [1] Lock Nonstop ZRH → HND', mutatedValue: 'Locked: ZRH → HND Direct Only' },
          { tLabel: 't+2 // +390ms', ms: 390, nodeIdx: 1, cursor: [74, 38], action: 'CLICK [2] Select SWISS LX 160', mutatedValue: 'Selected LX 160 (Saves 4h 20m)' },
          { tLabel: 't+3 // +610ms', ms: 610, nodeIdx: 2, cursor: [28, 78], action: 'SELECT [3] Reserve Seat 4A', mutatedValue: 'Seat 4A Confirmed + FastTrack' },
          { tLabel: 't+4 // +880ms', ms: 880, nodeIdx: 3, cursor: [74, 78], action: 'TYPE_TEXT [4] DiffusionGemma Memo', mutatedValue: 'Memo: "Keynote Hardware Demo Tokyo"' },
          { tLabel: 't+5 // +1.1s', ms: 1090, nodeIdx: 3, cursor: [76, 80], action: 'COMMIT [4] Hold Ticket & Sync Cal', mutatedValue: 'BOOKED · PNR #VK01AI · Calendar Synced' },
        ],
      },
      {
        rank: 2,
        name: 'ANA NH216 via Frankfurt (Star Alliance Upgrade)',
        prob: 0.142,
        riskScore: 0.65,
        noulSafe: 0.910,
        steps: [
          { tLabel: 't0 // PRESENT', ms: 0, nodeIdx: 1, cursor: [72, 36], action: 'INSPECT #flight-lx160 (14.2%)' },
          { tLabel: 't+1 // +190ms', ms: 190, nodeIdx: 0, cursor: [28, 38], action: 'SELECT [1] Include 1-Stop StarAlliance', mutatedValue: 'Route: ZRH → FRA → HND (ANA)' },
          { tLabel: 't+2 // +440ms', ms: 440, nodeIdx: 1, cursor: [74, 38], action: 'CLICK [2] Apply eVoucher Upgrade', mutatedValue: 'NH 216 Upgraded to Business Class' },
          { tLabel: 't+3 // +710ms', ms: 710, nodeIdx: 2, cursor: [28, 78], action: 'SELECT [3] Seat 2K (The Room)', mutatedValue: 'Suite 2K Locked · 0 CHF Fare Diff' },
          { tLabel: 't+4 // +960ms', ms: 960, nodeIdx: 3, cursor: [74, 78], action: 'TYPE_TEXT [4] Attach Voucher Audit', mutatedValue: 'Audit: "Zero net cost upgrade"' },
          { tLabel: 't+5 // +1.2s', ms: 1200, nodeIdx: 3, cursor: [76, 80], action: 'COMMIT [4] Issue Upgraded Ticket', mutatedValue: 'ISSUED · ANA NH216 Suite 2K' },
        ],
      },
    ],
  },
  procurement: {
    windowTitle: 'DOM STATE // compute-market.cloud/spot-bidding (19.1ms pass)',
    latencyMs: 19.1,
    nodes: [
      { id: 'node-1', tag: '[1] bid#h200-sxm-cluster', label: '64x H200 SXM5 Spot Allocation', value: 'Ask: $2.18/GPU/hr · us-west-2' },
      { id: 'node-2', tag: '[2] toggle#checkpoint-r2', label: 'Zero-Overhead R2 Weight Snapshotting', value: 'Interval: Every 15m (9.4 GB/s)' },
      { id: 'node-3', tag: '[3] select#fallback-region', label: 'Preemption Auto-Migrate Target', value: 'Standby: eu-north-1 ($1.94/hr)' },
      { id: 'node-4', tag: '[4] button#execute-lease', label: 'Sign Cryptographic Lease & Launch', value: 'Est. Run Cost: $1,116 (8h Training)' },
    ],
    branches: [
      {
        rank: 1,
        name: 'Lock $1.94 Arbitrage Split + R2 Continuous Sync',
        prob: 0.785,
        riskScore: 0.28,
        noulSafe: 0.968,
        steps: [
          { tLabel: 't0 // PRESENT', ms: 0, nodeIdx: 0, cursor: [26, 36], action: 'INSPECT #h200-sxm-cluster (78.5%)' },
          { tLabel: 't+1 // +160ms', ms: 160, nodeIdx: 0, cursor: [28, 38], action: 'CLICK [1] Bid Limit $1.98/GPU/hr', mutatedValue: 'Cleared: 64x H200 @ $1.96/GPU/hr' },
          { tLabel: 't+2 // +380ms', ms: 380, nodeIdx: 1, cursor: [74, 38], action: 'CLICK [2] Enable Async R2 Sharding', mutatedValue: 'R2 Streaming Checkpoint: ACTIVE' },
          { tLabel: 't+3 // +620ms', ms: 620, nodeIdx: 2, cursor: [28, 78], action: 'SELECT [3] Warm Standby eu-north-1', mutatedValue: 'Warm Failover Tunnel Ready (<2s)' },
          { tLabel: 't+4 // +890ms', ms: 890, nodeIdx: 3, cursor: [74, 78], action: 'TYPE_TEXT [4] Inject Job Manifest', mutatedValue: 'Manifest: DiffusionGemma-LoRA-Run4' },
          { tLabel: 't+5 // +1.1s', ms: 1080, nodeIdx: 3, cursor: [76, 80], action: 'COMMIT [4] Launch 64-GPU Cluster', mutatedValue: 'RUNNING · Saved $140.80 vs On-Demand' },
        ],
      },
      {
        rank: 2,
        name: 'Reserved Dedicated Block (Zero Preemption Risk)',
        prob: 0.215,
        riskScore: 0.08,
        noulSafe: 0.995,
        steps: [
          { tLabel: 't0 // PRESENT', ms: 0, nodeIdx: 0, cursor: [26, 36], action: 'INSPECT #h200-sxm-cluster (21.5%)' },
          { tLabel: 't+1 // +180ms', ms: 180, nodeIdx: 0, cursor: [28, 38], action: 'SELECT [1] Dedicated 24h Block', mutatedValue: 'Locked Dedicated SXM5 Fabric' },
          { tLabel: 't+2 // +420ms', ms: 420, nodeIdx: 1, cursor: [74, 38], action: 'CLICK [2] Checkpoint on Epoch End', mutatedValue: 'Epoch Checkpointing Configured' },
          { tLabel: 't+3 // +680ms', ms: 680, nodeIdx: 2, cursor: [28, 78], action: 'SELECT [3] Disable Cross-Region Hop', mutatedValue: 'Single-AZ InfiniBand 3.2Tbps Locked' },
          { tLabel: 't+4 // +910ms', ms: 910, nodeIdx: 3, cursor: [74, 78], action: 'TYPE_TEXT [4] Attach Budget Approval', mutatedValue: 'Approved: SLA 99.99% Uptime' },
          { tLabel: 't+5 // +1.1s', ms: 1150, nodeIdx: 3, cursor: [76, 80], action: 'COMMIT [4] Provision Dedicated Nodes', mutatedValue: 'PROVISIONED · 64/64 Nodes Healthy' },
        ],
      },
    ],
  },
};

// Target 3: Ladder of Abstraction (-3 to +3) across 4 Role Lenses
const SEMANTIC_LENS_LEVELS = [
  { level: -3, code: 'L-3 // CHIP', ratio: '6% tokens', title: '3-Word Semantic Essence' },
  { level: -2, code: 'L-2 // INTENT', ratio: '18% tokens', title: 'Single-Sentence Executive Intent' },
  { level: -1, code: 'L-1 // CONTRACT', ratio: '42% tokens', title: 'Type Signatures & Dataflow Invariants' },
  { level: 0, code: 'L0 // SOURCE', ratio: '100% baseline', title: 'Canonical Implementation' },
  { level: 1, code: 'L+1 // X-RAY', ratio: '145% tokens', title: 'Inline Runtime Values & Latency Telemetry' },
  { level: 2, code: 'L+2 // HARDENED', ratio: '210% tokens', title: 'Defensive Guards & Backpressure Recovery' },
  { level: 3, code: 'L+3 // FORMAL', ratio: '280% tokens', title: 'Adversarial Audit & Proof Obligations' },
];

const ROLE_LENSES = [
  'SYSTEMS ARCHITECT',
  'SECURITY AUDITOR',
  'PERFORMANCE PROFILER',
  'PRODUCT EXECUTIVE',
];

function renderAbstractionContent(levelIdx, roleIdx) {
  const role = ROLE_LENSES[roleIdx];
  const lvl = SEMANTIC_LENS_LEVELS[levelIdx].level;
  const anchor1 = `<span class="anchor-pin-token">dispatchSystemOne</span>`;
  const anchor2 = `<span class="anchor-pin-token">entropy_bound</span>`;
  const anchor3 = `<span class="anchor-pin-token">commitAction</span>`;

  if (lvl === -3) {
    return `${anchor1} → ${anchor2} → ${anchor3}   // [${role}: Calibrated 21ms Gate]`;
  }
  if (lvl === -2) {
    return `Evaluates live screen state via ${anchor1} in a single 21ms forward pass, locks tokens below ${anchor2}, and executes ${anchor3} when confidence exceeds clutch τ.`;
  }
  if (lvl === -1) {
    return `type SystemOneGate = (state: DomSnapshot, ${anchor2}: f32) => {\n  choice: CalibratedSimplex<Action>; //via ${anchor1}\n  noulSafe: Probability;\n  exec: () => Promise<typeof ${anchor3}>;\n};`;
  }
  if (lvl === 0) {
    return `export async function ${anchor1}(state: DomSnapshot, ${anchor2} = 0.10) {\n  const dist = await jevModel.forwardSinglePass(state);\n  if (dist.noul.safe >= state.clutchTau) {\n    const payload = diffusionGemma.denoiseBlock(dist.topChoice, ${anchor2});\n    return ${anchor3}(dist.topChoice.targetId, payload);\n  }\n  return dist.awaitRotaryConfirmation();\n}`;
  }
  if (lvl === 1) {
    return `export async function ${anchor1}(state: DomSnapshot /* 14 nodes, 1.8KB */, ${anchor2} = 0.10) {\n  // [${role}] Single forward pass: 21.4ms on Apple M-Series / H100\n  const dist = await jevModel.forwardSinglePass(state); // → p1=0.724, E[risk]=0.34\n  if (dist.noul.safe /* 0.974 */ >= state.clutchTau /* 0.75 */) {\n    // Parallel 256-token canvas @ 1,142 tok/s (locks 18.4 tokens/step)\n    const payload = diffusionGemma.denoiseBlock(dist.topChoice, ${anchor2});\n    return ${anchor3}(dist.topChoice.targetId, payload);\n  }\n  return dist.awaitRotaryConfirmation();\n}`;
  }
  if (lvl === 2) {
    return `export async function ${anchor1}(state: DomSnapshot, ${anchor2} = 0.10): Promise<CommitReceipt> {\n  assertValidDomEpoch(state.epochId, { maxStalenessMs: 50 });\n  const dist = await jevModel.forwardSinglePass(state);\n  if (dist.score.expectedRisk > 1.50) throw new HighBlastRadiusError(dist.score);\n  if (dist.noul.safe >= state.clutchTau) {\n    const payload = diffusionGemma.denoiseBlock(dist.topChoice, Math.min(0.25, ${anchor2}));\n    return await withIdempotentRollback(() => ${anchor3}(dist.topChoice.targetId, payload));\n  }\n  return dist.awaitRotaryConfirmation();\n}`;
  }
  return `// #[invariant(brier_calibration_error <= 0.008 && permutation_equivariant(choice))]\n// #[role_audit("${role}")]\nexport async function ${anchor1}(state: VerifiedDomState, ${anchor2}: NonNegF32 = 0.10) {\n  const dist = await jevModel.forwardSinglePass(state);\n  assert(Math.abs(dist.choice.sum() - 1.0) < 1e-6, "Simplex violation");\n  if (dist.noul.safe >= state.clutchTau && dist.score.expectedRisk <= state.maxRisk) {\n    const payload = diffusionGemma.denoiseBlockBounded(dist.topChoice, ${anchor2});\n    return ${anchor3}(dist.topChoice.targetId, payload.sealWitness());\n  }\n  return dist.awaitRotaryConfirmation();\n}`;
}

// ----------------------------------------------------------------------------
// 4. Central Application State
// ----------------------------------------------------------------------------
const state = {
  activeTarget: 'jev', // 'jev' | 'diffusion' | 'lens'
  knobAngleDeg: 0,
  isPushed: false,
  totalHidTicks: 0,

  // Target 1: JEV System-1 state
  jevScenarioKey: 'incident',
  jevTimeStep: 1, // 0..5 (t0..t+5)
  jevBranchIdx: 0,
  jevClutchTau: 0.75,
  jevCommittedStep: -1,

  // Target 2: DiffusionGemma state
  diffData: null,
  diffStep: 36, // 0..48 denoising steps
  diffSteeringIdx: 2, // 0..4 (-2 to +2)

  // Target 3: Semantic Lens state
  lensLevelIdx: 3, // 0..6 (L-3 to L+3, default L0 = index 3)
  lensRoleIdx: 0, // 0..3

  // Gaze & Calibration state
  webcamActive: false,
  calibrating: false,
  calibStep: 0,
  calibRawSamples: [],
  calibBounds: { minX: 0.35, maxX: 0.65, minY: 0.35, maxY: 0.65 },
  gazeX: window.innerWidth / 2,
  gazeY: window.innerHeight / 2,
};

// ----------------------------------------------------------------------------
// 5. Renderers for the Hardware Twin & Three Semantic Targets
// ----------------------------------------------------------------------------
function initKnobSvgTicks() {
  const svg = document.getElementById('vk01-tick-ring');
  if (!svg) return;
  const totalTicks = 24;
  let markup = '';
  for (let i = 0; i < totalTicks; i++) {
    const angle = (i * 360) / totalTicks - 90;
    const rad = (angle * Math.PI) / 180;
    const r1 = i % 3 === 0 ? 78 : 81;
    const r2 = 88;
    const x1 = 94 + r1 * Math.cos(rad);
    const y1 = 94 + r1 * Math.sin(rad);
    const x2 = 94 + r2 * Math.cos(rad);
    const y2 = 94 + r2 * Math.sin(rad);
    const stroke = i === 0 ? 'hsl(16, 90%, 54%)' : i % 3 === 0 ? 'hsl(210, 12%, 56%)' : 'hsl(210, 8%, 28%)';
    const width = i % 3 === 0 ? 2 : 1.2;
    markup += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" />`;
  }
  svg.innerHTML = markup;
}

function updateKnobVisual(axis, delta) {
  state.knobAngleDeg += delta * 15;
  const rotor = document.getElementById('vk01-cnc-rotor');
  const dialAssembly = document.getElementById('vk01-dial-interactive');
  const capMode = document.getElementById('knob-cap-mode');
  const capVal = document.getElementById('knob-cap-val');

  if (rotor) {
    rotor.style.setProperty('--knob-deg', `${state.knobAngleDeg}deg`);
    rotor.style.transform = `rotate(${state.knobAngleDeg}deg)`;
  }
  if (dialAssembly) {
    dialAssembly.classList.toggle('is-pushed', axis === 2);
    if (axis === 2) {
      clearTimeout(state._pushTimer);
      state._pushTimer = setTimeout(() => {
        dialAssembly.classList.remove('is-pushed');
      }, 420);
    }
  }
  if (capMode) {
    capMode.textContent = axis === 2 ? 'AXIS 2 // PUSH+TURN' : 'AXIS 1 // ROTATE';
  }
  if (capVal) {
    const normDeg = (((state.knobAngleDeg % 360) + 360) % 360);
    capVal.textContent = `${String(normDeg).padStart(3, '0')}°`;
  }

  // Flash the active gesture cell in the 5-gesture matrix
  const cellId =
    axis === 1
      ? delta > 0
        ? 'gest-cw'
        : 'gest-ccw'
      : delta > 0
      ? 'gest-push-cw'
      : 'gest-push-ccw';
  const cell = document.getElementById(cellId);
  if (cell) {
    const cls = axis === 2 ? 'flash-axis2' : 'flash-active';
    cell.classList.add(cls);
    setTimeout(() => cell.classList.remove(cls), 220);
  }
}

function updateBimodalContextBar() {
  const nounEl = document.getElementById('active-noun-label');
  const axis1El = document.getElementById('active-axis1-label');
  const axis2El = document.getElementById('active-axis2-label');
  const mapCcw = document.getElementById('map-lbl-ccw');
  const mapCw = document.getElementById('map-lbl-cw');
  const mapPccw = document.getElementById('map-lbl-pccw');
  const mapPcw = document.getElementById('map-lbl-pcw');
  const mapClick = document.getElementById('map-lbl-click');

  const cards = ['jev', 'diffusion', 'lens'];
  for (const id of cards) {
    const card = document.getElementById(`target-card-${id}`);
    const badge = document.getElementById(`lock-badge-${id}`);
    const isLocked = state.activeTarget === id;
    if (card) card.classList.toggle('gaze-locked', isLocked);
    if (badge) badge.textContent = isLocked ? '◎ GAZE LOCKED' : 'LOOK TO LOCK';
  }

  if (state.activeTarget === 'jev') {
    nounEl.textContent = '01 // CHRONOS & JEV-CLUTCH (COMPUTER USE)';
    axis1El.textContent = 'Scrub Speculative Future Horizon (t0 ↔ t+5)';
    axis2El.textContent = 'Switch JEV Choice Branch (Rank #1 ↔ #3)';
    mapCcw.textContent = '← Rewind Future (t-1)';
    mapCw.textContent = 'Scrub Future (t+1) →';
    mapPccw.textContent = '≪ Higher Rank Branch';
    mapPcw.textContent = 'Alt Choice Branch ≫';
    mapClick.textContent = '● COMMIT & EXECUTE HORIZON';
  } else if (state.activeTarget === 'diffusion') {
    nounEl.textContent = '02 // DIFFUSIONGEMMA 256-TOKEN CANVAS';
    axis1El.textContent = 'Scrub Denoising Step (t=0..48) & Entropy Lock η';
    axis2El.textContent = 'Steer Architecture Vector (-2 ↔ +2)';
    mapCcw.textContent = '← Melt High-Entropy Words';
    mapCw.textContent = 'Crystallize Canvas →';
    mapPccw.textContent = '≪ Shift Vector Left';
    mapPcw.textContent = 'Shift Vector Right ≫';
    mapClick.textContent = '● RE-CRYSTALLIZE FLUID SPANS';
  } else {
    nounEl.textContent = '03 // GAZE + DIAL SEMANTIC LENS';
    axis1El.textContent = 'Scrub Ladder of Abstraction (L-3 ↔ L+3)';
    axis2El.textContent = 'Rotate Role Persona Lens';
    mapCcw.textContent = '← Compress (Zoom Out)';
    mapCw.textContent = 'Expand (Zoom In) →';
    mapPccw.textContent = '≪ Prev Role Persona';
    mapPcw.textContent = 'Next Role Persona ≫';
    mapClick.textContent = '● LOCK ABSTRACTION STATE';
  }
}

// ----------------------------------------------------------------------------
// Target 1 Renderer: Chronos / JEV-Clutch
// ----------------------------------------------------------------------------
function renderJevTarget() {
  const scenario = JEV_SCENARIOS[state.jevScenarioKey];
  if (!scenario) return;
  const branchIdx = Math.min(state.jevBranchIdx, scenario.branches.length - 1);
  const branch = scenario.branches[branchIdx];
  const stepIdx = Math.max(0, Math.min(state.jevTimeStep, branch.steps.length - 1));
  const curStep = branch.steps[stepIdx];

  document.getElementById('jev-window-title').textContent = scenario.windowTitle;
  document.getElementById('jev-latency-val').textContent = `${scenario.latencyMs.toFixed(1)} ms`;
  document.getElementById('jev-horizon-clock').textContent = `${curStep.tLabel} // ${curStep.action}`;

  // Render Horizon Detent Pips
  const pipsEl = document.getElementById('jev-time-pips');
  pipsEl.innerHTML = branch.steps
    .map((s, idx) => {
      const cls = idx === stepIdx ? 'detent-pip active' : idx < stepIdx ? 'detent-pip past' : 'detent-pip';
      return `<button type="button" class="${cls}" data-jev-step="${idx}">${s.tLabel.split(' ')[0]}</button>`;
    })
    .join('');

  pipsEl.querySelectorAll('[data-jev-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTarget = 'jev';
      state.jevTimeStep = Number(btn.dataset.jevStep);
      audio.playDetent(1, 1);
      updateBimodalContextBar();
      renderJevTarget();
    });
  });

  // Render Live Indexed DOM Nodes with Speculative Future Mutations
  const domGrid = document.getElementById('jev-dom-grid');
  domGrid.innerHTML = scenario.nodes
    .map((node, nIdx) => {
      // Check if any step up to stepIdx mutated this node
      let displayedValue = node.value;
      let wasMutated = false;
      for (let s = 1; s <= stepIdx; s++) {
        if (branch.steps[s].nodeIdx === nIdx && branch.steps[s].mutatedValue) {
          displayedValue = branch.steps[s].mutatedValue;
          wasMutated = true;
        }
      }
      const isCurrentTarget = curStep.nodeIdx === nIdx;
      const isCommitted = state.jevCommittedStep >= stepIdx && wasMutated;
      const boxCls = [
        'dom-node-box',
        isCurrentTarget ? 'speculative-active' : '',
        isCommitted ? 'committed-done' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return `
        <div class="${boxCls}">
          <div class="dom-id-badge">
            <span>${node.tag}</span>
            <span>${isCurrentTarget ? '◀ JEV TARGET' : wasMutated ? '✓ MUTATED' : 'IDLE'}</span>
          </div>
          <div class="dom-label">${node.label}</div>
          <div class="dom-value">${displayedValue}</div>
        </div>
      `;
    })
    .join('');

  // Position Ghost Cursor Pin
  const ghostPin = document.getElementById('jev-ghost-pin');
  const ghostLabel = document.getElementById('jev-ghost-label');
  if (ghostPin && curStep.cursor) {
    ghostPin.style.left = `${curStep.cursor[0]}%`;
    ghostPin.style.top = `${curStep.cursor[1]}%`;
  }
  if (ghostLabel) {
    ghostLabel.textContent = curStep.action;
  }

  // Render JEV Choice Probability Bars
  const choiceBarsEl = document.getElementById('jev-choice-bars');
  choiceBarsEl.innerHTML = scenario.branches
    .map((b, idx) => {
      const pct = (b.prob * 100).toFixed(1);
      const isSel = idx === branchIdx;
      return `
        <div class="choice-bar-row ${isSel ? 'selected-branch' : ''}" data-branch-idx="${idx}">
          <div class="choice-bar-meta">
            <span>#${b.rank} ${b.name}</span>
            <strong>${pct}%</strong>
          </div>
          <div class="choice-bar-track">
            <div class="choice-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    })
    .join('');

  choiceBarsEl.querySelectorAll('[data-branch-idx]').forEach((row) => {
    row.addEventListener('click', () => {
      state.activeTarget = 'jev';
      state.jevBranchIdx = Number(row.dataset.branchIdx);
      audio.playDetent(2, 1);
      updateBimodalContextBar();
      renderJevTarget();
    });
  });

  document.getElementById('jev-active-branch-lbl').textContent = `BRANCH #${branch.rank} (${(branch.prob * 100).toFixed(1)}%)`;
  document.getElementById('jev-score-val').textContent = `${branch.riskScore.toFixed(2)} / 4.00`;
  const noulEl = document.getElementById('jev-noul-val');
  const safePct = (branch.noulSafe * 100).toFixed(1);
  const passesGate = branch.noulSafe >= state.jevClutchTau;
  noulEl.textContent = `${safePct}% ${passesGate ? '≥' : '<'} τ(${state.jevClutchTau.toFixed(2)})`;
  noulEl.style.color = passesGate ? 'var(--signal-emerald)' : 'var(--signal-amber)';
}

// ----------------------------------------------------------------------------
// Target 2 Renderer: DiffusionGemma 26B-A4B Entropy Sculptor
// ----------------------------------------------------------------------------
async function loadDiffusionCanvas(customPrompt) {
  try {
    const res = await fetch('/api/ai/diffusiongemma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: customPrompt }),
    });
    state.diffData = await res.json();
    renderDiffusionTarget();
  } catch (err) {
    console.error('Failed to load DiffusionGemma canvas:', err);
  }
}

function renderDiffusionTarget() {
  if (!state.diffData) return;
  const variants = state.diffData.steeringVariants;
  const vIdx = Math.max(0, Math.min(state.diffSteeringIdx, variants.length - 1));
  const variant = variants[vIdx];

  // Map denoising step (0..48) to entropy threshold eta (0.02..0.95)
  // Higher step = more crystallized (higher threshold locked). Turning CCW melts high-entropy tokens!
  const progress = state.diffStep / 48;
  const eta = 0.04 + progress * 0.88;

  document.getElementById('diff-step-num').textContent = `${state.diffStep}/48`;
  document.getElementById('diff-eta-num').textContent = eta.toFixed(2);
  document.getElementById('diff-steering-badge').textContent = `AXIS 2: ${variant.label}`;

  // Step pips (8 coarse buckets representing 0..48 steps)
  const stepPips = document.getElementById('diffusion-step-pips');
  const buckets = [4, 12, 20, 28, 36, 42, 48];
  stepPips.innerHTML = buckets
    .map((stepVal) => {
      const isAct = Math.abs(state.diffStep - stepVal) <= 3;
      const isPast = state.diffStep > stepVal + 3;
      const cls = isAct ? 'detent-pip active' : isPast ? 'detent-pip past' : 'detent-pip';
      return `<button type="button" class="${cls}" data-diff-step="${stepVal}">t=${stepVal}</button>`;
    })
    .join('');

  stepPips.querySelectorAll('[data-diff-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTarget = 'diffusion';
      state.diffStep = Number(btn.dataset.diffStep);
      audio.playDetent(1, 1);
      updateBimodalContextBar();
      renderDiffusionTarget();
    });
  });

  // Render tokens with posterior entropy H(x_i) vs threshold eta
  const canvasBox = document.getElementById('diffusion-canvas-box');
  canvasBox.innerHTML = variant.tokens
    .map((tok, idx) => {
      const isLocked = tok.h <= eta;
      const isRecentlyCrystallized = isLocked && tok.h > 0.35;
      if (isLocked) {
        const cls = isRecentlyCrystallized ? 'diff-token crystallized' : 'diff-token locked-anchor';
        return `<span class="${cls}">${escapeHtml(tok.t)}</span>`;
      } else {
        // Token has H(x_i) > eta: it is melted / in discrete diffusion superposition!
        const alts = tok.alts || ['[MASK]', '...', tok.t];
        const cycleIdx = (state.diffStep + idx) % alts.length;
        const activeSuperposition = alts[cycleIdx];
        const tooltip = `H=${tok.h.toFixed(2)} > η(${eta.toFixed(2)}) | Superposition: ${alts.join(' ∥ ')}`;
        return `<span class="diff-token fluid-entropy" data-alts="${escapeHtml(tooltip)}">⟪${escapeHtml(activeSuperposition)}⟫</span>`;
      }
    })
    .join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ----------------------------------------------------------------------------
// Target 3 Renderer: Gaze + Dial Semantic Lens (-3 to +3)
// ----------------------------------------------------------------------------
function renderLensTarget() {
  const levelObj = SEMANTIC_LENS_LEVELS[state.lensLevelIdx];
  const role = ROLE_LENSES[state.lensRoleIdx];

  const pipsEl = document.getElementById('lens-level-pips');
  pipsEl.innerHTML = SEMANTIC_LENS_LEVELS.map((item, idx) => {
    const cls = idx === state.lensLevelIdx ? 'detent-pip active' : 'detent-pip';
    const shortCode = item.code.split(' ')[0];
    return `<button type="button" class="${cls}" data-lens-idx="${idx}">${shortCode}</button>`;
  }).join('');

  pipsEl.querySelectorAll('[data-lens-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTarget = 'lens';
      state.lensLevelIdx = Number(btn.dataset.lensIdx);
      audio.playDetent(1, 1);
      updateBimodalContextBar();
      renderLensTarget();
    });
  });

  const contentEl = document.getElementById('abstraction-morph-content');
  contentEl.innerHTML = renderAbstractionContent(state.lensLevelIdx, state.lensRoleIdx);

  document.getElementById('lens-role-badge').textContent = `ROLE LENS (AXIS 2): ${role}`;
  document.getElementById('lens-compression-delta').textContent = `${levelObj.code} · ${levelObj.ratio}`;
}

// ----------------------------------------------------------------------------
// 6. Unified VK01 Hardware Event Router (Handles all 5 Native Gestures!)
// ----------------------------------------------------------------------------
function logHidEvent(evt) {
  state.totalHidTicks += 1;
  const counterBadge = document.getElementById('hid-counter-badge');
  if (counterBadge) counterBadge.textContent = `${state.totalHidTicks} TICKS`;

  const led = document.getElementById('vk01-status-led');
  if (led) {
    led.classList.add('pulse');
    setTimeout(() => led.classList.remove('pulse'), 160);
  }

  const list = document.getElementById('hid-log-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'hid-log-entry';
  row.innerHTML = `
    <span>${escapeHtml(evt.gesture || evt.type)}</span>
    <span class="evt-src">${escapeHtml(evt.source || 'vk01')}</span>
  `;
  list.prepend(row);
  while (list.children.length > 6) {
    list.removeChild(list.lastChild);
  }
}

function handleVK01Rotate(axis, delta, source = 'vk01_hid', gestureLabel = '') {
  audio.playDetent(axis, delta);
  updateKnobVisual(axis, delta);
  logHidEvent({
    type: 'rotate',
    axis,
    delta,
    gesture: gestureLabel || (axis === 1 ? `Axis 1 Rotate (${delta > 0 ? '+1 CW' : '-1 CCW'})` : `Axis 2 Push+Rotate (${delta > 0 ? '+1 CW' : '-1 CCW'})`),
    source,
  });

  if (state.activeTarget === 'jev') {
    const scenario = JEV_SCENARIOS[state.jevScenarioKey];
    const branch = scenario.branches[state.jevBranchIdx];
    if (axis === 1) {
      // Scrub Speculative Future Horizon t0 .. t+5
      state.jevTimeStep = Math.max(0, Math.min(branch.steps.length - 1, state.jevTimeStep + delta));
    } else {
      // Axis 2 (Push + Rotate): Cycle JEV Choice probability branches
      const count = scenario.branches.length;
      state.jevBranchIdx = (state.jevBranchIdx + delta + count) % count;
    }
    renderJevTarget();
  } else if (state.activeTarget === 'diffusion') {
    if (axis === 1) {
      // Scrub Denoising Step (0..48) in increments of 4 steps per detent
      state.diffStep = Math.max(0, Math.min(48, state.diffStep + delta * 4));
    } else {
      // Axis 2 (Push + Rotate): Steer Semantic Conditioning Vector (-2 to +2)
      const count = state.diffData ? state.diffData.steeringVariants.length : 5;
      state.diffSteeringIdx = (state.diffSteeringIdx + delta + count) % count;
    }
    renderDiffusionTarget();
  } else if (state.activeTarget === 'lens') {
    if (axis === 1) {
      // Scrub Ladder of Abstraction (L-3 to L+3)
      state.lensLevelIdx = Math.max(
        0,
        Math.min(SEMANTIC_LENS_LEVELS.length - 1, state.lensLevelIdx + delta)
      );
    } else {
      // Axis 2 (Push + Rotate): Rotate Role Persona Lens
      state.lensRoleIdx = (state.lensRoleIdx + delta + ROLE_LENSES.length) % ROLE_LENSES.length;
    }
    renderLensTarget();
  }
}

function handleVK01Click(source = 'vk01_hid', gestureLabel = 'Single Click (Commit)') {
  audio.playCommitClick();

  const clickCell = document.getElementById('gest-click');
  if (clickCell) {
    clickCell.classList.add('flash-active');
    setTimeout(() => clickCell.classList.remove('flash-active'), 260);
  }

  logHidEvent({
    type: 'click',
    axis: 0,
    delta: 0,
    gesture: gestureLabel,
    source,
  });

  // If 4-Point Gaze Calibration is open, clicking the physical VK01 knob records the calibration anchor!
  if (state.calibrating) {
    captureCalibrationPoint();
    return;
  }

  const applyCommit = () => {
    if (state.activeTarget === 'jev') {
      state.jevCommittedStep = state.jevTimeStep;
      renderJevTarget();
    } else if (state.activeTarget === 'diffusion') {
      // Parallel Re-Crystallization Burst: animate denoising to step 48!
      state.diffStep = 48;
      renderDiffusionTarget();
    } else if (state.activeTarget === 'lens') {
      renderLensTarget();
    }
  };

  if (document.startViewTransition) {
    const transition = document.startViewTransition(() => applyCommit());
    transition.finished.finally(() => {
      document.getElementById(`target-card-${state.activeTarget}`)?.focus({ preventScroll: true });
    });
  } else {
    applyCommit();
    document.getElementById(`target-card-${state.activeTarget}`)?.focus({ preventScroll: true });
  }
}

// ----------------------------------------------------------------------------
// 7. Connect to Native macOS VK01 Bridge SSE Stream + Browser Input Listeners
// ----------------------------------------------------------------------------
function connectVK01BridgeStream() {
  const evtSource = new EventSource('/api/vk01/stream');
  const statusText = document.getElementById('vk01-bridge-status-text');
  const layerBadge = document.getElementById('vk01-layer-badge');

  evtSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'bridge_hello') {
        if (statusText) statusText.textContent = 'VK01 BRIDGE: 3-LAYER ACTIVE';
        if (layerBadge && data.bridgeState?.hudSuppressionActive) {
          layerBadge.textContent = 'HUD SUPPRESSED · 0ms';
        }
        return;
      }
      if (data.type === 'status') {
        logHidEvent(data);
        return;
      }
      if (data.type === 'rotate') {
        handleVK01Rotate(data.axis || 1, data.delta || 1, data.source, data.gesture);
      } else if (data.type === 'click') {
        handleVK01Click(data.source, data.gesture);
      }
    } catch {
      // Ignore malformed message
    }
  };

  evtSource.onerror = () => {
    if (statusText) statusText.textContent = 'VK01 BRIDGE: LOCAL FALLBACK';
  };
}

function bindUniversalInputControls() {
  // 1. Clickable 5-Gesture Matrix buttons
  document.getElementById('gest-ccw')?.addEventListener('click', () => handleVK01Rotate(1, -1, 'ui_panel'));
  document.getElementById('gest-cw')?.addEventListener('click', () => handleVK01Rotate(1, 1, 'ui_panel'));
  document.getElementById('gest-push-ccw')?.addEventListener('click', () => handleVK01Rotate(2, -1, 'ui_panel'));
  document.getElementById('gest-push-cw')?.addEventListener('click', () => handleVK01Rotate(2, 1, 'ui_panel'));
  document.getElementById('gest-click')?.addEventListener('click', () => handleVK01Click('ui_panel'));
  document.getElementById('btn-jev-commit')?.addEventListener('click', () => {
    state.activeTarget = 'jev';
    updateBimodalContextBar();
    handleVK01Click('ui_commit');
  });

  // 2. Interactive CNC Rotary Knob Drag & Wheel
  const dial = document.getElementById('vk01-dial-interactive');
  let dragging = false;
  let dragStartY = 0;
  let dragMoved = false;

  dial?.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartY = e.clientY;
    dragMoved = false;
    dial.setPointerCapture(e.pointerId);
  });

  dial?.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = dragStartY - e.clientY;
    if (Math.abs(dy) >= 14) {
      dragMoved = true;
      const delta = dy > 0 ? 1 : -1;
      const axis = e.shiftKey || e.altKey || e.buttons === 2 ? 2 : 1;
      handleVK01Rotate(axis, delta, 'cnc_twin_drag');
      dragStartY = e.clientY;
    }
  });

  dial?.addEventListener('pointerup', () => {
    if (dragging && !dragMoved) {
      handleVK01Click('cnc_twin_click');
    }
    dragging = false;
  });

  // 3. Wheel scrubbing over the CNC Knob or when holding Alt/Option anywhere
  let lastWheelTime = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      const onDial = dial && dial.contains(e.target);
      if (!onDial && !e.altKey) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheelTime < 45) return;
      lastWheelTime = now;
      const delta = e.deltaY < 0 || e.deltaX > 0 ? 1 : -1;
      const axis = e.shiftKey ? 2 : 1;
      handleVK01Rotate(axis, delta, 'wheel_encoder');
    },
    { passive: false }
  );

  // 4. Global Keyboard & Media-Key Listeners (when typing is not focused)
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    if (e.key === 'AudioVolumeUp' || e.key === ']' || e.key === 'ArrowRight') {
      e.preventDefault();
      handleVK01Rotate(e.shiftKey ? 2 : 1, 1, 'keyboard_hid', `Key ${e.key}`);
    } else if (e.key === 'AudioVolumeDown' || e.key === '[' || e.key === 'ArrowLeft') {
      e.preventDefault();
      handleVK01Rotate(e.shiftKey ? 2 : 1, -1, 'keyboard_hid', `Key ${e.key}`);
    } else if (e.key === 'F15' || e.key === '}' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleVK01Rotate(2, 1, 'keyboard_hid', `Axis 2 (${e.key})`);
    } else if (e.key === 'F14' || e.key === '{' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleVK01Rotate(2, -1, 'keyboard_hid', `Axis 2 (${e.key})`);
    } else if (e.key === 'AudioVolumeMute' || e.key === ' ') {
      e.preventDefault();
      handleVK01Click('keyboard_hid', `Click (${e.key === ' ' ? 'Space' : e.key})`);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      cycleActiveTargetNoun();
    } else if (e.key === 'Escape' && state.calibrating) {
      closeCalibrationModal();
    }
  });

  // 5. Magnetic Target Selection on Hover / Gaze / Click
  ['jev', 'diffusion', 'lens'].forEach((id) => {
    const card = document.getElementById(`target-card-${id}`);
    card?.addEventListener('pointerenter', () => {
      if (!state.webcamActive && state.activeTarget !== id) {
        state.activeTarget = id;
        updateBimodalContextBar();
      }
    });
    card?.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select')) return;
      if (state.activeTarget !== id) {
        state.activeTarget = id;
        updateBimodalContextBar();
      }
    });
  });

  // 6. Scenario selector & custom DiffusionGemma prompt form
  document.getElementById('jev-scenario-select')?.addEventListener('change', (e) => {
    state.jevScenarioKey = e.target.value;
    state.jevTimeStep = 1;
    state.jevBranchIdx = 0;
    state.jevCommittedStep = -1;
    renderJevTarget();
  });

  document.getElementById('form-custom-diffusion')?.addEventListener('submit', (e) => {
    e.preventDefault();
    state.activeTarget = 'diffusion';
    updateBimodalContextBar();
    const promptVal = document.getElementById('input-diffusion-prompt')?.value;
    loadDiffusionCanvas(promptVal);
  });

  document.getElementById('btn-cycle-target')?.addEventListener('click', () => {
    cycleActiveTargetNoun();
  });

  document.getElementById('btn-toggle-audio')?.addEventListener('click', () => {
    audio.enabled = !audio.enabled;
    const lbl = document.getElementById('audio-toggle-label');
    if (lbl) lbl.textContent = audio.enabled ? '🔊 DETENT AUDIO: ON' : '🔇 DETENT AUDIO: OFF';
  });
}

function cycleActiveTargetNoun() {
  const order = ['jev', 'diffusion', 'lens'];
  const nextIdx = (order.indexOf(state.activeTarget) + 1) % order.length;
  state.activeTarget = order[nextIdx];
  audio.playDetent(2, 1);
  updateBimodalContextBar();
}

// ----------------------------------------------------------------------------
// 8. Live Webcam Iris Gaze Tracking (MediaPipe FaceLandmarker + 1€ Filter)
// ----------------------------------------------------------------------------
const filterX = new OneEuroFilter(60, 0.9, 0.015, 1.0);
const filterY = new OneEuroFilter(60, 0.9, 0.015, 1.0);
let faceLandmarker = null;
let rawIrisRatio = { x: 0.5, y: 0.5 };

async function startWebcamGaze() {
  const video = document.getElementById('webcam-video');
  const placeholder = document.getElementById('webcam-placeholder');
  const modeTag = document.getElementById('gaze-mode-tag');
  const toggleBtn = document.getElementById('btn-toggle-gaze');
  const calibBtn = document.getElementById('btn-calibrate-gaze');
  const reticle = document.getElementById('gaze-reticle-hud');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    if (placeholder) placeholder.style.display = 'none';
    if (modeTag) modeTag.textContent = 'LOADING MEDIAPIPE...';

    // Load MediaPipe Tasks Vision from CDN
    const visionModule = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
    );
    const { FaceLandmarker, FilesetResolver } = visionModule;
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: false,
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    state.webcamActive = true;
    if (modeTag) modeTag.textContent = '60FPS IRIS 1€ LOCK';
    if (toggleBtn) {
      toggleBtn.classList.add('active-gaze');
      toggleBtn.innerHTML = '<span>◎ WEBCAM GAZE: ACTIVE</span>';
    }
    if (calibBtn) calibBtn.style.display = 'inline-flex';
    if (reticle) reticle.classList.add('visible');

    requestAnimationFrame(processWebcamFrame);
  } catch (err) {
    console.warn('Webcam Gaze initialization error:', err);
    if (modeTag) modeTag.textContent = 'POINTER FALLBACK';
  }
}

function processWebcamFrame() {
  if (!state.webcamActive || !faceLandmarker) return;
  const video = document.getElementById('webcam-video');
  const canvas = document.getElementById('webcam-overlay-canvas');
  if (video && video.readyState >= 2) {
    const nowMs = performance.now();
    const result = faceLandmarker.detectForVideo(video, nowMs);
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const lm = result.faceLandmarks[0];
      // MediaPipe Left Iris center = 468, Right Iris center = 473
      const leftIris = lm[468] || lm[159];
      const rightIris = lm[473] || lm[386];
      const noseTip = lm[1];

      // Draw iris telemetry overlay on webcam preview
      ctx.strokeStyle = '#F9A825';
      ctx.lineWidth = 2;
      [leftIris, rightIris].forEach((pt) => {
        if (!pt) return;
        ctx.beginPath();
        ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 6, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Combine iris + head pose for responsive screen-space gaze vector
      const rawX = 1.0 - (leftIris.x * 0.35 + rightIris.x * 0.35 + noseTip.x * 0.30);
      const rawY = leftIris.y * 0.35 + rightIris.y * 0.35 + noseTip.y * 0.30;
      rawIrisRatio = { x: rawX, y: rawY };

      const b = state.calibBounds;
      const normX = Math.max(0, Math.min(1, (rawX - b.minX) / Math.max(0.05, b.maxX - b.minX)));
      const normY = Math.max(0, Math.min(1, (rawY - b.minY) / Math.max(0.05, b.maxY - b.minY)));

      state.gazeX = filterX.filter(normX * window.innerWidth, nowMs);
      state.gazeY = filterY.filter(normY * window.innerHeight, nowMs);

      const reticle = document.getElementById('gaze-reticle-hud');
      if (reticle) {
        reticle.style.left = `${state.gazeX.toFixed(1)}px`;
        reticle.style.top = `${state.gazeY.toFixed(1)}px`;
      }

      // Magnetic Snapping to the Gazed Semantic Target Card
      if (!state.calibrating) {
        const elem = document.elementFromPoint(state.gazeX, state.gazeY);
        const card = elem?.closest('[data-target-id]');
        if (card) {
          const targetId = card.dataset.targetId;
          if (targetId && targetId !== state.activeTarget) {
            state.activeTarget = targetId;
            updateBimodalContextBar();
          }
        }
      }
    }
  }
  requestAnimationFrame(processWebcamFrame);
}

// 4-Corner Look + VK01 Click Calibration
const CALIB_COORDS = [
  { top: '14%', left: '14%', label: '1/4' },
  { top: '14%', left: '86%', label: '2/4' },
  { top: '84%', left: '86%', label: '3/4' },
  { top: '84%', left: '14%', label: '4/4' },
];

function openCalibrationModal() {
  state.calibrating = true;
  state.calibStep = 0;
  state.calibRawSamples = [];
  document.getElementById('calibration-modal')?.classList.add('open');
  updateCalibrationPointPosition();
}

function closeCalibrationModal() {
  state.calibrating = false;
  document.getElementById('calibration-modal')?.classList.remove('open');
}

function updateCalibrationPointPosition() {
  const pt = document.getElementById('calib-point-target');
  const cfg = CALIB_COORDS[state.calibStep];
  if (pt && cfg) {
    pt.style.top = cfg.top;
    pt.style.left = cfg.left;
    pt.textContent = cfg.label;
  }
}

function captureCalibrationPoint() {
  state.calibRawSamples.push({ ...rawIrisRatio });
  state.calibStep += 1;
  if (state.calibStep >= CALIB_COORDS.length) {
    const xs = state.calibRawSamples.map((s) => s.x);
    const ys = state.calibRawSamples.map((s) => s.y);
    state.calibBounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
    closeCalibrationModal();
  } else {
    updateCalibrationPointPosition();
  }
}

// ----------------------------------------------------------------------------
// 9. Bootstrapping
// ----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initKnobSvgTicks();
  updateBimodalContextBar();
  renderJevTarget();
  loadDiffusionCanvas('Zero-copy lock-free ring buffer with backpressure gate');
  renderLensTarget();
  connectVK01BridgeStream();
  bindUniversalInputControls();

  document.getElementById('btn-toggle-gaze')?.addEventListener('click', () => {
    if (!state.webcamActive) startWebcamGaze();
  });
  document.getElementById('btn-start-webcam-inline')?.addEventListener('click', () => {
    if (!state.webcamActive) startWebcamGaze();
  });
  document.getElementById('btn-calibrate-gaze')?.addEventListener('click', () => {
    openCalibrationModal();
  });
  document.getElementById('btn-cancel-calib')?.addEventListener('click', () => {
    closeCalibrationModal();
  });
  document.getElementById('calib-point-target')?.addEventListener('click', () => {
    handleVK01Click('calib_click');
  });
});
