import { CodeChunk, ChunkOptions, ChunkResult } from '../types/chunker';
import { ChunkType } from '../types';

export function chunkTypeScript(options: ChunkOptions): ChunkResult {
  const { language, framework, filePath, content } = options;
  const chunks: CodeChunk[] = [];
  const errors: string[] = [];
  const lines = content.split('\n');

  const scopeStack: { type: ChunkType; name: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const functionMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?(?:const|function)\s+(\w+)/);
    if (functionMatch) {
      const name = functionMatch[1];
      scopeStack.push({ type: 'function', name, startLine: i });
    }

    const arrowMatch = trimmed.match(/^(\w+)\s*=\s*\(/);
    if (arrowMatch && !trimmed.includes('function')) {
      const name = arrowMatch[1];
      scopeStack.push({ type: 'function', name, startLine: i });
    }

    const classMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?class\s+(\w+)/);
    if (classMatch) {
      const name = classMatch[1];
      scopeStack.push({ type: 'class', name, startLine: i });
    }

    const interfaceMatch = trimmed.match(/^interface\s+(\w+)/);
    if (interfaceMatch) {
      const name = interfaceMatch[1];
      scopeStack.push({ type: 'interface', name, startLine: i });
    }

    const typeMatch = trimmed.match(/^type\s+(\w+)/);
    if (typeMatch) {
      const name = typeMatch[1];
      scopeStack.push({ type: 'type', name, startLine: i });
    }

    const componentMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:const|function)\s+([A-Z]\w+)/);
    if (componentMatch && (content.includes('React') || content.includes('jsx'))) {
      const name = componentMatch[1];
      scopeStack.push({ type: 'component', name, startLine: i });
    }

    const hookMatch = trimmed.match(/^const\s+(use\w+)/);
    if (hookMatch) {
      const name = hookMatch[1];
      scopeStack.push({ type: 'hook', name, startLine: i });
    }

    if (framework === 'Next.js' && trimmed.match(/^(export\s+)?(async\s+)?function/)) {
      scopeStack.push({ type: 'api-route', name: 'api-route', startLine: i });
    }

    if (trimmed.includes('middleware') || trimmed.includes('Middleware')) {
      scopeStack.push({ type: 'middleware', name: 'middleware', startLine: i });
    }

    if (trimmed === '}' && scopeStack.length > 0) {
      const scope = scopeStack.pop();
      if (scope) {
        const chunk = createChunk({
          ...scope,
          endLine: i,
          lines,
          filePath,
          language,
          framework,
        });
        chunks.push(chunk);
      }
    }
  }

  while (scopeStack.length > 0) {
    const scope = scopeStack.pop();
    if (scope) {
      const chunk = createChunk({
        ...scope,
        endLine: lines.length - 1,
        lines,
        filePath,
        language,
        framework,
      });
      chunks.push(chunk);
    }
  }

  if (chunks.length === 0) {
    chunks.push(createChunk({
      type: 'unknown',
      name: 'file',
      startLine: 0,
      endLine: lines.length - 1,
      lines,
      filePath,
      language,
      framework,
    }));
  }

  return { chunks, errors };
}

function createChunk(params: {
  type: ChunkType;
  name: string;
  startLine: number;
  endLine: number;
  lines: string[];
  filePath: string;
  language: any;
  framework: any;
}): CodeChunk {
  const { type, name, startLine, endLine, lines, filePath, language, framework } = params;
  const code = lines.slice(startLine, endLine + 1).join('\n');
  const imports = extractImports(code);
  const exports = extractExports(code);
  const summary = generateSummary(type, name, code);

  return {
    id: generateChunkId(filePath, type, name, startLine),
    filePath,
    relativePath: filePath,
    chunkType: type,
    startLine,
    endLine,
    symbolName: name,
    summary,
    imports,
    exports,
    language,
    framework,
    code,
  };
}

function generateChunkId(filePath: string, type: string, name: string, startLine: number): string {
  return `${filePath}:${type}:${name}:${startLine}`;
}

function extractImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function extractExports(code: string): string[] {
  const exports: string[] = [];
  const exportRegex = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(code)) !== null) {
    exports.push(match[1]);
  }
  return exports;
}

function generateSummary(type: string, name: string, code: string): string {
  const firstLine = code.split('\n')[0].trim();
  if (firstLine.startsWith('//')) {
    return firstLine.substring(2).trim();
  }
  if (firstLine.startsWith('/*')) {
    const commentEnd = code.indexOf('*/');
    if (commentEnd > 0) {
      return code.substring(2, commentEnd).trim();
    }
  }
  return `${type} ${name}`;
}
