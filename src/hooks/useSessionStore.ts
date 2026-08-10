import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionAnalysis } from '../analysis/sessionAnalysis';
import type { Session } from '../models/session';
import { loadStoredSessions, persistSessions } from '../services/sessionStorage';

export function useSessionStore() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const sessionsRef = useRef<Session[]>([]);

  const replace = useCallback(async (next: Session[]) => {
    sessionsRef.current = next;
    setSessions(next);
    await persistSessions(next);
  }, []);

  const update = useCallback(async (transform: (current: Session[]) => Session[]) => {
    await replace(transform(sessionsRef.current));
  }, [replace]);

  useEffect(() => {
    void loadStoredSessions().then(stored => update(current => {
      if (!current.length) return stored;
      const currentIds = new Set(current.map(session => session.id));
      return [...current, ...stored.filter(session => !currentIds.has(session.id))];
    })).catch(error => {
      console.error('[JEKA AOPS] Učitavanje dnevnika nije uspjelo', error);
    });
  }, [update]);

  return {
    sessions,
    prepend: useCallback((session: Session) => update(current => [session, ...current]), [update]),
    remove: useCallback((sessionId: string) => update(current => current.filter(item => item.id !== sessionId)), [update]),
    updateAnalysis: useCallback((sessionId: string, analysis: SessionAnalysis) =>
      update(current => current.map(session => session.id === sessionId ? { ...session, analysis } : session)), [update]),
  };
}
