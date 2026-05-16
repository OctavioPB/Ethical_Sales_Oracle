import { v4 as uuidv4 } from 'uuid';

import { ChunkerError } from './errors.js';
import { AudioChunk, CallSession, ChunkConfig } from './types.js';

const SCHEMA_VERSION = '1.0.0';
const DEFAULT_CHUNK_DURATION_MS = 15_000;

/**
 * Computes the number of bytes in one millisecond of PCM audio.
 * Formula: (sampleRate / 1000) * channels * (bitDepth / 8)
 */
function bytesPerMs(sampleRate: number, channels: number, bitDepth: number): number {
  return (sampleRate / 1000) * channels * (bitDepth / 8);
}

/**
 * Splits a raw PCM Buffer into fixed-duration chunks.
 * Each chunk carries full metadata needed for downstream STT and diarization.
 *
 * Throws ChunkerError if the buffer is empty or session parameters are invalid.
 */
export function chunkAudio(
  rawPcm: Buffer,
  session: CallSession,
  config: ChunkConfig = { chunkDurationMs: DEFAULT_CHUNK_DURATION_MS },
  capturedAt: number = Date.now(),
): AudioChunk[] {
  const { callId, region, deskId, agentId, sampleRate, channels, bitDepth } = session;
  const { chunkDurationMs } = config;

  if (rawPcm.length === 0) {
    throw new ChunkerError('Cannot chunk an empty PCM buffer', callId);
  }

  const bpm = bytesPerMs(sampleRate, channels, bitDepth);
  const chunkSizeBytes = Math.floor(bpm * chunkDurationMs);

  if (chunkSizeBytes === 0) {
    throw new ChunkerError(
      `Chunk size resolved to 0 bytes (sampleRate=${sampleRate}, channels=${channels}, bitDepth=${bitDepth}, durationMs=${chunkDurationMs})`,
      callId,
    );
  }

  const chunks: AudioChunk[] = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < rawPcm.length) {
    const slice = rawPcm.subarray(offset, offset + chunkSizeBytes);
    const actualDurationMs = Math.round(slice.length / bpm);
    const isLastChunk = offset + chunkSizeBytes >= rawPcm.length;
    const publishedAt = Date.now();

    chunks.push({
      eventId: uuidv4(),
      callId,
      region,
      deskId,
      agentId,
      chunkIndex,
      chunkDurationMs: actualDurationMs,
      sampleRate,
      channels,
      bitDepth,
      audioPayload: Buffer.from(slice),
      capturedAt,
      publishedAt,
      isLastChunk,
      schemaVersion: SCHEMA_VERSION,
    });

    offset += chunkSizeBytes;
    chunkIndex++;
  }

  return chunks;
}

/**
 * Resolves the Kafka topic name for a given region and desk.
 * Pattern: eso.audio.{region}.{desk_id}  (lowercase, per naming convention)
 */
export function resolveTopicName(region: string, deskId: string): string {
  return `eso.audio.${region.toLowerCase()}.${deskId.toLowerCase()}`;
}
