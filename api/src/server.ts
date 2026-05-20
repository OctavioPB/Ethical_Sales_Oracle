import { createServer } from 'http';

import express from 'express';
import { Server as SocketServer } from 'socket.io';

import { closePool } from './db/client.js';
import { startKafkaConsumer, stopKafkaConsumer } from './kafka/consumer.js';
import { verifyToken } from './middleware/auth.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';
import { callsRouter, setSocketServer } from './routes/calls.js';
import { feedbackRouter } from './routes/feedback.js';
import { createTestInjectRouter } from './routes/testInject.js';
import { upsertCall, appendAlert } from './store/callStore.js';
import type { CallScore, RiskAlert } from './types.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

// ── Express ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

// Health check — no auth required (used by k8s liveness probe)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Prometheus metrics — no auth, scraped by Prometheus only (network-level protection in prod)
app.get('/metrics', metricsHandler);

app.use('/api/calls', callsRouter);
app.use('/api/feedback', feedbackRouter);

// 404 handler — structured JSON, no HTML
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── HTTP + Socket.io ─────────────────────────────────────────────────────────

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET'],
    credentials: true,
  },
  // Path matches the proxy in vite.config.ts
  path: '/socket.io',
});

// Auth gate on every Socket.io connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Missing authentication token'));
    return;
  }

  try {
    const payload = await verifyToken(token);
    if (payload.role !== 'supervisor' && payload.role !== 'compliance') {
      next(new Error('Insufficient role'));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    socket.data.auth = payload;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const log = {
    level: 'info',
    event: 'socket_connected',
    socketId: socket.id,
    sub: (socket.data as { auth: { sub: string } }).auth.sub,
  };
  process.stdout.write(JSON.stringify(log) + '\n');

  socket.on('disconnect', (reason) => {
    const disconnectLog = {
      level: 'info',
      event: 'socket_disconnected',
      socketId: socket.id,
      reason,
    };
    process.stdout.write(JSON.stringify(disconnectLog) + '\n');
  });
});

// ── Startup ──────────────────────────────────────────────────────────────────

