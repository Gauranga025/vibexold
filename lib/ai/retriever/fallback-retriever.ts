import { RepositoryIndex } from '../index';
import { RetrievalQuery, RetrievalResult } from '../types/retriever';

export function fallbackRetrieve(
  query: RetrievalQuery,
  index: RepositoryIndex
): RetrievalResult {
  const { query: queryString, maxResults = 20 } = query;
  const lowerQuery = queryString.toLowerCase();

  const allFiles = index.getAllFiles();
  const matchingFiles = allFiles.filter(file => 
    file.filename.toLowerCase().includes(lowerQuery) ||
    file.path.toLowerCase().includes(lowerQuery)
  );

  const matchingChunks: any[] = [];
  for (const file of matchingFiles) {
    const chunks = index.getChunksByFile(file.path);
    matchingChunks.push(...chunks);
  }

  if (matchingChunks.length === 0) {
    const allChunks = index.getAllChunks();
    const symbolMatches = allChunks.filter(chunk =>
      chunk.symbolName.toLowerCase().includes(lowerQuery)
    );
    matchingChunks.push(...symbolMatches);
  }

  if (matchingChunks.length === 0) {
    const recentFiles = allFiles
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
      .slice(0, 5);
    
    for (const file of recentFiles) {
      const chunks = index.getChunksByFile(file.path);
      matchingChunks.push(...chunks.slice(0, 3));
    }
  }

  const resultChunks = matchingChunks.slice(0, maxResults);

  return {
    chunks: resultChunks,
    scores: resultChunks.map(() => 0.5),
    metadata: {
      query: queryString,
      retrievedCount: resultChunks.length,
      totalCandidates: matchingChunks.length,
    },
  };
}
