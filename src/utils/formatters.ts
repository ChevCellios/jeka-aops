import type { CaptureLocation, SessionAnalysis } from '../analysis/sessionAnalysis';

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function formatFrameTime(timeMs?: number) {
  return typeof timeMs === 'number' ? `Kadar ${(timeMs / 1000).toFixed(1)} s` : 'Vrijeme nije dostupno';
}

export function formatFileSize(bytes?: number) {
  if (!bytes) return 'Veličina nije dostupna';
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDbfs(value?: number) {
  return typeof value === 'number' ? `${value.toFixed(0)} dBFS` : '—';
}

export function noiseLabel(dbfs?: number) {
  if (typeof dbfs !== 'number') return 'Nema mjerenja';
  return dbfs >= -20 ? 'Glasno' : dbfs >= -35 ? 'Umjereno' : 'Tiho';
}

export function formatLocation(location?: CaptureLocation) {
  if (!location) return 'Lokacija nije dostupna';
  const accuracy = location.accuracyMeters ? ` ±${Math.round(location.accuracyMeters)} m` : '';
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${accuracy}`;
}

export function analysisLabel(analysis?: SessionAnalysis, progress?: string) {
  if (progress) return `Automatska obrada: ${progress.toLowerCase()}…`;
  if (!analysis || analysis.status === 'queued') return 'Automatska obrada: čeka';
  if (analysis.status === 'running') return 'Automatska obrada: u tijeku…';
  if (analysis.status === 'failed') return `Automatska obrada: nije uspjela${analysis.error ? ` · ${analysis.error}` : ''}`;
  const frames = analysis.report?.evidenceFrames.length ?? 0;
  return analysis.status === 'completed' ? `Automatska obrada: dovršena · ${frames} kadrova` : `Automatska obrada: nije dostupna · ${frames} kadrova`;
}