function seedDemoData(): void {
  const now = Date.now();

  // UUIDs match infra/docker/postgres/init/02_demo_seed.sql so the call detail
  // view (which queries PostgreSQL) resolves correctly when a demo call is clicked.
  const demo: Array<Omit<CallScore, 'schemaVersion'>> = [
    {
      callId: 'de000001-0000-4000-8000-000000000001',
      score: 94,
      riskLevel: 'CRITICAL',
      deterministicScore: 90,
      llmScore: 94,
      eventCount: 5,
      scoredAt: new Date(now - 90_000).toISOString(),
      agentId: 'agent-rivera',
      deskId: 'desk_001',
      region: 'eu',
    },
    {
      callId: 'de000002-0000-4000-8000-000000000002',
      score: 88,
      riskLevel: 'CRITICAL',
      deterministicScore: 82,
      llmScore: 88,
      eventCount: 4,
      scoredAt: new Date(now - 210_000).toISOString(),
      agentId: 'agent-chen',
      deskId: 'desk_001',
      region: 'eu',
    },
    {
      callId: 'de000003-0000-4000-8000-000000000003',
      score: 74,
      riskLevel: 'HIGH',
      deterministicScore: 70,
      llmScore: 74,
      eventCount: 3,
      scoredAt: new Date(now - 45_000).toISOString(),
      agentId: 'agent-walsh',
      deskId: 'desk_002',
      region: 'eu',
    },
    {
      callId: 'de000004-0000-4000-8000-000000000004',
      score: 67,
      riskLevel: 'HIGH',
      deterministicScore: 60,
      llmScore: 67,
      eventCount: 2,
      scoredAt: new Date(now - 330_000).toISOString(),
      agentId: 'agent-okonkwo',
      deskId: 'desk_001',
      region: 'us',
    },
    {
      callId: 'de000005-0000-4000-8000-000000000005',
      score: 51,
      riskLevel: 'MEDIUM',
      deterministicScore: 45,
      llmScore: 51,
      eventCount: 2,
      scoredAt: new Date(now - 120_000).toISOString(),
      agentId: 'agent-patel',
      deskId: 'desk_003',
      region: 'eu',
    },
    {
      callId: 'de000006-0000-4000-8000-000000000006',
      score: 44,
      riskLevel: 'MEDIUM',
      deterministicScore: 40,
      llmScore: 44,
      eventCount: 1,
      scoredAt: new Date(now - 480_000).toISOString(),
      agentId: 'agent-martinez',
      deskId: 'desk_002',
      region: 'us',
    },
    {
      callId: 'de000007-0000-4000-8000-000000000007',
      score: 38,
      riskLevel: 'MEDIUM',
      deterministicScore: 30,
      llmScore: 38,
      eventCount: 1,
      scoredAt: new Date(now - 600_000).toISOString(),
      agentId: 'agent-kim',
      deskId: 'desk_003',
      region: 'eu',
    },
    {
      callId: 'de000008-0000-4000-8000-000000000008',
      score: 18,
      riskLevel: 'LOW',
      deterministicScore: 12,
      llmScore: 18,
      eventCount: 0,
      scoredAt: new Date(now - 270_000).toISOString(),
      agentId: 'agent-santos',
      deskId: 'desk_001',
      region: 'eu',
    },
    {
      callId: 'de000009-0000-4000-8000-000000000009',
      score: 9,
      riskLevel: 'LOW',
      deterministicScore: 5,
      llmScore: 9,
      eventCount: 0,
      scoredAt: new Date(now - 150_000).toISOString(),
      agentId: 'agent-ali',
      deskId: 'desk_002',
      region: 'eu',
    },
  ];
  demo.forEach((d) => upsertCall({ ...d, schemaVersion: '1.0' }));

  // Seed alert feed so the Nav badge and alert panel show pre-populated events.
  const alerts: RiskAlert[] = [
    {
      eventId: 'da000001-0000-4000-8000-000000000001',
      callId: 'de000001-0000-4000-8000-000000000001',
      ruleId: 'GUARANTEED_RETURNS',
      category: 'misleading_claim',
      matchedPhrase: 'guaranteed annual return of at least 10 percent',
      speaker: 'AGENT',
      confidence: 0.971,
      triggeredAt: new Date(now - 88_000).toISOString(),
    },
    {
      eventId: 'da000001-0000-4000-8000-000000000002',
      callId: 'de000001-0000-4000-8000-000000000001',
      ruleId: 'MISLEADING_RISK_CLAIM',
      category: 'misleading_claim',
      matchedPhrase: 'zero risk to your capital',
      speaker: 'AGENT',
      confidence: 0.958,
      triggeredAt: new Date(now - 85_000).toISOString(),
    },
    {
      eventId: 'da000002-0000-4000-8000-000000000001',
      callId: 'de000002-0000-4000-8000-000000000002',
      ruleId: 'ARTIFICIAL_URGENCY',
      category: 'pressure_tactic',
      matchedPhrase: 'offer closes tonight at midnight',
      speaker: 'AGENT',
      confidence: 0.943,
      triggeredAt: new Date(now - 208_000).toISOString(),
    },
    {
      eventId: 'da000002-0000-4000-8000-000000000002',
      callId: 'de000002-0000-4000-8000-000000000002',
      ruleId: 'GUARANTEED_RETURNS',
      category: 'misleading_claim',
      matchedPhrase: 'personally guarantee returns of twelve to fifteen percent',
      speaker: 'AGENT',
      confidence: 0.967,
      triggeredAt: new Date(now - 205_000).toISOString(),
    },
    {
      eventId: 'da000003-0000-4000-8000-000000000001',
      callId: 'de000003-0000-4000-8000-000000000003',
      ruleId: 'MISLEADING_PAST_PERFORMANCE',
      category: 'misleading_claim',
      matchedPhrase: 'never seen this fund lose money',
      speaker: 'AGENT',
      confidence: 0.912,
      triggeredAt: new Date(now - 43_000).toISOString(),
    },
    {
      eventId: 'da000004-0000-4000-8000-000000000001',
      callId: 'de000004-0000-4000-8000-000000000004',
      ruleId: 'SCARCITY_PRESSURE',
      category: 'pressure_tactic',
      matchedPhrase: 'only three investor slots remaining',
      speaker: 'AGENT',
      confidence: 0.934,
      triggeredAt: new Date(now - 328_000).toISOString(),
    },
  ];
  // appendAlert prepends — insert oldest first so newest appears at top of feed.
  [...alerts].reverse().forEach((a) => appendAlert(a));

  process.stdout.write(
    JSON.stringify({
      level: 'info',
      event: 'demo_data_seeded',
      calls: demo.length,
      alerts: alerts.length,
    }) + '\n',
  );
}

async function start(): Promise<void> {
  // Inject the Socket.io server into the calls router for intervention broadcasts
  setSocketServer(io);

  // Seed demo data in non-production so the dashboard works without a live pipeline
  const nodeEnv = process.env.NODE_ENV ?? 'production';
  if (nodeEnv !== 'production') {
    seedDemoData();
  }

  // Staging/test only: score injection endpoint for k6 load tests
  if (nodeEnv === 'staging' || nodeEnv === 'test') {
    app.use('/api/test', createTestInjectRouter(io));
    process.stdout.write(
      JSON.stringify({ level: 'warn', event: 'test_routes_enabled', nodeEnv }) + '\n',
    );
  }

  // Kafka consumer feeds in-memory store and broadcasts to Socket.io
  await startKafkaConsumer(io);

  httpServer.listen(PORT, () => {
    process.stdout.write(
      JSON.stringify({ level: 'info', event: 'server_started', port: PORT }) + '\n',
    );
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  process.stdout.write(JSON.stringify({ level: 'info', event: 'server_shutting_down' }) + '\n');
  await stopKafkaConsumer();
  await closePool();
  httpServer.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

start().catch((err) => {
  process.stderr.write(
    JSON.stringify({ level: 'fatal', event: 'startup_error', error: String(err) }) + '\n',
  );
  process.exit(1);
});
