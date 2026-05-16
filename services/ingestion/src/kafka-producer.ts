import { Kafka, Producer, ProducerRecord } from 'kafkajs';

import { KafkaPublishError } from './errors.js';
import { AudioChunk, ChunkerResult } from './types.js';
import { resolveTopicName } from './audio-chunker.js';

export interface KafkaProducerConfig {
  brokers: string[];
  clientId: string;
}

export class AudioChunkProducer {
  private readonly producer: Producer;

  constructor(config: KafkaProducerConfig) {
    const kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
    });
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30_000,
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async publishChunks(chunks: AudioChunk[]): Promise<ChunkerResult> {
    if (chunks.length === 0) {
      throw new KafkaPublishError('No chunks to publish', '');
    }

    const firstChunk = chunks[0];
    if (!firstChunk) throw new KafkaPublishError('Chunk array is unexpectedly empty', '');

    const topic = resolveTopicName(firstChunk.region, firstChunk.deskId);

    const messages = chunks.map((chunk) => ({
      key: chunk.callId,
      value: JSON.stringify(serializeChunk(chunk)),
      headers: {
        'schema-version': chunk.schemaVersion,
        'chunk-index': String(chunk.chunkIndex),
        'is-last-chunk': String(chunk.isLastChunk),
      },
    }));

    const record: ProducerRecord = { topic, messages };

    try {
      await this.producer.send(record);
    } catch (err) {
      throw new KafkaPublishError(
        `Failed to publish ${chunks.length} chunks to ${topic}`,
        topic,
        err,
      );
    }

    const totalDurationMs = chunks.reduce((sum, c) => sum + c.chunkDurationMs, 0);

    return {
      chunksProduced: chunks.length,
      totalDurationMs,
      callId: firstChunk.callId,
    };
  }
}

function serializeChunk(chunk: AudioChunk): Record<string, unknown> {
  return {
    eventId: chunk.eventId,
    callId: chunk.callId,
    region: chunk.region,
    deskId: chunk.deskId,
    agentId: chunk.agentId,
    chunkIndex: chunk.chunkIndex,
    chunkDurationMs: chunk.chunkDurationMs,
    sampleRate: chunk.sampleRate,
    channels: chunk.channels,
    bitDepth: chunk.bitDepth,
    audioPayload: chunk.audioPayload.toString('base64'),
    capturedAt: chunk.capturedAt,
    publishedAt: chunk.publishedAt,
    isLastChunk: chunk.isLastChunk,
    schemaVersion: chunk.schemaVersion,
  };
}
