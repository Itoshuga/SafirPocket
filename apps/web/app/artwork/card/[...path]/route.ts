import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return new NextResponse(null, { status: 404 });
  }
  const { path } = await params;
  if (!path.length || path.some((segment) => !segment || segment === '.' || segment === '..')) {
    return new NextResponse(null, { status: 400 });
  }
  const objectPath = path.map(encodeURIComponent).join('/');
  const response = await fetch(
    `${publicEnv.supabaseUrl}/storage/v1/object/authenticated/card-artworks/${objectPath}`,
    {
      headers: {
        apikey: publicEnv.supabaseAnonKey,
        authorization: `Bearer ${publicEnv.supabaseAnonKey}`,
      },
      next: { revalidate: 300 },
    },
  );
  if (!response.ok || !response.body) return new NextResponse(null, { status: response.status });
  return new NextResponse(response.body, {
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
