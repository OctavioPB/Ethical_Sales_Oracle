import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { chunkAudio } from './audio-chunker.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { AudioChunkProducer } from './kafka-producer.js';
import { CallSession } from './types.js';

async function main(): Promise<void> {
  const config = loadConfig();

  logger.info('ESO Ingestion service starting', {
    kafkaBrokers: config.KAFKA_BROKERS,
    chunkDurationMs: config.CHUNK_DURATION_MS,
  });

  const producer = new AudioChunkProducer({
    brokers: config.KAFKA_BROKERS,
    clientId: 'eso-ingestion',
  });

  await producer.connect();
  logger.info('Kafka producer connected');

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down ingestion service');
    await producer.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  // In production this would be replaced by a real PCM stream reader
  // (e.g. a WebSocket feed from the telephony adapter or a Kafka consumer).
  // For Sprint 1, we expose the chunker + producer as a library;
  // the full streaming wiring is a Sprint 2 deliverable.
  logger.info('Ingestion service ready — awaiting audio stream connections');
}

export { chunkAudio, resolveTopicName } from './audio-chunker.js';
export { AudioChunkProducer } from './kafka-producer.js';
export type { CallSession, AudioChunk, ChunkerResult, Region } from './types.js';

main().catch((err: unknown) => {
  logger.error('Fatal error in ingestion service', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
