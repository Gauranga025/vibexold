export type Language = 
  | 'TypeScript' 
  | 'JavaScript' 
  | 'Python' 
  | 'Go' 
  | 'Java' 
  | 'C++' 
  | 'C' 
  | 'Rust' 
  | 'PHP' 
  | 'Ruby' 
  | 'Unknown';

export type Framework = 
  | 'React' 
  | 'Vue' 
  | 'Angular' 
  | 'Next.js' 
  | 'Express' 
  | 'Django' 
  | 'Flask' 
  | 'FastAPI' 
  | 'Spring' 
  | 'None';

export type ChunkType = 
  | 'function' 
  | 'class' 
  | 'interface' 
  | 'type' 
  | 'hook' 
  | 'component' 
  | 'api-route' 
  | 'middleware' 
  | 'utility' 
  | 'module' 
  | 'struct' 
  | 'method' 
  | 'unknown';

export type Intent = 
  | 'explain-code' 
  | 'architecture' 
  | 'repository-question' 
  | 'interview-questions' 
  | 'code-review' 
  | 'find-bug' 
  | 'explain-api' 
  | 'explain-authentication' 
  | 'explain-database' 
  | 'general-chat';

export interface FileMetadata {
  path: string;
  filename: string;
  extension: string;
  language: Language;
  framework: Framework;
  size: number;
  folder: string;
  lastModified: Date;
  chunkCount: number;
}

export interface ChunkMetadata {
  id: string;
  filePath: string;
  chunkType: ChunkType;
  symbolName: string;
  startLine: number;
  endLine: number;
  summary: string;
}

export interface Relationship {
  source: string;
  target: string;
  type: 'import' | 'export' | 'reference';
}
