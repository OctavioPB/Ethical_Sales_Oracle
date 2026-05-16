import { Kafka, type Consumer, type EachMessagePayload } from "kafkajs";
import type { Server as SocketServer } from "socket.io";
import type { CallScore, RiskAlert } from "../types.js";
import { upsertCall, appendAlert } from "../store/callStore.js";

const SCORES_TOPIC = "eso.scores.calls";
const ALERTS_TOPIC = "eso.events.risk";
const GROUP_ID = "eso-dashboard-api";

let consumer: Consumer | null = null;

export async function startKafkaConsumer(io: SocketServer): Promise<void> {
  const brokers = (process.env.KAFKA_BROKERS ?? "localhost:9092").split(",");

  const kafka = new Kafka({
    clientId: "eso-api",
    brokers,
    retry: { retries: 5 },
  });

  consumer = kafka.consumer({ groupId: GROUP_ID });

  await consumer.connect();
  await consumer.subscribe({ topics: [SCORES_TOPIC, ALERTS_TOPIC], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }: EachMessagePayload) => {
      const raw = message.value?.toString();
      if (!raw) return;

      try {
        const payload = JSON.parse(raw) as unknown;

        if (topic === SCORES_TOPIC) {
          const score = payload as CallScore;
          upsertCall(score);
          io.emit("callScore", score);
        } else if (topic === ALERTS_TOPIC) {
          const alert = payload as RiskAlert;
          appendAlert(alert);
          // Only broadcast CRITICAL and HIGH to avoid saturating the channel
          if (alert.confidence >= 0.7) {
            io.emit("riskAlert", alert);
          }
        }
      } catch (err) {
        // Malformed message — log and skip; never crash the consumer
        const structuredLog = {
          level: "error",
          event: "kafka_parse_error",
          topic,
          offset: message.offset,
          error: err instanceof Error ? err.message : String(err),
        };
        process.stderr.write(JSON.stringify(structuredLog) + "\n");
      }
    },
  });
}

export async function stopKafkaConsumer(): Promise<void> {
  await consumer?.disconnect();
  consumer = null;
}
