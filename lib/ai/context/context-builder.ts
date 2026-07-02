import { RepositoryIndex } from '../index';
import { RetrievalResult } from '../types/retriever';
import { getSystemPrompt, buildContextPrompt } from './prompt-templates';
import { Intent } from '../types';

const MAX_TOKENS = 100000; // Conservative limit for Gemini 2.5 Flash
const TOKENS_PER_CHAR = 0.25; // Approximate token to character ratio

export interface ContextBuildOptions {
  query: string;
  intent?: Intent;
  retrievalResult: RetrievalResult;
  currentFile?: string;
  currentSelection?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  repositorySummary?: string;
}

export interface BuiltContext {
  systemPrompt: string;
  contextPrompt: string;
  metadata: {
    chunkCount: number;
    totalTokens: number;
    estimatedContextLength: number;
    truncated: boolean;
  };
}

export function buildContext(
  options: ContextBuildOptions,
  index: RepositoryIndex
): BuiltContext {
  const {
    query,
    intent,
    retrievalResult,
    currentFile,
    currentSelection,
    conversationHistory = [],
    repositorySummary,
  } = options;

  const systemPrompt = getSystemPrompt(intent);

  // Build all context components
  const chunkContents = retrievalResult.chunks.map(chunk => {
    const chunkData = index.getChunkContent(chunk.id);
    const fileData = index.getFile(chunk.filePath);
    if (!chunkData) return '';
    
    const language = fileData?.language || 'Unknown';
    
    return `### ${chunk.symbolName} (${chunk.chunkType})
**File:** ${chunk.filePath}
**Lines:** ${chunk.startLine}-${chunk.endLine}
**Summary:** ${chunk.summary}

\`\`\`${language.toLowerCase()}
${chunkData.code}
\`\`\``;
  });

  const fileSummaries = retrievalResult.chunks
    .map(chunk => {
      const file = index.getFile(chunk.filePath);
      if (!file) return '';
      return `**${file.path}** (${file.language}, ${file.framework}) - ${file.chunkCount} chunks`;
    })
    .filter(Boolean);

  const uniqueFolders = [...new Set(retrievalResult.chunks.map(c => c.filePath.split('/')[0]))];
  const folderSummaries = uniqueFolders.map(folder => {
    const chunksInFolder = index.getChunksByFolder(folder);
    return `**${folder}** - ${chunksInFolder.length} chunks`;
  });

  const formattedHistory = conversationHistory
    .slice(-5)
    .map(msg => `${msg.role}: ${msg.content}`);

  // Build context with token management
  const { contextPrompt, truncated } = buildContextWithTokenLimit({
    repositorySummary,
    folderSummaries,
    fileSummaries,
    chunks: chunkContents,
    currentFile,
    currentSelection,
    conversationHistory: formattedHistory,
    userQuery: query,
    systemPrompt,
  });

  const totalText = systemPrompt + contextPrompt;
  const estimatedTokens = Math.ceil(totalText.length * TOKENS_PER_CHAR);

  return {
    systemPrompt,
    contextPrompt,
    metadata: {
      chunkCount: retrievalResult.chunks.length,
      totalTokens: estimatedTokens,
      estimatedContextLength: totalText.length,
      truncated,
    },
  };
}

function buildContextWithTokenLimit(params: {
  repositorySummary?: string;
  folderSummaries: string[];
  fileSummaries: string[];
  chunks: string[];
  currentFile?: string;
  currentSelection?: string;
  conversationHistory: string[];
  userQuery: string;
  systemPrompt: string;
}): { contextPrompt: string; truncated: boolean } {
  const {
    repositorySummary,
    folderSummaries,
    fileSummaries,
    chunks,
    currentFile,
    currentSelection,
    conversationHistory,
    userQuery,
    systemPrompt,
  } = params;

  let availableTokens = MAX_TOKENS - Math.ceil(systemPrompt.length * TOKENS_PER_CHAR);
  let truncated = false;

  const sections: string[] = [];

  // Priority 1: Current Selection (if available)
  if (currentSelection) {
    const tokens = Math.ceil(currentSelection.length * TOKENS_PER_CHAR);
    if (tokens <= availableTokens) {
      sections.push(`## Current Selection\n${currentSelection}\n`);
      availableTokens -= tokens;
    } else {
      truncated = true;
    }
  }

  // Priority 2: Current File (if available)
  if (currentFile) {
    const tokens = Math.ceil(currentFile.length * TOKENS_PER_CHAR);
    if (tokens <= availableTokens) {
      sections.push(`## Current File\n${currentFile}\n`);
      availableTokens -= tokens;
    } else {
      truncated = true;
    }
  }

  // Priority 3: Most Relevant Chunks (sorted by relevance)
  const sortedChunks = [...chunks].reverse(); // Assuming chunks are already ranked
  for (const chunk of sortedChunks) {
    if (availableTokens <= 0) {
      truncated = true;
      break;
    }
    const tokens = Math.ceil(chunk.length * TOKENS_PER_CHAR);
    if (tokens <= availableTokens) {
      sections.push(chunk);
      availableTokens -= tokens;
    } else {
      truncated = true;
    }
  }

  // Priority 4: File Summaries
  for (const summary of fileSummaries) {
    if (availableTokens <= 0) {
      truncated = true;
      break;
    }
    const tokens = Math.ceil(summary.length * TOKENS_PER_CHAR);
    if (tokens <= availableTokens) {
      sections.push(summary);
      availableTokens -= tokens;
    } else {
      truncated = true;
    }
  }

  // Priority 5: Folder Summaries
  if (folderSummaries.length > 0 && availableTokens > 0) {
    const folderText = `## Relevant Folders\n${folderSummaries.join('\n\n')}\n`;
    const tokens = Math.ceil(folderText.length * TOKENS_PER_CHAR);
    if (tokens <= availableTokens) {
      sections.push(folderText);
      availableTokens -= tokens;
    } else {
      truncated = true;
    }
  }

  // Priority 6: Repository Summary
  if (repositorySummary && availableTokens > 0) {
    const tokens = Math.ceil(repositorySummary.length * TOKENS_PER_CHAR);
    if (tokens <= availableTokens) {
      sections.push(`## Repository Summary\n${repositorySummary}\n`);
      availableTokens -= tokens;
    } else {
      truncated = true;
    }
  }

  // Priority 7: Conversation History (last messages)
  for (const msg of conversationHistory) {
    if (availableTokens <= 0) {
      truncated = true;
      break;
    }
    const tokens = Math.ceil(msg.length * TOKENS_PER_CHAR);
    if (tokens <= availableTokens) {
      sections.push(msg);
      availableTokens -= tokens;
    } else {
      truncated = true;
    }
  }

  // Always include user query
  sections.push(`## Question\n${userQuery}`);

  const contextPrompt = sections.join('\n\n');

  return { contextPrompt, truncated };
}
