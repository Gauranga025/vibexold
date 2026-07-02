import { Language, Framework } from './index';

export interface ScannedFile {
  path: string;
  filename: string;
  extension: string;
  language: Language;
  size: number;
  folder: string;
  framework: Framework;
  lastModified: Date;
  content: string;
}

export interface ScanOptions {
  rootPath: string;
  ignorePatterns?: string[];
  includeExtensions?: string[];
  maxFileSize?: number;
}

export interface ScanResult {
  files: ScannedFile[];
  errors: ScanError[];
  duration: number;
  fileCount: number;
}

export interface ScanError {
  path: string;
  error: string;
}

export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.git',
  '.cache',
  '.vscode',
  '.idea',
];

export const DEFAULT_INCLUDE_EXTENSIONS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'go',
  'java',
  'cpp',
  'c',
  'rs',
  'json',
  'yaml',
  'yml',
  'md',
  'css',
  'scss',
  'html',
];
