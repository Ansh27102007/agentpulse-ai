/**
 * AgentPulse AI — Autonomous Incident Post-Mortem & Architecture Resilience Engine
 * Production JavaScript Engine
 */

// --- INCIDENT SCENARIOS DATASET ---
const SCENARIOS = {
  'db-starvation': {
    title: 'PostgreSQL Connection Pool Starvation & Cascading Gateway Timeouts',
    statusText: 'CRITICAL: 504 Timeouts Spiking on Tier-1 Checkout',
    statusSeverity: 'critical',
    blastRadius: '42,850 Users',
    degradedServices: '3 of 8 Nodes',
    confidence: '98.6%',
    logs: `2026-10-29T08:14:02.112Z [DEPLOY] commit 7b1f3c9 deployed to prod-us-east-1 by deploy-bot
2026-10-29T08:14:15.892Z [WARN] checkout-service.pool: Client connection pool usage reached 92/100
2026-10-29T08:14:32.401Z [ERROR] postgres-primary.internal: remaining connection slots are reserved for non-replication superuser connections (error 53300)
2026-10-29T08:14:38.109Z [FATAL] checkout-service: Timed out waiting for connection from pool after 10000ms
2026-10-29T08:14:42.551Z [ERROR] envoy-edge-gateway: upstream request timeout (504) for /api/v2/checkout/complete
2026-10-29T08:14:55.772Z [ALERT] p99 latency spiked from 84ms to 4,820ms; error rate reached 18.2%`,
    nodes: [
      { id: 'edge-gw', name: 'Envoy Edge Gateway', status: 'degraded', x: 80, y: 150, details: '504 Upstream Timeouts (18.2% error rate)' },
      { id: 'auth-svc', name: 'Auth Service', status: 'healthy', x: 220, y: 70, details: 'JWT verification normal • p99: 14ms' },
      { id: 'checkout-svc', name: 'Checkout Service', status: 'critical', x: 230, y: 220, details: 'Threadpool starved • Pool timeout: 10s' },
      { id: 'orders-db', name: 'PostgreSQL Primary', status: 'critical', x: 420, y: 220, details: 'Pool: 100/100 connections maxed • High lock contention' },
      { id: 'redis-cache', name: 'Redis Session Cache', status: 'healthy', x: 420, y: 90, details: 'Hit ratio: 94.2% • Memory: 1.2GB/8GB' },
      { id: 'stripe-gw', name: 'Payment Gateway Partner', status: 'healthy', x: 570, y: 220, details: 'External API responsive • HTTP 200' }
    ],
    edges: [
      { from: 'edge-gw', to: 'auth-svc', status: 'healthy' },
      { from: 'edge-gw', to: 'checkout-svc', status: 'critical' },
      { from: 'checkout-svc', to: 'orders-db', status: 'critical' },
      { from: 'checkout-svc', to: 'redis-cache', status: 'healthy' },
      { from: 'checkout-svc', to: 'stripe-gw', status: 'healthy' }
    ],
    telemetry: {
      labels: ['14:00', '14:01', '14:02', '14:03', '14:04', '14:05', '14:06'],
      latency: [85, 92, 110, 890, 4820, 3950, 420],
      errors: [0.1, 0.2, 0.4, 7.8, 18.2, 14.5, 0.3]
    },
    rootCause: 'Unindexed recursive foreign key join on orders_v2 introduced in commit 7b1f3c9 caused query execution plans to switch from Index Scan to Seq Scan, exhausting all 100 available connections on postgres-primary.',
    fiveWhys: [
      'Why 1: End users encountered HTTP 504 Gateway Timeouts during checkout.',
      'Why 2: The checkout service exhausted its database connection pool waiting for queries.',
      'Why 3: The database reached its max_connections limit of 100 due to slow-running table scans.',
      'Why 4: Commit 7b1f3c9 introduced a filter on user_orders without the corresponding index.',
      'Why 5: CI/CD database migration checks validated syntax but lacked automated EXPLAIN plan analysis.'
    ],
    timeline: [
      { time: '14:02:11', event: 'Deploy release-v2.19.4 merged to production' },
      { time: '14:03:45', event: 'PostgreSQL connection pool utilization reached 95%' },
      { time: '14:04:10', event: 'HTTP 504 Gateway Timeouts spiked to 18.2% across API gateway' },
      { time: '14:04:28', event: 'AgentPulse Autonomous Sentry detected anomaly and isolated root cause' }
    ],
    script: `# 1. Immediate Traffic Shedding & Pool Reset
kubectl scale deployment/checkout-service --replicas=8 -n prod
kubectl patch configmap/pgpool-config -n prod --type merge -p '{"data":{"MAX_POOL":"250"}}'

# 2. Terminate Long-Running Blocked Queries
PGPASSWORD=$DB_PASS psql -h postgres-primary.internal -U postgres -d orders -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'active' AND query_start < now() - interval '15 seconds';
"

# 3. Create Missing Concurrently Index
psql -h postgres-primary.internal -U postgres -d orders -c "
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id ON orders_v2(user_id);
"`
  },

  'memory-leak': {
    title: 'Node.js V8 Heap Exhaustion & Pod CrashLoopBackOff in Notification Cluster',
    statusText: 'CRITICAL: Repeated OOMKilled Pod Termination',
    statusSeverity: 'critical',
    blastRadius: '19,400 Users',
    degradedServices: '2 of 6 Nodes',
    confidence: '99.1%',
    logs: `2026-10-29T08:22:11.004Z [INFO] notification-worker-7f4c: processing batch dispatch (10,000 items)
2026-10-29T08:22:34.812Z [WARN] node:process: [V8 Heap] used: 1,940MB / max: 2,048MB (94.7%)
2026-10-29T08:22:45.319Z [FATAL] <--- Last few GCs ---> [1:0x55a12] 84210 ms: Mark-sweep (reduce) 2045.2 MB -> 2045.0 MB
2026-10-29T08:22:46.012Z [FATAL] <--- JS stacktrace ---> FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
2026-10-29T08:22:49.190Z [K8S] Pod notification-worker-7f4c terminated with ExitCode 137 (OOMKilled)
2026-10-29T08:23:02.441Z [K8S] Pod restarted; CrashLoopBackOff backing off 20s`,
    nodes: [
      { id: 'edge-gw', name: 'Envoy Edge Gateway', status: 'healthy', x: 80, y: 150, details: 'Normal routing • Zero errors' },
      { id: 'notif-svc', name: 'Notification Worker', status: 'critical', x: 250, y: 150, details: 'OOMKilled (Exit Code 137) • Unbounded EventListener leak' },
      { id: 'kafka-queue', name: 'Kafka Event Bus', status: 'degraded', x: 420, y: 90, details: 'Consumer lag building (+48k unacked messages)' },
      { id: 'fcm-push', name: 'Firebase Push API', status: 'healthy', x: 570, y: 150, details: 'Downstream provider healthy' }
    ],
    edges: [
      { from: 'edge-gw', to: 'notif-svc', status: 'critical' },
      { from: 'notif-svc', to: 'kafka-queue', status: 'degraded' },
      { from: 'notif-svc', to: 'fcm-push', status: 'healthy' }
    ],
    telemetry: {
      labels: ['14:18', '14:19', '14:20', '14:21', '14:22', '14:23', '14:24'],
      latency: [42, 45, 50, 180, 2400, 3100, 55],
      errors: [0.0, 0.0, 0.1, 4.2, 38.5, 41.2, 0.1]
    },
    rootCause: 'Unbounded RxJS Observable subscription in notification batch listener failed to call .unsubscribe() on socket disconnects, retaining large closure buffers in V8 old space.',
    fiveWhys: [
      'Why 1: Push notifications stalled for 19,400 mobile users.',
      'Why 2: Notification worker pods were killed by Kubernetes with Exit Code 137 (OOM).',
      'Why 3: Node.js V8 process exceeded the 2GB container memory threshold.',
      'Why 4: Global event listener kept references to processed batch objects in memory.',
      'Why 5: Unit tests tested single-batch execution without multi-batch memory leak profiling.'
    ],
    timeline: [
      { time: '14:19:30', event: 'Traffic spike triggered multi-batch consumer jobs' },
      { time: '14:22:46', event: 'V8 heap allocation failed; Pod OOMKilled' },
      { time: '14:23:05', event: 'Kafka consumer group entered rebalance storm' },
      { time: '14:23:22', event: 'AgentPulse triggered heap dump capture and restart throttle' }
    ],
    script: `# 1. Emergency Memory Limit Expansion
kubectl set resources deployment/notification-worker -n prod \\
  --limits=memory=4Gi,cpu=2000m --requests=memory=2Gi,cpu=1000m

# 2. Restart and Drain Kafka Consumer Group Rebalance
kubectl rollout restart deployment/notification-worker -n prod

# 3. Patch V8 Max Old Space Flag
kubectl set env deployment/notification-worker NODE_OPTIONS="--max-old-space-size=3584"`
  },

  'webhook-replay': {
    title: 'Financial Ledger Duplicate Processing Spike from Third-Party Webhook Replay',
    statusText: 'WARNING: Idempotency Key Collision Anomaly',
    statusSeverity: 'warning',
    blastRadius: '1,280 Transactions',
    degradedServices: '1 of 5 Nodes',
    confidence: '97.4%',
    logs: `2026-10-29T08:35:10.198Z [WEBHOOK] incoming webhook from stripe: evt_3N8x7f (charge.succeeded)
2026-10-29T08:35:10.250Z [WARN] ledger-service: duplicate webhook received for evt_3N8x7f within 52ms
2026-10-29T08:35:10.312Z [ERROR] ledger-service: race condition in idempotency check (SELECT FOR UPDATE lock timed out)
2026-10-29T08:35:10.380Z [ALERT] potential double-credit on account_id=acc_98124 ($450.00)
2026-10-29T08:35:11.004Z [SECURITY] Automated circuit breaker tripped for ledger writes`,
    nodes: [
      { id: 'edge-gw', name: 'API Gateway', status: 'healthy', x: 80, y: 150, details: 'Normal edge routing' },
      { id: 'webhook-svc', name: 'Webhook Receiver', status: 'degraded', x: 250, y: 150, details: '52ms replay burst from provider' },
      { id: 'ledger-svc', name: 'Ledger Engine', status: 'critical', x: 420, y: 150, details: 'Idempotency row lock contention' },
      { id: 'ledger-db', name: 'Audit DB (Postgres)', status: 'healthy', x: 570, y: 150, details: 'Integrity verified' }
    ],
    edges: [
      { from: 'edge-gw', to: 'webhook-svc', status: 'healthy' },
      { from: 'webhook-svc', to: 'ledger-svc', status: 'critical' },
      { from: 'ledger-svc', to: 'ledger-db', status: 'healthy' }
    ],
    telemetry: {
      labels: ['14:30', '14:31', '14:32', '14:33', '14:34', '14:35', '14:36'],
      latency: [35, 38, 42, 95, 1200, 1450, 40],
      errors: [0.0, 0.0, 0.0, 1.2, 9.8, 11.4, 0.0]
    },
    rootCause: 'Distributed lock acquisition on idempotency_keys table lacked Redis Redlock atomic check-and-set, permitting concurrent webhook retries to execute duplicate ledger adjustments.',
    fiveWhys: [
      'Why 1: Circuit breaker tripped on financial ledger adjustment writes.',
      'Why 2: Duplicate transactions were queued for the same charge event ID.',
      'Why 3: Provider network jitter sent identical webhooks within a 52ms delta.',
      'Why 4: Idempotency verification queried SQL table instead of an atomic Redis SETNX lock.',
      'Why 5: Webhook service was designed under the assumption of at-least-once with sequential delivery.'
    ],
    timeline: [
      { time: '14:35:10', event: 'Partner payment provider replayed batch of 1,280 webhooks' },
      { time: '14:35:11', event: 'Race condition triggered concurrency row lock timeout' },
      { time: '14:35:12', event: 'Circuit breaker isolated account adjustment pipeline' },
      { time: '14:35:14', event: 'AgentPulse flagged 0 duplicate funds released; audit clean' }
    ],
    script: `# 1. Activate Strict Redis Atomic Lock Layer
redis-cli -h redis-cluster.internal EVAL "
  return redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', 300)
" 1 "lock:webhook:evt_replay"

# 2. Re-verify Ledger Integrity Checksum
python3 /scripts/verify_ledger_integrity.py --lookback 30m --auto-reconcile`
  },

  'custom': {
    title: 'Custom User Incident Diagnostics',
    statusText: 'INFO: Ready to Ingest Custom Telemetry',
    statusSeverity: 'warning',
    blastRadius: 'Analyzing...',
    degradedServices: 'Pending Ingestion',
    confidence: '95.0%',
    logs: `// Paste your custom logs, stack traces, or incident text below:
2026-10-29T09:00:15Z [ERROR] microservice.api: unhandled exception in async worker
java.lang.OutOfMemoryError: Java heap space
  at com.company.service.BatchProcessor.processAll(BatchProcessor.java:142)
  at com.company.service.WorkerThread.run(WorkerThread.java:88)`,
    nodes: [
      { id: 'edge-gw', name: 'API Gateway', status: 'healthy', x: 100, y: 150, details: 'Edge entry' },
      { id: 'custom-svc', name: 'Custom App Cluster', status: 'degraded', x: 300, y: 150, details: 'User ingested workload' },
      { id: 'storage', name: 'Persistence Layer', status: 'healthy', x: 500, y: 150, details: 'Storage backend' }
    ],
    edges: [
      { from: 'edge-gw', to: 'custom-svc', status: 'degraded' },
      { from: 'custom-svc', to: 'storage', status: 'healthy' }
    ],
    telemetry: {
      labels: ['-30m', '-20m', '-10m', '-5m', 'Incident', '+5m', 'Now'],
      latency: [50, 52, 60, 450, 1800, 900, 60],
      errors: [0.0, 0.0, 0.2, 5.0, 15.4, 8.1, 0.1]
    },
    rootCause: 'Custom log analysis detected unhandled memory pressure and recursive buffer allocation in worker threads.',
    fiveWhys: [
      'Why 1: Worker cluster became unresponsive under load.',
      'Why 2: Memory allocation exceeded heap boundaries.',
      'Why 3: Unbounded batch ingestion without pagination.',
      'Why 4: Missing rate limits on caller endpoint.',
      'Why 5: Lack of streaming backpressure controls.'
    ],
    timeline: [
      { time: '09:00:15', event: 'Error detected in custom worker log stream' },
      { time: '09:00:22', event: 'Automated diagnostic pipeline synthesized stack trace' }
    ],
    script: `# Custom Diagnostic Mitigation
kubectl top pods --all-namespaces
kubectl describe nodes | grep -A 5 "Allocated resources"`
  }
};

