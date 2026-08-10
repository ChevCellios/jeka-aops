import { useCallback, useRef, useState } from 'react';
import { beginAutomaticAnalysis, type SessionAnalysis } from '../analysis/sessionAnalysis';
import type { Session } from '../models/session';

export function useAnalysisQueue(updateAnalysis: (sessionId: string, analysis: SessionAnalysis) => Promise<void>) {
  const activeIds = useRef(new Set<string>());
  const queueTail = useRef<Promise<void>>(Promise.resolve());
  const [progress, setProgress] = useState<Record<string, string>>({});

  const run = useCallback((session: Session) => {
    if (activeIds.current.has(session.id)) return Promise.resolve();
    activeIds.current.add(session.id);
    const queuedStatus = updateAnalysis(session.id, { status: 'queued', updatedAt: new Date().toISOString(), note: 'Automatska obrada čeka u redu.' });
    const task = queueTail.current.catch(() => undefined).then(() => queuedStatus).then(async () => {
      try {
        await updateAnalysis(session.id, { status: 'running', updatedAt: new Date().toISOString(), note: 'Automatska obrada je u tijeku.' });
        const analysis = await beginAutomaticAnalysis(session.uri, session.id, session.durationSeconds, session.noiseSamples ?? [], value => {
          setProgress(current => ({ ...current, [session.id]: value }));
        });
        await updateAnalysis(session.id, analysis);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[JEKA AOPS] Red analize nije uspio', { sessionId: session.id, error: message });
        await updateAnalysis(session.id, { status: 'failed', updatedAt: new Date().toISOString(), note: `Automatska obrada nije uspjela: ${message}`, error: message }).catch(() => undefined);
      } finally {
        activeIds.current.delete(session.id);
        setProgress(current => {
          const { [session.id]: _removed, ...rest } = current;
          return rest;
        });
      }
    });
    queueTail.current = task;
    return task;
  }, [updateAnalysis]);

  return { progress, run };
}
