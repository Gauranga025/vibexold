import { RepositoryIndex } from '../index';
import { RetrievalQuery, RetrievalResult } from '../types/retriever';
import { rankChunks } from './ranking-engine';

export function retrieveChunks(
  query: RetrievalQuery,
  index: RepositoryIndex
): RetrievalResult {
  const {
    query: queryString,
    intent,
    currentFile,
    maxResults = 20,
  } = query;

  const expandedQuery = expandQuery(queryString, intent);

  const candidates = index.searchChunks(expandedQuery);

  let filteredCandidates = candidates;
  if (currentFile) {
    const currentFileChunks = index.getChunksByFile(currentFile);
    filteredCandidates = [...currentFileChunks, ...candidates.filter(c => c.filePath !== currentFile)];
  }

  const scores = rankChunks(queryString, filteredCandidates, index, currentFile);

  const topScores = scores.slice(0, maxResults);
  const topChunkIds = topScores.map(s => s.chunkId);
  const topChunks = topChunkIds
    .map(id => index.getChunk(id))
    .filter((chunk): chunk is NonNullable<typeof chunk> => chunk !== undefined);

  return {
    chunks: topChunks,
    scores: topScores.map(s => s.totalScore),
    metadata: {
      query: queryString,
      retrievedCount: topChunks.length,
      totalCandidates: candidates.length,
    },
  };
}

function expandQuery(query: string, intent?: string): string {
  const lowerQuery = query.toLowerCase();
  const expandedTerms: string[] = [query];

  switch (intent) {
    case 'explain-authentication':
      expandedTerms.push('auth', 'login', 'jwt', 'session', 'oauth', 'middleware', 'passport');
      break;
    case 'explain-api':
      expandedTerms.push('api', 'route', 'endpoint', 'controller', 'handler', 'request', 'response');
      break;
    case 'explain-database':
      expandedTerms.push('db', 'database', 'query', 'model', 'schema', 'prisma', 'sequelize', 'orm');
      break;
    case 'architecture':
      expandedTerms.push('structure', 'pattern', 'design', 'component', 'module', 'service');
      break;
    case 'code-review':
      expandedTerms.push('bug', 'error', 'issue', 'problem', 'fix', 'improve', 'optimize');
      break;
  }

  if (lowerQuery.includes('auth')) {
    expandedTerms.push('authentication', 'authorization', 'login', 'session');
  }
  if (lowerQuery.includes('api')) {
    expandedTerms.push('route', 'endpoint', 'controller');
  }
  if (lowerQuery.includes('db')) {
    expandedTerms.push('database', 'model', 'schema', 'query');
  }
  if (lowerQuery.includes('component')) {
    expandedTerms.push('react', 'vue', 'ui', 'view');
  }
  if (lowerQuery.includes('hook')) {
    expandedTerms.push('use', 'react', 'state', 'effect');
  }

  return expandedTerms.join(' ');
}
