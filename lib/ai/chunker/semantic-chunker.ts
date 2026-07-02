import { CodeChunk, ChunkOptions, ChunkResult } from '../types/chunker';
import { ScannedFile } from '../types/scanner';
import { chunkTypeScript } from './typescript-chunker';
import { chunkJavaScript } from './javascript-chunker';
import { Language } from '../types';

export async function chunkFile(file: ScannedFile): Promise<ChunkResult> {
  const options: ChunkOptions = {
    language: file.language,
    framework: file.framework,
    filePath: file.path,
    content: file.content,
  };

  switch (file.language) {
    case 'TypeScript':
      return chunkTypeScript(options);
    case 'JavaScript':
      return chunkJavaScript(options);
    case 'Python':
      return chunkPython(options);
    case 'Go':
      return chunkGo(options);
    case 'Java':
      return chunkJava(options);
    default:
      return chunkGeneric(options);
  }
}

export async function chunkFiles(files: ScannedFile[]): Promise<Map<string, CodeChunk[]>> {
  const chunkMap = new Map<string, CodeChunk[]>();

  for (const file of files) {
    try {
      const result = await chunkFile(file);
      chunkMap.set(file.path, result.chunks);
    } catch (error) {
      console.error(`Error chunking file ${file.path}:`, error);
      chunkMap.set(file.path, []);
    }
  }

  return chunkMap;
}

function chunkPython(options: ChunkOptions): ChunkResult {
  const { filePath, content, language, framework } = options;
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  let currentChunk: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('def ') || line.startsWith('async def ')) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      const match = line.match(/def\s+(\w+)/);
      currentChunk = {
        id: `${filePath}:function:${match?.[1] || 'unknown'}:${i}`,
        filePath,
        relativePath: filePath,
        chunkType: 'function',
        startLine: i,
        endLine: i,
        symbolName: match?.[1] || 'unknown',
        summary: `function ${match?.[1] || 'unknown'}`,
        imports: [],
        exports: [],
        language,
        framework,
        code: line,
      };
    } else if (line.startsWith('class ')) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      const match = line.match(/class\s+(\w+)/);
      currentChunk = {
        id: `${filePath}:class:${match?.[1] || 'unknown'}:${i}`,
        filePath,
        relativePath: filePath,
        chunkType: 'class',
        startLine: i,
        endLine: i,
        symbolName: match?.[1] || 'unknown',
        summary: `class ${match?.[1] || 'unknown'}`,
        imports: [],
        exports: [],
        language,
        framework,
        code: line,
      };
    } else if (currentChunk) {
      currentChunk.code += '\n' + line;
      currentChunk.endLine = i;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    chunks.push({
      id: `${filePath}:unknown:file:0`,
      filePath,
      relativePath: filePath,
      chunkType: 'unknown',
      startLine: 0,
      endLine: lines.length - 1,
      symbolName: 'file',
      summary: 'Python file',
      imports: [],
      exports: [],
      language,
      framework,
      code: content,
    });
  }

  return { chunks, errors: [] };
}

function chunkGo(options: ChunkOptions): ChunkResult {
  const { filePath, content, language, framework } = options;
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  let currentChunk: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('func ')) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      const match = line.match(/func\s+(\w+)/);
      currentChunk = {
        id: `${filePath}:function:${match?.[1] || 'unknown'}:${i}`,
        filePath,
        relativePath: filePath,
        chunkType: 'function',
        startLine: i,
        endLine: i,
        symbolName: match?.[1] || 'unknown',
        summary: `function ${match?.[1] || 'unknown'}`,
        imports: [],
        exports: [],
        language,
        framework,
        code: line,
      };
    } else if (line.startsWith('type ') && line.includes('struct')) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      const match = line.match(/type\s+(\w+)\s+struct/);
      currentChunk = {
        id: `${filePath}:struct:${match?.[1] || 'unknown'}:${i}`,
        filePath,
        relativePath: filePath,
        chunkType: 'struct',
        startLine: i,
        endLine: i,
        symbolName: match?.[1] || 'unknown',
        summary: `struct ${match?.[1] || 'unknown'}`,
        imports: [],
        exports: [],
        language,
        framework,
        code: line,
      };
    } else if (currentChunk) {
      currentChunk.code += '\n' + line;
      currentChunk.endLine = i;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    chunks.push({
      id: `${filePath}:unknown:file:0`,
      filePath,
      relativePath: filePath,
      chunkType: 'unknown',
      startLine: 0,
      endLine: lines.length - 1,
      symbolName: 'file',
      summary: 'Go file',
      imports: [],
      exports: [],
      language,
      framework,
      code: content,
    });
  }

  return { chunks, errors: [] };
}

function chunkJava(options: ChunkOptions): ChunkResult {
  const { filePath, content, language, framework } = options;
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  let currentChunk: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('public class ') || line.startsWith('class ')) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      const match = line.match(/class\s+(\w+)/);
      currentChunk = {
        id: `${filePath}:class:${match?.[1] || 'unknown'}:${i}`,
        filePath,
        relativePath: filePath,
        chunkType: 'class',
        startLine: i,
        endLine: i,
        symbolName: match?.[1] || 'unknown',
        summary: `class ${match?.[1] || 'unknown'}`,
        imports: [],
        exports: [],
        language,
        framework,
        code: line,
      };
    } else if (currentChunk) {
      currentChunk.code += '\n' + line;
      currentChunk.endLine = i;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    chunks.push({
      id: `${filePath}:unknown:file:0`,
      filePath,
      relativePath: filePath,
      chunkType: 'unknown',
      startLine: 0,
      endLine: lines.length - 1,
      symbolName: 'file',
      summary: 'Java file',
      imports: [],
      exports: [],
      language,
      framework,
      code: content,
    });
  }

  return { chunks, errors: [] };
}

function chunkGeneric(options: ChunkOptions): ChunkResult {
  const { filePath, content, language, framework } = options;
  const lines = content.split('\n');

  return {
    chunks: [{
      id: `${filePath}:unknown:file:0`,
      filePath,
      relativePath: filePath,
      chunkType: 'unknown',
      startLine: 0,
      endLine: lines.length - 1,
      symbolName: 'file',
      summary: `${language} file`,
      imports: [],
      exports: [],
      language,
      framework,
      code: content,
    }],
    errors: [],
  };
}
