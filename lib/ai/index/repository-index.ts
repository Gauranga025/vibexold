import { ScannedFile } from '../types/scanner';
import { CodeChunk } from '../types/chunker';
import { FileMetadata, ChunkMetadata, Relationship } from '../types';

export class RepositoryIndex {
  private files: Map<string, FileMetadata> = new Map();
  private chunks: Map<string, ChunkMetadata> = new Map();
  private chunkContent: Map<string, CodeChunk> = new Map();
  private relationships: Relationship[] = [];
  private folderHierarchy: Map<string, string[]> = new Map();
  private symbolIndex: Map<string, string[]> = new Map();

  constructor() {}

  addFile(file: ScannedFile, chunks: CodeChunk[]): void {
    const fileMetadata: FileMetadata = {
      path: file.path,
      filename: file.filename,
      extension: file.extension,
      language: file.language,
      framework: file.framework,
      size: file.size,
      folder: file.folder,
      lastModified: file.lastModified,
      chunkCount: chunks.length,
    };

    this.files.set(file.path, fileMetadata);

    for (const chunk of chunks) {
      const chunkMetadata: ChunkMetadata = {
        id: chunk.id,
        filePath: chunk.filePath,
        chunkType: chunk.chunkType,
        symbolName: chunk.symbolName,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        summary: chunk.summary,
      };

      this.chunks.set(chunk.id, chunkMetadata);
      this.chunkContent.set(chunk.id, chunk);

      const symbolChunks = this.symbolIndex.get(chunk.symbolName) || [];
      symbolChunks.push(chunk.id);
      this.symbolIndex.set(chunk.symbolName, symbolChunks);

      for (const imp of chunk.imports) {
        this.relationships.push({
          source: chunk.id,
          target: imp,
          type: 'import',
        });
      }

      for (const exp of chunk.exports) {
        this.relationships.push({
          source: chunk.id,
          target: exp,
          type: 'export',
        });
      }
    }

    const folderPath = file.folder;
    const folderFiles = this.folderHierarchy.get(folderPath) || [];
    folderFiles.push(file.path);
    this.folderHierarchy.set(folderPath, folderFiles);
  }

  getFile(path: string): FileMetadata | undefined {
    return this.files.get(path);
  }

  getAllFiles(): FileMetadata[] {
    return Array.from(this.files.values());
  }

  getChunk(id: string): ChunkMetadata | undefined {
    return this.chunks.get(id);
  }

  getChunkContent(id: string): CodeChunk | undefined {
    return this.chunkContent.get(id);
  }

  getAllChunks(): ChunkMetadata[] {
    return Array.from(this.chunks.values());
  }

  getChunksByFile(filePath: string): ChunkMetadata[] {
    return Array.from(this.chunks.values()).filter(c => c.filePath === filePath);
  }

  getChunksBySymbol(symbolName: string): ChunkMetadata[] {
    const chunkIds = this.symbolIndex.get(symbolName) || [];
    return chunkIds.map(id => this.chunks.get(id)).filter(Boolean) as ChunkMetadata[];
  }

  getChunksByFolder(folder: string): ChunkMetadata[] {
    const filePaths = this.folderHierarchy.get(folder) || [];
    return Array.from(this.chunks.values()).filter(c => filePaths.includes(c.filePath));
  }

  getRelationships(): Relationship[] {
    return this.relationships;
  }

  getFolderHierarchy(): Map<string, string[]> {
    return this.folderHierarchy;
  }

  searchChunks(query: string): ChunkMetadata[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.chunks.values()).filter(chunk => {
      const chunkContent = this.chunkContent.get(chunk.id);
      if (!chunkContent) return false;

      return (
        chunk.symbolName.toLowerCase().includes(lowerQuery) ||
        chunk.summary.toLowerCase().includes(lowerQuery) ||
        chunk.filePath.toLowerCase().includes(lowerQuery) ||
        chunkContent.code.toLowerCase().includes(lowerQuery)
      );
    });
  }

  clear(): void {
    this.files.clear();
    this.chunks.clear();
    this.chunkContent.clear();
    this.relationships = [];
    this.folderHierarchy.clear();
    this.symbolIndex.clear();
  }

  getStats(): {
    fileCount: number;
    chunkCount: number;
    relationshipCount: number;
    folderCount: number;
    symbolCount: number;
  } {
    return {
      fileCount: this.files.size,
      chunkCount: this.chunks.size,
      relationshipCount: this.relationships.length,
      folderCount: this.folderHierarchy.size,
      symbolCount: this.symbolIndex.size,
    };
  }
}