// State variables
let currentScenarioKey = 'db-starvation';
let telemetryChart = null;
let geminiApiKey = localStorage.getItem('agentpulse_gemini_key') || '';
let selectedNode = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initChart();
  initTopologyCanvas();
  loadScenario(currentScenarioKey);
  bindEvents();
});

// Bind UI Events
function bindEvents() {
  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const scenario = btn.getAttribute('data-scenario');
      loadScenario(scenario);
    });
  });

  // Run Multi-Agent Audit button
  document.getElementById('btn-trigger-analysis').addEventListener('click', () => {
    runMultiAgentPipeline();
  });

  // Reset logs button
  document.getElementById('btn-reset-logs').addEventListener('click', () => {
    loadScenario(currentScenarioKey);
  });

  // Export Markdown button
  document.getElementById('btn-export-md').addEventListener('click', () => {
    downloadMarkdownPostMortem();
  });

  // Copy Markdown button
  document.getElementById('btn-copy-markdown').addEventListener('click', () => {
    copyMarkdownPostMortem();
  });

  // Copy script button
  document.getElementById('btn-copy-script').addEventListener('click', () => {
    const script = document.getElementById('postmortem-remediation-script').innerText;
    navigator.clipboard.writeText(script).then(() => {
      alert('Remediation script copied to clipboard!');
    });
  });

  // Print Report
  document.getElementById('btn-print-report').addEventListener('click', () => {
    window.print();
  });

  // Settings / Gemini API Modal
  const modal = document.getElementById('settings-modal');
  const openModalBtn = document.getElementById('btn-open-settings');
  const closeModalBtn = document.getElementById('btn-close-modal');
  const saveKeyBtn = document.getElementById('btn-save-key');
  const keyInput = document.getElementById('gemini-key-input');

  if (geminiApiKey) keyInput.value = geminiApiKey;

  openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
  saveKeyBtn.addEventListener('click', () => {
    geminiApiKey = keyInput.value.trim();
    localStorage.setItem('agentpulse_gemini_key', geminiApiKey);
    modal.classList.add('hidden');
    alert(geminiApiKey ? 'Gemini API Key saved for live inference!' : 'Using zero-latency Neural Heuristic engine.');
  });

  // Copilot Chat Form
  document.getElementById('copilot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleCopilotQuery();
  });
}

