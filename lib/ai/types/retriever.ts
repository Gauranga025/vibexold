import { ChunkMetadata } from './index';

export interface RetrievalQuery {
  query: string;
  intent?: string;
  currentFile?: string;
  currentSelection?: string;
  maxResults?: number;
}

export interface RetrievalResult {
  chunks: ChunkMetadata[];
  scores: number[];
  metadata: {
    query: string;
    retrievedCount: number;
    totalCandidates: number;
  };
}

export interface RankingScore {
  chunkId: string;
  filenameMatch: number;
  folderMatch: number;
  symbolMatch: number;
  keywordMatch: number;
  summaryMatch: number;
  importMatch: number;
  exportMatch: number;
  totalScore: number;
}
