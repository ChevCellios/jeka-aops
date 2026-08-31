import { AUDIO_ANALYSIS_SAMPLE_RATE, pcmChannelsToNoiseSamples } from './audioMetering';
import type { NoiseSample } from './types';

export type DecodedAudioReadings = {
  samples: NoiseSample[];
  sampleRateHz: number;
  channelCount: number;
  durationSeconds: number;
};

/** Decodes a local video/audio file on-device and reduces its PCM to 250 ms readings. */
export async function decodeAudioReadings(mediaUri: string): Promise<DecodedAudioReadings> {
  const { decodeAudioData } = await import('react-native-audio-api');
  const buffer = await decodeAudioData(mediaUri, AUDIO_ANALYSIS_SAMPLE_RATE);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const samples = pcmChannelsToNoiseSamples(channels, buffer.sampleRate);
  if (!samples.length) throw new Error('Audio zapis nema čitljive PCM uzorke.');
  return { samples, sampleRateHz: buffer.sampleRate, channelCount: buffer.numberOfChannels, durationSeconds: buffer.duration };
}
