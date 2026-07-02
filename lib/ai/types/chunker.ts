import { Language, Framework, ChunkType } from './index';

export interface CodeChunk {
  id: string;
  filePath: string;
  relativePath: string;
  chunkType: ChunkType;
  startLine: number;
  endLine: number;
  symbolName: string;
  summary: string;
  imports: string[];
  exports: string[];
  language: Language;
  framework: Framework;
  code: string;
}

export interface ChunkOptions {
  language: Language;
  framework: Framework;
  filePath: string;
  content: string;
}

export interface ChunkResult {
  chunks: CodeChunk[];
  errors: string[];
}
