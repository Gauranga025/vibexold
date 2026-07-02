export { scanRepository, detectLanguage, detectFramework } from './scanner';
export type { ScannedFile, ScanOptions, ScanResult, ScanError } from './types/scanner';

export { chunkFile, chunkFiles } from './chunker';
export type { CodeChunk, ChunkOptions, ChunkResult } from './types/chunker';

export { RepositoryIndex } from './index/repository-index';
export type { FileMetadata, ChunkMetadata, Relationship } from './types';

export { retrieveChunks, fallbackRetrieve, rankChunks } from './retriever';
export type { RetrievalQuery, RetrievalResult, RankingScore } from './types/retriever';

export { buildContext, getSystemPrompt, buildContextPrompt } from './context';
export type { ContextBuildOptions, BuiltContext } from './context/context-builder';

export { classifyIntent } from './intent';

export { GeminiProvider, type LLMProvider } from './providers';

export type { Language, Framework, ChunkType, Intent } from './types';
