import { z } from 'zod';

import { ConfigurationError } from './errors.js';

const EnvSchema = z.object({
  KAFKA_BROKERS: z
    .string()
    .default('localhost:9092')
    .transform((v) => v.split(',')),
  KAFKA_CONSUMER_GROUP: z.string().default('eso-ingestion'),
  CHUNK_DURATION_MS: z.coerce.number().int().positive().default(15_000),
  SAMPLE_RATE: z.coerce.number().int().positive().default(16_000),
  CHANNELS: z.coerce.number().int().min(1).max(2).default(1),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(): Config {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new ConfigurationError(
      `Invalid configuration: ${result.error.issues.map((i) => i.message).join('; ')}`,
    );
  }
  return result.data;
}
