import { z } from 'zod';

export const RegionSchema = z.enum(['EU', 'US', 'UK', 'APAC']);
export type Region = z.infer<typeof RegionSchema>;

export const CallSessionSchema = z.object({
  callId: z.string().uuid(),
  region: RegionSchema,
  deskId: z.string().min(1),
  agentId: z.string().min(1),
  sampleRate: z.number().int().positive().default(16000),
  channels: z.number().int().min(1).max(2).default(1),
  bitDepth: z.literal(16).default(16),
});
export type CallSession = z.infer<typeof CallSessionSchema>;

export const ChunkConfigSchema = z.object({
  chunkDurationMs: z.number().int().positive().default(15_000),
});
export type ChunkConfig = z.infer<typeof ChunkConfigSchema>;

export interface AudioChunk {
  eventId: string;
  callId: string;
  region: Region;
  deskId: string;
  agentId: string;
  chunkIndex: number;
  chunkDurationMs: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  audioPayload: Buffer;
  capturedAt: number;
  publishedAt: number;
  isLastChunk: boolean;
  schemaVersion: string;
}

export interface ChunkerResult {
  chunksProduced: number;
  totalDurationMs: number;
  callId: string;
}
