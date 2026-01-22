import { NextRequest, NextResponse } from 'next/server';
import { syncSingleWPEngineSiteName } from '@/lib/utils/sync-wpengine-names';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const siteName = await syncSingleWPEngineSiteName(id);
    
    return NextResponse.json({ 
      success: true, 
      wpengine_site_name: siteName,
      message: `Updated WPEngine site name: ${siteName}` 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}