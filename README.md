# AgentPulse AI — Autonomous Incident Post-Mortem & Architecture Resilience Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-AgentPulse_v2.4-10b981.svg)](https://agentpulse-ai.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![AI Engine: Gemini 1.5 Pro](https://img.shields.io/badge/AI_Engine-Gemini_1.5_Pro_%2B_Local_Heuristics-blue.svg)](https://ai.google.dev)
[![Hackathon: Round 2](https://img.shields.io/badge/Hackathon-Round_2_Submission-emerald.svg)](#)

> **AgentPulse AI** is an autonomous Site Reliability & Incident Command platform that autonomously ingests error telemetry, maps topological blast-radius dependencies, pinpoints root causes using multi-agent consensus, and generates audit-ready post-mortems and remediation scripts in under 20 seconds.

---

## 🌟 Key Features Completed in Round 2

- **Interactive Incident Simulation Engine:** 3 production-grade outage presets (Database Connection Pool Starvation, Node.js V8 Memory Leak, and Webhook Replay Collision).
- **Custom Telemetry Ingestion:** Live log parser accepting JSON, Envoy, Nginx, or Java/Node stack traces.
- **5-Stage Autonomous Multi-Agent Triaging Pipeline:**
  1. *Telemetry Sentry:* Log parsing & anomaly density calculation.
  2. *Topology Mapper:* Blast-radius graph computation.
  3. *Root Cause Synthesizer:* Cross-correlates commits, PRs, and execution plans.
  4. *Remediation Engine:* Generates verified hotfix scripts (kubectl, SQL, bash).
  5. *Post-Mortem Scribe:* Synthesizes 5-Whys, incident timeline, and preventative tasks.
- **Interactive Service Topology & Blast-Radius Canvas:** 60fps HTML5 Canvas rendering cascading dependencies with animated particle flows and node inspection.
- **Real-Time Telemetry Suite:** Dual-axis Chart.js telemetry plotting P50/P95/P99 latency spikes and HTTP 5xx error percentages.
- **Dual-Engine AI Reasoning:** Works 100% out-of-the-box in incognito windows via zero-latency neural heuristics, with optional live Google Gemini 1.5 Pro API key integration.
- **Export & Audit Hub:** One-click Markdown export and browser PDF generation.

---

## 🏗️ Architecture & Technology Stack

```
[ Ingested Telemetry / Logs ]
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│        AgentPulse Multi-Agent Orchestration Bus         │
├─────────────────┬───────────────────┬───────────────────┤
│ 1. Sentry Agent │ 2. Topology Agent │ 3. Synthesizer    │
│ (Anomaly Score) │ (DAG & Blast Rad) │ (Root Cause ID)   │
└────────┬────────┴─────────┬─────────┴─────────┬─────────┘
         │                  │                   │
         ▼                  ▼                   ▼
┌─────────────────┬───────────────────┬───────────────────┐
│ 4. Remediation  │ 5. Scribe Agent   │ 6. Copilot Engine │
│ (Hotfix Scripts)│ (Post-Mortem/Whys)│ (Q&A Interactive) │
└─────────────────┴───────────────────┴───────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│     Client-Side UI (Tailwind CSS + Canvas + Chart.js)   │
└─────────────────────────────────────────────────────────┘
```

- **Frontend:** ES6+, Tailwind CSS, Lucide Vector Icons
- **Visual Graph:** Custom HTML5 Canvas vector renderer with dynamic edge particle simulation
- **Telemetry Charts:** Chart.js 4.4 dual-axis multi-metric visualizer
- **Intelligence Layer:** Client-side neural state machine with optional Gemini 1.5 Pro streaming

---

## 🚀 Quick Start / Local Setup

Because AgentPulse is built with an edge-first client architecture, it requires zero backend dependencies or complex container orchestration to run locally:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/agentpulse-ai.git
cd agentpulse-ai

# Run with any local server (e.g. Python):
python serve.py
# Or with Python 3:
python -m http.server 8000
```

Open `http://localhost:8000` in any web browser.

---

## 📋 Round 3 Roadmap (Three Committed Improvements)

1. **Autonomous Bi-Directional PagerDuty & Slack Incident Bot:** Real-time alert webhook ingestion from monitoring providers with an interactive Slack command bot for one-click remediation script approvals.
2. **Automated Canary Verification & Self-Healing GitOps Rollback:** GitHub Actions & ArgoCD integration to automatically generate remediation PRs and shift traffic away from degraded pods upon threshold violations.
3. **Multimodal Architecture Diagram Vision Ingestion:** Gemini 1.5 Pro multimodal vision processing to convert uploaded architecture diagrams (PNG/SVG) and whiteboard sketches directly into the live blast-radius topology graph.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
