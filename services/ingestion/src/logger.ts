// Structured JSON logger — never logs raw transcripts or PII.
// All log lines are newline-delimited JSON for ingestion by log aggregators.

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    level,
    service: 'eso-ingestion',
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};
