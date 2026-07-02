import { NextRequest, NextResponse } from 'next/server';
import { scanRepository } from '@/lib/ai/scanner';
import { chunkFiles } from '@/lib/ai/chunker';
import { RepositoryIndex } from '@/lib/ai/index/repository-index';

let repositoryIndex: RepositoryIndex | null = null;
let lastScanTime: Date | null = null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rootPath } = body;

    if (!rootPath) {
      return NextResponse.json(
        { error: 'rootPath is required' },
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

    repositoryIndex = new RepositoryIndex();
    
    for (const file of scanResult.files) {
      const chunks = chunkMap.get(file.path) || [];
      repositoryIndex.addFile(file, chunks);
    }

    lastScanTime = new Date();

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
  if (!repositoryIndex) {
    return NextResponse.json(
      { error: 'No repository scanned yet' },
      { status: 404 }
    );
  }

  const stats = repositoryIndex.getStats();

  return NextResponse.json({
    scanned: true,
    scannedAt: lastScanTime?.toISOString(),
    stats,
  });
}
