import * as fs from 'fs';
import * as path from 'path';
import { ScannedFile, ScanOptions, ScanResult, ScanError } from '../types/scanner';
import { detectLanguage } from './language-detector';
import { detectFramework } from './framework-detector';
import { DEFAULT_IGNORE_PATTERNS, DEFAULT_INCLUDE_EXTENSIONS } from '../types/scanner';

export async function scanRepository(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  const files: ScannedFile[] = [];
  const errors: ScanError[] = [];

  const {
    rootPath,
    ignorePatterns = DEFAULT_IGNORE_PATTERNS,
    includeExtensions = DEFAULT_INCLUDE_EXTENSIONS,
    maxFileSize = 1024 * 1024,
  } = options;

  try {
    await scanDirectory(rootPath, rootPath, {
      ignorePatterns,
      includeExtensions,
      maxFileSize,
      files,
      errors,
    });
  } catch (error) {
    errors.push({
      path: rootPath,
      error: error instanceof Error ? error.message : 'Unknown error during scan',
    });
  }

  const duration = Date.now() - startTime;

  return {
    files,
    errors,
    duration,
    fileCount: files.length,
  };
}

interface ScanContext {
  ignorePatterns: string[];
  includeExtensions: string[];
  maxFileSize: number;
  files: ScannedFile[];
  errors: ScanError[];
}

async function scanDirectory(
  dirPath: string,
  rootPath: string,
  context: ScanContext
): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (shouldIgnore(relativePath, context.ignorePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, rootPath, context);
      } else if (entry.isFile()) {
        await scanFile(fullPath, relativePath, context);
      }
    }
  } catch (error) {
    context.errors.push({
      path: dirPath,
      error: error instanceof Error ? error.message : 'Unknown error reading directory',
    });
  }
}

async function scanFile(
  filePath: string,
  relativePath: string,
  context: ScanContext
): Promise<void> {
  try {
    const ext = path.extname(filePath).replace(/^\./, '');
    
    if (!context.includeExtensions.includes(ext)) {
      return;
    }

    const stats = await fs.promises.stat(filePath);

    if (stats.size > context.maxFileSize) {
      context.errors.push({
        path: relativePath,
        error: `File too large (${stats.size} bytes, max ${context.maxFileSize})`,
      });
      return;
    }

    const content = await fs.promises.readFile(filePath, 'utf8');
    const filename = path.basename(filePath);
    const folder = path.dirname(relativePath) || '.';

    const scannedFile: ScannedFile = {
      path: relativePath,
      filename,
      extension: ext,
      language: detectLanguage(content, filename),
      size: stats.size,
      folder,
      framework: detectFramework(content),
      lastModified: stats.mtime,
      content,
    };

    context.files.push(scannedFile);
  } catch (error) {
    context.errors.push({
      path: relativePath,
      error: error instanceof Error ? error.message : 'Unknown error reading file',
    });
  }
}

function shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
  const pathParts = relativePath.split(path.sep);
  
  for (const pattern of ignorePatterns) {
    if (pathParts.some(part => part === pattern || part.startsWith(pattern))) {
      return true;
    }
    if (relativePath.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}
