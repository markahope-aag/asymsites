import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
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

    const supabase = createServerClient();

    // Create audit record first
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .insert({
        site_id: siteId,
        status: 'pending',
        started_at: new Date().toISOString(),
        summary: 'Starting audit...',
        raw_data: { progress: { step: 'Queued', percent: 0 } },
      })
      .select()
      .single();

    if (auditError || !audit) {
      throw new Error(`Failed to create audit: ${auditError?.message}`);
    }

    // Start audit asynchronously (don't await)
    runAudit(siteId, audit.id).catch((error) => {
      console.error(`Background audit failed for ${siteId}:`, error);
    });

    // Return immediately with audit ID
    return NextResponse.json({ auditId: audit.id, status: 'started' });
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { error: 'Audit failed', details: String(error) },
      { status: 500 }
    );
  }
}
