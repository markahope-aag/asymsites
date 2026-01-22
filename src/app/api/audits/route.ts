import { NextRequest, NextResponse } from 'next/server';
import { runAudit, runAllAudits } from '@/lib/auditor';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { siteId, all } = body;

  try {
    if (all) {
      const result = await runAllAudits();
      return NextResponse.json(result);
    }

    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    const result = await runAudit(siteId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { error: 'Audit failed', details: String(error) },
      { status: 500 }
    );
  }
}
