import { chunkAudio, resolveTopicName } from '../../src/audio-chunker.js';
import { ChunkerError } from '../../src/errors.js';
import { CallSession, ChunkConfig } from '../../src/types.js';

const BASE_SESSION: CallSession = {
  callId: '550e8400-e29b-41d4-a716-446655440000',
  region: 'EU',
  deskId: 'desk_001',
  agentId: 'agent_42',
  sampleRate: 16_000,
  channels: 1,
  bitDepth: 16,
};

const CHUNK_CONFIG: ChunkConfig = { chunkDurationMs: 15_000 };

function makePcmBuffer(durationMs: number, session: CallSession = BASE_SESSION): Buffer {
  const bytesPerMs = (session.sampleRate / 1000) * session.channels * (session.bitDepth / 8);
  return Buffer.alloc(Math.floor(bytesPerMs * durationMs));
}

describe('chunkAudio', () => {
  describe('acceptance criteria: 5-minute call produces ≥18 chunks', () => {
    it('produces exactly 20 chunks for a 5-minute (300s) call at 15s chunk size', () => {
      const fiveMinutePcm = makePcmBuffer(300_000);
      const chunks = chunkAudio(fiveMinutePcm, BASE_SESSION, CHUNK_CONFIG);
      expect(chunks.length).toBeGreaterThanOrEqual(18);
      expect(chunks.length).toBe(20); // 300_000ms / 15_000ms = 20
    });
  });

  describe('chunk sizing', () => {
    it('produces a single chunk for a buffer shorter than one chunk duration', () => {
      const shortPcm = makePcmBuffer(5_000); // 5 seconds
      const chunks = chunkAudio(shortPcm, BASE_SESSION, CHUNK_CONFIG);
      expect(chunks.length).toBe(1);
    });

    it('produces 2 chunks for exactly 2 × chunk duration', () => {
      const pcm = makePcmBuffer(30_000);
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      expect(chunks.length).toBe(2);
    });

    it('produces an extra chunk for a buffer that is slightly longer than N × chunk duration', () => {
      const pcm = makePcmBuffer(31_000); // 31s → 2 full + 1 partial
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      expect(chunks.length).toBe(3);
    });
  });

  describe('chunk metadata', () => {
    it('assigns sequential chunkIndex values starting at 0', () => {
      const pcm = makePcmBuffer(45_000);
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      chunks.forEach((chunk, i) => {
        expect(chunk.chunkIndex).toBe(i);
      });
    });

    it('marks only the last chunk as isLastChunk=true', () => {
      const pcm = makePcmBuffer(45_000);
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      const notLastChunks = chunks.slice(0, -1);
      const lastChunk = chunks[chunks.length - 1];
      notLastChunks.forEach((c) => expect(c.isLastChunk).toBe(false));
      expect(lastChunk?.isLastChunk).toBe(true);
    });

    it('copies session metadata onto every chunk', () => {
      const pcm = makePcmBuffer(15_000);
      const [chunk] = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      expect(chunk?.callId).toBe(BASE_SESSION.callId);
      expect(chunk?.region).toBe(BASE_SESSION.region);
      expect(chunk?.deskId).toBe(BASE_SESSION.deskId);
      expect(chunk?.agentId).toBe(BASE_SESSION.agentId);
      expect(chunk?.sampleRate).toBe(BASE_SESSION.sampleRate);
      expect(chunk?.channels).toBe(BASE_SESSION.channels);
      expect(chunk?.bitDepth).toBe(BASE_SESSION.bitDepth);
    });

    it('assigns a unique eventId (UUID) to every chunk', () => {
      const pcm = makePcmBuffer(60_000);
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      const ids = new Set(chunks.map((c) => c.eventId));
      expect(ids.size).toBe(chunks.length);
    });

    it('sets schemaVersion to 1.0.0', () => {
      const pcm = makePcmBuffer(15_000);
      const [chunk] = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      expect(chunk?.schemaVersion).toBe('1.0.0');
    });

    it('reports correct chunkDurationMs for full chunks', () => {
      const pcm = makePcmBuffer(30_000); // 2 exact chunks
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      expect(chunks[0]?.chunkDurationMs).toBe(15_000);
      expect(chunks[1]?.chunkDurationMs).toBe(15_000);
    });

    it('reports correct chunkDurationMs for a partial last chunk', () => {
      const pcm = makePcmBuffer(22_000); // 15s + 7s
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      expect(chunks.length).toBe(2);
      expect(chunks[1]?.chunkDurationMs).toBe(7_000);
    });
  });

  describe('audio payload', () => {
    it('payload bytes sum equals original buffer length', () => {
      const originalLength = 30_000 * 32; // 30s at 16kHz mono 16-bit
      const pcm = Buffer.alloc(originalLength, 0xab);
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      const totalBytes = chunks.reduce((sum, c) => sum + c.audioPayload.length, 0);
      expect(totalBytes).toBe(originalLength);
    });

    it('preserves audio data integrity across chunks', () => {
      const pcm = makePcmBuffer(30_000);
      // Fill with known pattern
      for (let i = 0; i < pcm.length; i++) pcm[i] = i % 256;
      const chunks = chunkAudio(pcm, BASE_SESSION, CHUNK_CONFIG);
      const reassembled = Buffer.concat(chunks.map((c) => c.audioPayload));
      expect(reassembled.equals(pcm)).toBe(true);
    });
  });

  describe('stereo audio', () => {
    const stereoSession: CallSession = { ...BASE_SESSION, channels: 2 };

    it('produces the same number of chunks as mono for the same duration', () => {
      const monoBuffer = makePcmBuffer(60_000, BASE_SESSION);
      const stereoBuffer = makePcmBuffer(60_000, stereoSession);
      const monoChunks = chunkAudio(monoBuffer, BASE_SESSION, CHUNK_CONFIG);
      const stereoChunks = chunkAudio(stereoBuffer, stereoSession, CHUNK_CONFIG);
      expect(stereoChunks.length).toBe(monoChunks.length);
    });

    it('stereo chunk payload is 2× the size of an equivalent mono chunk', () => {
      const monoBuffer = makePcmBuffer(15_000, BASE_SESSION);
      const stereoBuffer = makePcmBuffer(15_000, stereoSession);
      const [monoChunk] = chunkAudio(monoBuffer, BASE_SESSION, CHUNK_CONFIG);
      const [stereoChunk] = chunkAudio(stereoBuffer, stereoSession, CHUNK_CONFIG);
      expect(stereoChunk?.audioPayload.length).toBe((monoChunk?.audioPayload.length ?? 0) * 2);
    });
  });

  describe('error cases', () => {
    it('throws ChunkerError for an empty buffer', () => {
      expect(() => chunkAudio(Buffer.alloc(0), BASE_SESSION, CHUNK_CONFIG)).toThrow(ChunkerError);
    });

    it('ChunkerError includes the callId', () => {
      try {
        chunkAudio(Buffer.alloc(0), BASE_SESSION, CHUNK_CONFIG);
      } catch (err) {
        expect(err).toBeInstanceOf(ChunkerError);
        expect((err as ChunkerError).callId).toBe(BASE_SESSION.callId);
      }
    });
  });
});

describe('resolveTopicName', () => {
  it('formats the topic name correctly for an EU desk', () => {
    expect(resolveTopicName('EU', 'desk_001')).toBe('eso.audio.eu.desk_001');
  });

  it('normalises region to lowercase', () => {
    expect(resolveTopicName('US', 'DESK_002')).toBe('eso.audio.us.desk_002');
  });

  it('handles APAC region', () => {
    expect(resolveTopicName('APAC', 'desk_99')).toBe('eso.audio.apac.desk_99');
  });
});
