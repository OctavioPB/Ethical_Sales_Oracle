export class ChunkerError extends Error {
  constructor(
    message: string,
    public readonly callId: string,
  ) {
    super(message);
    this.name = 'ChunkerError';
  }
}

export class KafkaPublishError extends Error {
  constructor(
    message: string,
    public readonly topic: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'KafkaPublishError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
