import { Language } from '../types';

export function detectLanguage(content: string, fileName?: string): Language {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const extMap: Record<string, Language> = {
      ts: 'TypeScript',
      tsx: 'TypeScript',
      js: 'JavaScript',
      jsx: 'JavaScript',
      py: 'Python',
      go: 'Go',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      rs: 'Rust',
      php: 'PHP',
      rb: 'Ruby',
    };
    if (ext && extMap[ext]) return extMap[ext];
  }

  if (content.includes('interface ') || content.includes(': string') || content.includes(': number')) {
    return 'TypeScript';
  }
  if (content.includes('def ') || content.includes('import ') || content.includes('class ')) {
    return 'Python';
  }
  if (content.includes('func ') || content.includes('package ') || content.includes('struct ')) {
    return 'Go';
  }
  if (content.includes('public class ') || content.includes('private class ')) {
    return 'Java';
  }
  if (content.includes('class ') && content.includes('extends ')) {
    return 'JavaScript';
  }

  return 'Unknown';
}