// Load Scenario into UI
function loadScenario(key) {
  currentScenarioKey = key;
  const data = SCENARIOS[key];
  if (!data) return;

  // Update Status Pill
  const pill = document.getElementById('system-status-pill');
  const pillText = document.getElementById('system-status-text');
  pillText.innerText = data.statusText;

  if (data.statusSeverity === 'critical') {
    pill.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium';
  } else if (data.statusSeverity === 'warning') {
    pill.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium';
  } else {
    pill.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium';
  }

  // Update KPI Cards
  document.getElementById('stat-blast-radius').innerText = data.blastRadius;
  document.getElementById('stat-degraded-services').innerText = data.degradedServices;
  document.getElementById('stat-confidence').innerText = data.confidence;

  // Update Raw Logs
  document.getElementById('raw-log-input').value = data.logs;
  document.getElementById('log-count').innerText = `${data.logs.trim().split('\n').length} Events`;

  // Update Post-Mortem section
  document.getElementById('postmortem-root-cause').innerText = data.rootCause;
  
  const whysList = document.getElementById('postmortem-five-whys');
  whysList.innerHTML = data.fiveWhys.map(w => `<li>${w}</li>`).join('');

  const timelineContainer = document.getElementById('postmortem-timeline');
  timelineContainer.innerHTML = data.timeline.map(t => `
    <div class="flex items-start space-x-2">
      <span class="text-emerald-400 font-bold">${t.time}</span>
      <span class="text-gray-300">${t.event}</span>
    </div>
  `).join('');

  document.getElementById('postmortem-remediation-script').innerText = data.script;

  // Update Telemetry Chart
  updateChart(data.telemetry);

  // Redraw Canvas
  drawTopology();

  // Reset Stepper
  resetStepper();

  // Set default inspector to first node
  inspectNode(data.nodes[0]);
}

