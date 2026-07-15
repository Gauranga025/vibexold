import { NextRequest, NextResponse } from 'next/server';
import { RepositoryIndex } from '@/lib/ai/index/repository-index';
import { classifyIntent } from '@/lib/ai/intent';
import { retrieveChunks } from '@/lib/ai/retriever';
import { buildContext } from '@/lib/ai/context';
import { GeminiProvider } from '@/lib/ai/providers';
import { sessionIndexes } from '@/lib/ai/session-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, currentFile, currentSelection, conversationHistory, sessionId } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const session = sessionIndexes.get(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Repository not scanned for this session. Please scan the repository first.' },
        { status: 400 }
      );
    }

    const repositoryIndex = session.repositoryIndex;

    const intent = classifyIntent(query);

    const retrievalResult = retrieveChunks(
      {
        query,
        intent,
        currentFile,
        maxResults: 15,
      },
      repositoryIndex
    );

    if (retrievalResult.chunks.length === 0) {
      const { fallbackRetrieve } = await import('@/lib/ai/retriever');
      const fallbackResult = fallbackRetrieve(
        { query, intent, currentFile, maxResults: 15 },
        repositoryIndex
      );

      if (fallbackResult.chunks.length > 0) {
        Object.assign(retrievalResult, fallbackResult);
      }
    }

    const context = buildContext(
      {
        query,
        intent,
        retrievalResult,
        currentFile,
        currentSelection,
        conversationHistory,
        repositorySummary: 'This is a Next.js application with WebContainer integration for code editing.',
      },
      repositoryIndex
    );

    const llmProvider = new GeminiProvider();
    const response = await llmProvider.generateResponse(
      context.contextPrompt,
      context.systemPrompt
    );

    return NextResponse.json({
      response,
      metadata: {
        intent,
        chunksRetrieved: retrievalResult.chunks.length,
        totalCandidates: retrievalResult.metadata.totalCandidates,
        estimatedTokens: context.metadata.totalTokens,
        contextLength: context.metadata.estimatedContextLength,
      },
    });
  } catch (error) {
    console.error('AI query error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
