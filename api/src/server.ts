import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { callsRouter, setSocketServer } from "./routes/calls.js";
import { createTestInjectRouter } from "./routes/testInject.js";
import { startKafkaConsumer, stopKafkaConsumer } from "./kafka/consumer.js";
import { verifyToken } from "./middleware/auth.js";
import { closePool } from "./db/client.js";
import { metricsMiddleware, metricsHandler } from "./middleware/metrics.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

// ── Express ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(metricsMiddleware);

// Health check — no auth required (used by k8s liveness probe)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// Prometheus metrics — no auth, scraped by Prometheus only (network-level protection in prod)
app.get("/metrics", metricsHandler);

app.use("/api/calls", callsRouter);

// 404 handler — structured JSON, no HTML
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── HTTP + Socket.io ─────────────────────────────────────────────────────────

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET"],
    credentials: true,
  },
  // Path matches the proxy in vite.config.ts
  path: "/socket.io",
});

// Auth gate on every Socket.io connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error("Missing authentication token"));
    return;
  }

  try {
    const payload = await verifyToken(token);
    if (payload.role !== "supervisor" && payload.role !== "compliance") {
      next(new Error("Insufficient role"));
      return;
    }
    socket.data.auth = payload;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const log = {
    level: "info",
    event: "socket_connected",
    socketId: socket.id,
    sub: (socket.data.auth as { sub: string }).sub,
  };
  process.stdout.write(JSON.stringify(log) + "\n");

  socket.on("disconnect", (reason) => {
    const disconnectLog = {
      level: "info",
      event: "socket_disconnected",
      socketId: socket.id,
      reason,
    };
    process.stdout.write(JSON.stringify(disconnectLog) + "\n");
  });
});

// ── Startup ──────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // Inject the Socket.io server into the calls router for intervention broadcasts
  setSocketServer(io);

  // Staging/test only: score injection endpoint for k6 load tests
  const nodeEnv = process.env.NODE_ENV ?? "production";
  if (nodeEnv === "staging" || nodeEnv === "test") {
    app.use("/api/test", createTestInjectRouter(io));
    process.stdout.write(
      JSON.stringify({ level: "warn", event: "test_routes_enabled", nodeEnv }) + "\n",
    );
  }

  // Kafka consumer feeds in-memory store and broadcasts to Socket.io
  await startKafkaConsumer(io);

  httpServer.listen(PORT, () => {
    process.stdout.write(
      JSON.stringify({ level: "info", event: "server_started", port: PORT }) + "\n",
    );
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  process.stdout.write(
    JSON.stringify({ level: "info", event: "server_shutting_down" }) + "\n",
  );
  await stopKafkaConsumer();
  await closePool();
  httpServer.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

start().catch((err) => {
  process.stderr.write(
    JSON.stringify({ level: "fatal", event: "startup_error", error: String(err) }) + "\n",
  );
  process.exit(1);
});
