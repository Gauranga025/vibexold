import { RepositoryIndex } from '../index';
import { ChunkMetadata } from '../types';
import { RankingScore } from '../types/retriever';

export function rankChunks(
  query: string,
  chunks: ChunkMetadata[],
  index: RepositoryIndex,
  currentFile?: string
): RankingScore[] {
  const lowerQuery = query.toLowerCase();
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);

  const scores: RankingScore[] = chunks.map(chunk => {
    const chunkContent = index.getChunkContent(chunk.id);
    if (!chunkContent) {
      return {
        chunkId: chunk.id,
        filenameMatch: 0,
        folderMatch: 0,
        symbolMatch: 0,
        keywordMatch: 0,
        summaryMatch: 0,
        importMatch: 0,
        exportMatch: 0,
        totalScore: 0,
      };
    }

    const filenameMatch = calculateFilenameMatch(chunk.filePath, lowerQuery);
    const folderMatch = calculateFolderMatch(chunk.filePath, lowerQuery);
    const symbolMatch = calculateSymbolMatch(chunk.symbolName, lowerQuery);
    const keywordMatch = calculateKeywordMatch(chunkContent.code, queryWords);
    const summaryMatch = calculateSummaryMatch(chunk.summary, lowerQuery);
    const importMatch = calculateImportMatch(chunkContent.imports, lowerQuery);
    const exportMatch = calculateExportMatch(chunkContent.exports, lowerQuery);

    const currentFileBoost = currentFile === chunk.filePath ? 0.2 : 0;

    const totalScore = 
      (filenameMatch * 0.25) +
      (folderMatch * 0.15) +
      (symbolMatch * 0.2) +
      (keywordMatch * 0.15) +
      (summaryMatch * 0.1) +
      (importMatch * 0.1) +
      (exportMatch * 0.05) +
      currentFileBoost;

    return {
      chunkId: chunk.id,
      filenameMatch,
      folderMatch,
      symbolMatch,
      keywordMatch,
      summaryMatch,
      importMatch,
      exportMatch,
      totalScore,
    };
  });

  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

function calculateFilenameMatch(filePath: string, query: string): number {
  const filename = filePath.split('/').pop()?.toLowerCase() || '';
  if (filename === query) return 1;
  if (filename.includes(query)) return 0.8;
  if (query.includes(filename)) return 0.6;
  return 0;
}

function calculateFolderMatch(filePath: string, query: string): number {
  const folders = filePath.split('/').slice(0, -1);
  const folderMatch = folders.some(f => f.toLowerCase().includes(query));
  return folderMatch ? 0.8 : 0;
}

function calculateSymbolMatch(symbolName: string, query: string): number {
  const lowerSymbol = symbolName.toLowerCase();
  if (lowerSymbol === query) return 1;
  if (lowerSymbol.includes(query)) return 0.8;
  if (query.includes(lowerSymbol)) return 0.6;
  return 0;
}

function calculateKeywordMatch(code: string, queryWords: string[]): number {
  if (queryWords.length === 0) return 0;
  const lowerCode = code.toLowerCase();
  const matchCount = queryWords.filter(word => lowerCode.includes(word)).length;
  return matchCount / queryWords.length;
}

function calculateSummaryMatch(summary: string, query: string): number {
  const lowerSummary = summary.toLowerCase();
  if (lowerSummary === query) return 1;
  if (lowerSummary.includes(query)) return 0.8;
  return 0;
}

function calculateImportMatch(imports: string[], query: string): number {
  if (imports.length === 0) return 0;
  const matchCount = imports.filter(imp => imp.toLowerCase().includes(query)).length;
  return matchCount / imports.length;
}

function calculateExportMatch(exports: string[], query: string): number {
  if (exports.length === 0) return 0;
  const matchCount = exports.filter(exp => exp.toLowerCase().includes(query)).length;
  return matchCount / exports.length;
}
