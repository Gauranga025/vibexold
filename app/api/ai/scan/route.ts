import { NextRequest, NextResponse } from 'next/server';
import { scanRepository } from '@/lib/ai/scanner';
import { chunkFiles } from '@/lib/ai/chunker';
import { RepositoryIndex } from '@/lib/ai/index/repository-index';
import { sessionIndexes, SESSION_TIMEOUT_MS } from '@/lib/ai/session-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rootPath, sessionId } = body;

    if (!rootPath) {
      return NextResponse.json(
        { error: 'rootPath is required' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const scanResult = await scanRepository({
      rootPath,
    });

    if (scanResult.errors.length > 0) {
      console.warn('Scan completed with errors:', scanResult.errors);
    }

    const chunkMap = await chunkFiles(scanResult.files);

    const repositoryIndex = new RepositoryIndex();

    for (const file of scanResult.files) {
      const chunks = chunkMap.get(file.path) || [];
      repositoryIndex.addFile(file, chunks);
    }

    const lastScanTime = new Date();

    // Store in session map
    sessionIndexes.set(sessionId, { repositoryIndex, lastScanTime });

    const stats = repositoryIndex.getStats();

    return NextResponse.json({
      success: true,
      stats: {
        filesScanned: scanResult.fileCount,
        chunksGenerated: stats.chunkCount,
        relationships: stats.relationshipCount,
        folders: stats.folderCount,
        symbols: stats.symbolCount,
        duration: scanResult.duration,
        errors: scanResult.errors.length,
      },
      scannedAt: lastScanTime.toISOString(),
    });
  } catch (error) {
    console.error('Repository scan error:', error);
    return NextResponse.json(
      {
        error: 'Failed to scan repository',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 }
    );
  }

  const session = sessionIndexes.get(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: 'No repository scanned yet for this session' },
      { status: 404 }
    );
  }

  const stats = session.repositoryIndex.getStats();

  return NextResponse.json({
    scanned: true,
    scannedAt: session.lastScanTime.toISOString(),
    stats,
  });
}