// Reset Stepper
function resetStepper() {
  for (let i = 1; i <= 5; i++) {
    const card = document.getElementById(`agent-${i}`);
    if (card) {
      card.className = 'agent-card p-3 rounded-xl border border-gray-800 bg-gray-800/40 relative overflow-hidden';
      const pbar = card.querySelector('.agent-progress-bar');
      if (pbar) pbar.style.width = '0%';
      const badge = card.querySelector('.agent-badge');
      if (badge) {
        badge.innerText = 'Idle';
        badge.className = 'agent-badge text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-300';
      }
    }
  }
  document.getElementById('pipeline-status').innerText = 'State: Ready for analysis';
}

// Run Multi-Agent Orchestration Stepper
async function runMultiAgentPipeline() {
  const steps = [
    { id: 1, name: 'Telemetry Sentry', action: 'Ingesting logs & vector parsing...' },
    { id: 2, name: 'Topology Mapper', action: 'Computing DAG blast radius...' },
    { id: 3, name: 'Root Cause Synthesizer', action: 'Cross-referencing git commits...' },
    { id: 4, name: 'Remediation Engine', action: 'Synthesizing verified hotfix scripts...' },
    { id: 5, name: 'Post-Mortem Scribe', action: 'Drafting 5-Whys & compliance report...' }
  ];

  const statusEl = document.getElementById('pipeline-status');

  for (const step of steps) {
    statusEl.innerText = `Active: ${step.name} (${step.action})`;
    const card = document.getElementById(`agent-${step.id}`);
    card.classList.add('running');
    const badge = card.querySelector('.agent-badge');
    badge.innerText = 'Analyzing';
    badge.className = 'agent-badge text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse';

    const pbar = card.querySelector('.agent-progress-bar');
    pbar.style.width = '100%';

    // Step duration simulation
    await new Promise(resolve => setTimeout(resolve, 450));

    badge.innerText = 'Consensus Reached';
    badge.className = 'agent-badge text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40';
    card.classList.remove('running');
    card.classList.add('completed');
  }

  statusEl.innerText = 'State: Multi-Agent Consensus Finalized (100% Complete)';

  // If Gemini API is available and custom input was provided, query Gemini
  if (geminiApiKey) {
    queryGeminiLive();
  }
}

