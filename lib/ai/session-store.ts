import { RepositoryIndex } from './index/repository-index';

export interface SessionIndex {
  repositoryIndex: RepositoryIndex;
  lastScanTime: Date;
}

export const sessionIndexes = new Map<string, SessionIndex>();
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Clean up expired sessions periodically
export function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessionIndexes.entries()) {
    if (now - session.lastScanTime.getTime() > SESSION_TIMEOUT_MS) {
      sessionIndexes.delete(sessionId);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
}
