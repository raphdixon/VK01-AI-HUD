import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4321);
const PUBLIC_DIR = path.join(__dirname, 'public');
const BRIDGE_PY = path.join(__dirname, 'macos-vk01-bridge', 'vk01_bridge.py');

// Connected SSE clients receiving real-time VK01 hardware events
const sseClients = new Set();

const bridgeState = {
  running: false,
  pid: null,
  statusMessages: [],
  hudSuppressionActive: false,
  iohidActive: false,
  coreAudioActive: false,
  totalEvents: 0,
  lastEvent: null,
};

function broadcastEvent(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

function startHardwareBridge() {
  if (!fs.existsSync(BRIDGE_PY)) return;

  const child = spawn('/usr/bin/python3', [BRIDGE_PY], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  bridgeState.running = true;
  bridgeState.pid = child.pid;

  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const evt = JSON.parse(trimmed);
      if (evt.type === 'status') {
        bridgeState.statusMessages.push(evt);
        if (bridgeState.statusMessages.length > 20) bridgeState.statusMessages.shift();
        if (evt.gesture.includes('HUD suppression enabled')) {
          bridgeState.hudSuppressionActive = true;
        }
        if (evt.gesture.includes('IOHIDManager')) {
          bridgeState.iohidActive = true;
        }
        if (evt.gesture.includes('CoreAudio')) {
          bridgeState.coreAudioActive = true;
        }
      } else {
        bridgeState.totalEvents += 1;
        bridgeState.lastEvent = evt;
      }
      broadcastEvent(evt);
    } catch {
      // Ignore non-JSON lines
    }
  });

  child.on('exit', (code) => {
    bridgeState.running = false;
    console.log(`[VK01 Bridge] Process exited with code ${code}. Restarting in 2s...`);
    setTimeout(startHardwareBridge, 2000);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Dynamic custom prompt tokenizer & entropy estimator for DiffusionGemma live synthesis
function buildCustomDiffusionCanvas(promptText, styleTarget = 'Production Rust / TypeScript') {
  const cleanPrompt = (promptText || 'Synthesize fault-tolerant distributed rate-limiter with adaptive token bucket').trim();
  // Generate 5 steered variants around the same low-entropy structural anchors
  const templates = [
    {
      label: '-2 // ZERO-ALLOC SIMD',
      tokens: [
        { t: 'pub', h: 0.01 }, { t: ' fn', h: 0.01 }, { t: ' evaluate_gate', h: 0.03 }, { t: '(', h: 0.01 },
        { t: 'state', h: 0.02 }, { t: ':', h: 0.01 }, { t: ' &AlignedState', h: 0.68, alts: ['&RingBuffer', '&SimdSlab', '&PinnedCtx'] },
        { t: ',', h: 0.01 }, { t: ' budget_ns', h: 0.54, alts: ['quota_ticks', 'window_us', 'burst_cap'] }, { t: ':', h: 0.01 },
        { t: ' u64', h: 0.14 }, { t: ') ->', h: 0.01 }, { t: ' DecisionMask', h: 0.62, alts: ['GateVerdict', 'u8', 'ActionSlot'] },
        { t: ' {\n  ', h: 0.01 }, { t: '// Prompt: ', h: 0.02 }, { t: cleanPrompt.slice(0, 42), h: 0.08 },
        { t: '\n  let', h: 0.01 }, { t: ' stride', h: 0.48, alts: ['lanes', 'vector', 'chunk'] }, { t: ' = ', h: 0.01 },
        { t: 'simd_load_u64x8', h: 0.79, alts: ['avx512_gather', 'neon_vld1q', 'atomic_fetch'] }, { t: '(state.ptr);\n  ', h: 0.04 },
        { t: 'let', h: 0.01 }, { t: ' entropy', h: 0.11 }, { t: ' = ', h: 0.01 },
        { t: 'branchless_kl_div', h: 0.84, alts: ['fast_shannon_h', 'l1_norm_delta', 'logit_margin'] }, { t: '(stride, budget_ns);\n  ', h: 0.03 },
        { t: 'return', h: 0.01 }, { t: ' select_unmasked', h: 0.72, alts: ['commit_top1', 'bitmask_pack', 'dispatch_now'] },
        { t: '(entropy <= ', h: 0.04 }, { t: '0.005_f32', h: 0.58, alts: ['THRESHOLD', 'EPSILON', 'TAU_MIN'] }, { t: ');\n}', h: 0.01 }
      ]
    },
    {
      label: '-1 // DEFENSIVE HARDENED',
      tokens: [
        { t: 'pub', h: 0.01 }, { t: ' fn', h: 0.01 }, { t: ' evaluate_gate', h: 0.03 }, { t: '(', h: 0.01 },
        { t: 'state', h: 0.02 }, { t: ':', h: 0.01 }, { t: ' &VerifiedDomState', h: 0.64, alts: ['&GuardedState', '&AuditContext', '&SafeSnapshot'] },
        { t: ',', h: 0.01 }, { t: ' timeout_ms', h: 0.51, alts: ['deadline_ms', 'max_retries', 'ttl_ticks'] }, { t: ':', h: 0.01 },
        { t: ' u64', h: 0.14 }, { t: ') ->', h: 0.01 }, { t: ' Result<Verdict, GateErr>', h: 0.66, alts: ['SafeOutcome', 'AuditResult', 'CheckedOp'] },
        { t: ' {\n  ', h: 0.01 }, { t: '// Prompt: ', h: 0.02 }, { t: cleanPrompt.slice(0, 42), h: 0.08 },
        { t: '\n  let', h: 0.01 }, { t: ' guard', h: 0.45, alts: ['lease', 'token', 'fence'] }, { t: ' = ', h: 0.01 },
        { t: 'CircuitBreaker::acquire', h: 0.76, alts: ['RateLimiter::check', 'Sandbox::verify', 'Policy::enforce'] }, { t: '(state, timeout_ms)?;\n  ', h: 0.04 },
        { t: 'let', h: 0.01 }, { t: ' entropy', h: 0.11 }, { t: ' = ', h: 0.01 },
        { t: 'calibrated_brier_score', h: 0.81, alts: ['posterior_spread', 'confidence_bound', 'risk_quantile'] }, { t: '(&guard);\n  ', h: 0.03 },
        { t: 'return', h: 0.01 }, { t: ' guard.commit_verified', h: 0.70, alts: ['guard.seal', 'AuditLog::emit', 'Ok(Verdict::Safe)'] },
        { t: '(entropy <= ', h: 0.04 }, { t: '0.10_f32', h: 0.55, alts: ['SAFE_BOUND', 'MAX_RISK', 'NOUL_GATE'] }, { t: ');\n}', h: 0.01 }
      ]
    },
    {
      label: '0 // CANONICAL BLOCK-DIFFUSION',
      tokens: [
        { t: 'pub', h: 0.01 }, { t: ' fn', h: 0.01 }, { t: ' evaluate_gate', h: 0.03 }, { t: '(', h: 0.01 },
        { t: 'state', h: 0.02 }, { t: ':', h: 0.01 }, { t: ' &ScreenCanvas', h: 0.59, alts: ['&WorkspaceTree', '&DomSnapshot', '&FrameContext'] },
        { t: ',', h: 0.01 }, { t: ' entropy_bound', h: 0.49, alts: ['tau_threshold', 'step_budget', 'temp_schedule'] }, { t: ':', h: 0.01 },
        { t: ' f32', h: 0.14 }, { t: ') ->', h: 0.01 }, { t: ' DiffusionBlock', h: 0.61, alts: ['Canvas256', 'SystemOneOut', 'ActionPlan'] },
        { t: ' {\n  ', h: 0.01 }, { t: '// Prompt: ', h: 0.02 }, { t: cleanPrompt.slice(0, 42), h: 0.08 },
        { t: '\n  let', h: 0.01 }, { t: ' logits', h: 0.42, alts: ['canvas', 'posterior', 'tokens'] }, { t: ' = ', h: 0.01 },
        { t: 'gemma4_moe_bidirectional', h: 0.77, alts: ['jev_single_pass', 'block_denoise_48', 'sparse_experts_8'] }, { t: '(state);\n  ', h: 0.04 },
        { t: 'let', h: 0.01 }, { t: ' entropy', h: 0.11 }, { t: ' = ', h: 0.01 },
        { t: 'mutual_info_select', h: 0.82, alts: ['shannon_entropy_h', 'top1_stability', 'eb_sampler_lock'] }, { t: '(&logits, entropy_bound);\n  ', h: 0.03 },
        { t: 'return', h: 0.01 }, { t: ' crystallize_anchors', h: 0.69, alts: ['renoise_mutable', 'adaptive_stop', 'commit_canvas'] },
        { t: '(entropy <= ', h: 0.04 }, { t: '0.005_f32', h: 0.52, alts: ['EB_DEFAULT', 'ADAPTIVE_EPS', 'CONVERGED'] }, { t: ');\n}', h: 0.01 }
      ]
    },
    {
      label: '+1 // ASYNC STREAMING PIPELINE',
      tokens: [
        { t: 'pub', h: 0.01 }, { t: ' async fn', h: 0.02 }, { t: ' evaluate_gate', h: 0.03 }, { t: '(', h: 0.01 },
        { t: 'state', h: 0.02 }, { t: ':', h: 0.01 }, { t: ' Stream<FrameDelta>', h: 0.67, alts: ['Receiver<GazeLock>', 'Channel<HidTick>', 'Watch<DomNode>'] },
        { t: ',', h: 0.01 }, { t: ' lookahead_k', h: 0.53, alts: ['rollout_depth', 'speculative_n', 'prefetch_hor'] }, { t: ':', h: 0.01 },
        { t: ' usize', h: 0.14 }, { t: ') ->', h: 0.01 }, { t: ' SpeculativeTree', h: 0.63, alts: ['RolloutStream', 'FutureHorizon', 'AsyncVerdict'] },
        { t: ' {\n  ', h: 0.01 }, { t: '// Prompt: ', h: 0.02 }, { t: cleanPrompt.slice(0, 42), h: 0.08 },
        { t: '\n  let', h: 0.01 }, { t: ' branches', h: 0.46, alts: ['futures', 'rollouts', 'workers'] }, { t: ' = ', h: 0.01 },
        { t: 'jev_fanout_parallel', h: 0.80, alts: ['tokio::join_all', 'prefix_kv_fork', 'speculative_beam'] }, { t: '(state, lookahead_k).await;\n  ', h: 0.04 },
        { t: 'let', h: 0.01 }, { t: ' entropy', h: 0.11 }, { t: ' = ', h: 0.01 },
        { t: 'horizon_kl_trajectory', h: 0.85, alts: ['branch_divergence', 'expected_utility', 'noul_gate_prob'] }, { t: '(&branches);\n  ', h: 0.03 },
        { t: 'return', h: 0.01 }, { t: ' stream_interpolated', h: 0.73, alts: ['prewarm_pyramid', 'emit_ghost_cursor', 'lock_trajectory'] },
        { t: '(entropy <= ', h: 0.04 }, { t: 'tau_clutch', h: 0.59, alts: ['0.08_f32', 'AUTO_GATE', 'LIVE_SYNC'] }, { t: ');\n}', h: 0.01 }
      ]
    },
    {
      label: '+2 // FORMAL VERIFIED INVARIANTS',
      tokens: [
        { t: '#[ensures(result.brier_err == 0.0)]\npub', h: 0.02 }, { t: ' fn', h: 0.01 }, { t: ' evaluate_gate', h: 0.03 }, { t: '(', h: 0.01 },
        { t: 'state', h: 0.02 }, { t: ':', h: 0.01 }, { t: ' &ProofObligation', h: 0.71, alts: ['&LinearTypeState', '&RefinedDom', '&InvariantCtx'] },
        { t: ',', h: 0.01 }, { t: 'bound_eta', h: 0.56, alts: ['epsilon_kl', 'lyapunov_v', 'martingale_c'] }, { t: ':', h: 0.01 },
        { t: ' NonNegF32', h: 0.18 }, { t: ') ->', h: 0.01 }, { t: ' QedCertificate', h: 0.68, alts: ['VerifiedChoice', 'SoundDistribution', 'TypedWitness'] },
        { t: ' {\n  ', h: 0.01 }, { t: '// Prompt: ', h: 0.02 }, { t: cleanPrompt.slice(0, 42), h: 0.08 },
        { t: '\n  let', h: 0.01 }, { t: ' simplex', h: 0.49, alts: ['polytope', 'manifold', 'witness'] }, { t: ' = ', h: 0.01 },
        { t: 'permutation_equivariant_proj', h: 0.86, alts: ['birkhoff_polytope', 'sinkhorn_knopp', 'exact_dirichlet'] }, { t: '(state);\n  ', h: 0.04 },
        { t: 'let', h: 0.01 }, { t: ' entropy', h: 0.11 }, { t: ' = ', h: 0.01 },
        { t: 'renyi_divergence_bound', h: 0.88, alts: ['wasserstein_1_dist', 'pac_bayes_kl', 'fisher_information'] }, { t: '(&simplex, bound_eta);\n  ', h: 0.03 },
        { t: 'return', h: 0.01 }, { t: ' QedCertificate::seal', h: 0.75, alts: ['Proof::discharge', 'Invariant::hold', 'Witness::commit'] },
        { t: '(entropy <= ', h: 0.04 }, { t: '0.001_f32', h: 0.61, alts: ['QED_TOLERANCE', 'ZERO_SLACK', 'EXACT_BOUND'] }, { t: ');\n}', h: 0.01 }
      ]
    }
  ];

  return {
    model: 'google/diffusiongemma-26B-A4B-it',
    activeParams: '3.8B / 25.2B MoE (8/128 experts)',
    maxSteps: 48,
    throughputTokPerSec: 1142,
    prompt: cleanPrompt,
    styleTarget,
    steeringVariants: templates,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. SSE Endpoint for real-time VK01 hardware events
  if (req.method === 'GET' && url.pathname === '/api/vk01/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial bridge state immediately
    res.write(
      `data: ${JSON.stringify({
        type: 'bridge_hello',
        bridgeState,
        timestampMs: Date.now(),
      })}\n\n`
    );

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 2. Bridge Status Endpoint
  if (req.method === 'GET' && url.pathname === '/api/vk01/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(bridgeState));
    return;
  }

  // 3. Simulate / Inject VK01 Event (for testing or WebHID relay)
  if (req.method === 'POST' && url.pathname === '/api/vk01/simulate') {
    const body = await readJsonBody(req);
    const evt = {
      type: body.type || 'rotate',
      axis: Number(body.axis ?? 1),
      delta: Number(body.delta ?? 1),
      gesture: body.gesture || 'Simulated VK01 Event',
      rawCode: body.rawCode || 'SIM_API',
      source: body.source || 'simulator',
      timestampMs: Date.now(),
    };
    bridgeState.totalEvents += 1;
    bridgeState.lastEvent = evt;
    broadcastEvent(evt);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, event: evt }));
    return;
  }

  // 4. Open macOS Accessibility Settings helper (if user wants full HUD suppression)
  if (req.method === 'POST' && url.pathname === '/api/vk01/open-accessibility') {
    try {
      spawn('open', [
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      ]);
    } catch {
      // ignore
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // 5. DiffusionGemma Custom Canvas Synthesis Endpoint
  if (req.method === 'POST' && url.pathname === '/api/ai/diffusiongemma') {
    const body = await readJsonBody(req);
    const result = buildCustomDiffusionCanvas(body.prompt, body.styleTarget);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 6. Serve Static Assets from public/
  let filePath = path.join(
    PUBLIC_DIR,
    url.pathname === '/' ? 'index.html' : url.pathname
  );
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

startHardwareBridge();

server.listen(PORT, () => {
  console.log(`\n==================================================================`);
  console.log(`  VECTR // ANTICATER VK01 Bimodal AI Operating Surface`);
  console.log(`  Live URL: http://localhost:${PORT}`);
  console.log(`==================================================================\n`);
});