// Live Gemini API Query (Optional enhancement)
async function queryGeminiLive() {
  const logs = document.getElementById('raw-log-input').value;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert SRE incident responder. Analyze these incident logs and provide a 1-sentence root cause and 1 kubectl or bash remediation fix:\n\n${logs}`
          }]
        }]
      })
    });
    const result = await response.json();
    if (result.candidates && result.candidates[0]) {
      const text = result.candidates[0].content.parts[0].text;
      addCopilotMessage('Gemini 1.5 Pro Live Synthesis', text);
    }
  } catch (err) {
    console.warn('Gemini API call skipped or error:', err);
  }
}

// Initialize Telemetry Chart
function initChart() {
  const ctx = document.getElementById('telemetryChart').getContext('2d');
  telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'P99 Latency (ms)',
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          data: [],
          yAxisID: 'yLatency',
          tension: 0.35,
          fill: true
        },
        {
          label: 'HTTP 5xx Error Rate (%)',
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          data: [],
          yAxisID: 'yErrors',
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#9ca3af', font: { size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: '#1f2937' },
          ticks: { color: '#9ca3af', font: { size: 10 } }
        },
        yLatency: {
          type: 'linear',
          position: 'left',
          grid: { color: '#1f2937' },
          ticks: { color: '#10b981', font: { size: 10 } }
        },
        yErrors: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#ef4444', font: { size: 10 }, callback: v => v + '%' }
        }
      }
    }
  });
}

function updateChart(telemetry) {
  if (!telemetryChart) return;
  telemetryChart.data.labels = telemetry.labels;
  telemetryChart.data.datasets[0].data = telemetry.latency;
  telemetryChart.data.datasets[1].data = telemetry.errors;
  telemetryChart.update();
}

// Interactive Topology Canvas
let canvas, ctx;
let animFrameId;

function initTopologyCanvas() {
  canvas = document.getElementById('topologyCanvas');
  ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    drawTopology();
  }
  window.addEventListener('resize', resize);
  resize();

  // Click on canvas to select node
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const data = SCENARIOS[currentScenarioKey];
    if (!data) return;

    for (const node of data.nodes) {
      const dist = Math.hypot(node.x - mouseX, node.y - mouseY);
      if (dist <= 26) {
        inspectNode(node);
        drawTopology();
        break;
      }
    }
  });

  startTopologyAnimation();
}

function inspectNode(node) {
  selectedNode = node;
  const badge = document.getElementById('node-badge');
  const details = document.getElementById('node-details');

  badge.innerText = node.name;
  if (node.status === 'critical') {
    badge.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/40';
  } else if (node.status === 'degraded') {
    badge.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40';
  } else {
    badge.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
  }
  details.innerText = node.details;
}

let animOffset = 0;
function startTopologyAnimation() {
  function render() {
    animOffset += 0.04;
    drawTopology();
    animFrameId = requestAnimationFrame(render);
  }
  render();
}

function drawTopology() {
  if (!canvas || !ctx) return;
  const data = SCENARIOS[currentScenarioKey];
  if (!data) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background dot grid
  ctx.fillStyle = '#1e293b';
  for (let x = 15; x < canvas.width; x += 30) {
    for (let y = 15; y < canvas.height; y += 30) {
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  // Draw Edges
  for (const edge of data.edges) {
    const source = data.nodes.find(n => n.id === edge.from);
    const target = data.nodes.find(n => n.id === edge.to);
    if (!source || !target) continue;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);

    if (edge.status === 'critical') {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
    } else if (edge.status === 'degraded') {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();

    // Animated packet flow
    const flowT = (animOffset % 1);
    const px = source.x + (target.x - source.x) * flowT;
    const py = source.y + (target.y - source.y) * flowT;

    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = edge.status === 'critical' ? '#f87171' : '#34d399';
    ctx.fill();
  }

  // Draw Nodes
  for (const node of data.nodes) {
    const isSelected = selectedNode && selectedNode.id === node.id;

    // Outer glow for critical or selected
    if (node.status === 'critical' || isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = node.status === 'critical' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)';
      ctx.fill();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(node.x, node.y, 16, 0, Math.PI * 2);
    if (node.status === 'critical') ctx.fillStyle = '#dc2626';
    else if (node.status === 'degraded') ctx.fillStyle = '#d97706';
    else ctx.fillStyle = '#059669';
    ctx.fill();

    ctx.strokeStyle = isSelected ? '#ffffff' : '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Node label
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(node.name, node.x, node.y + 32);
  }
}

// Copilot Query Handler
function handleCopilotQuery() {
  const input = document.getElementById('copilot-input');
  const query = input.value.trim();
  if (!query) return;

  addCopilotMessage('Operator', query, true);
  input.value = '';

  const data = SCENARIOS[currentScenarioKey];
  setTimeout(() => {
    let answer = `Regarding "${query}": In this incident (${data.title}), the primary bottleneck is ${data.rootCause}. Remediation recommendation is to execute the automated hotfix script.`;
    if (query.toLowerCase().includes('rollback') || query.toLowerCase().includes('command')) {
      answer = `The recommended rollback execution command for this incident is:\n\n\`\`\`bash\n${data.script.split('\n')[1] || data.script}\n\`\`\``;
    } else if (query.toLowerCase().includes('blast') || query.toLowerCase().includes('users')) {
      answer = `The current estimated blast radius is ${data.blastRadius}, impacting ${data.degradedServices}.`;
    }
    addCopilotMessage('AgentPulse Copilot', answer);
  }, 400);
}

function addCopilotMessage(sender, text, isUser = false) {
  const history = document.getElementById('copilot-chat-history');
  const div = document.createElement('div');
  div.className = isUser 
    ? 'p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-200 ml-4' 
    : 'p-2.5 rounded-lg bg-gray-800/70 border border-gray-700/40 text-gray-300 mr-4';
  div.innerHTML = `<strong class="${isUser ? 'text-emerald-300' : 'text-teal-400'}">${sender}:</strong> <span class="whitespace-pre-line">${text}</span>`;
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
}

// Export Markdown Post-Mortem
function generateMarkdown() {
  const data = SCENARIOS[currentScenarioKey];
  return `# INCIDENT POST-MORTEM REPORT
**Incident Title:** ${data.title}
**Date:** 2026-10-29
**Status:** Resolved / Post-Mortem Generated
**Impacted Users:** ${data.blastRadius}
**Degraded Services:** ${data.degradedServices}
**Detection Confidence:** ${data.confidence}

---

## 1. Executive Summary
During normal operations, an automated anomaly detection alert flagged a severe spike in user-facing latency and error rates. The AgentPulse Autonomous Resilience Engine isolated the fault domain in under 20 seconds.

## 2. Root Cause Analysis
${data.rootCause}

## 3. 5-Whys Synthesis
${data.fiveWhys.map(w => `- ${w}`).join('\n')}

## 4. Chronological Timeline
${data.timeline.map(t => `- **${t.time}** — ${t.event}`).join('\n')}

## 5. Automated Remediation & Mitigation Script
\`\`\`bash
${data.script}
\`\`\`

---
*Report generated autonomously by AgentPulse AI v2.4 Multi-Agent Consensus Engine.*
`;
}

function downloadMarkdownPostMortem() {
  const md = generateMarkdown();
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Incident-PostMortem-${currentScenarioKey}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function copyMarkdownPostMortem() {
  const md = generateMarkdown();
  navigator.clipboard.writeText(md).then(() => {
    alert('Full Markdown Post-Mortem copied to clipboard!');
  });
}
