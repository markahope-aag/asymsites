import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { runAudit, runAllAudits } from '@/lib/auditor';

function formatAuditError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Cannot parse privateKey')) {
    return 'SSH key configuration error. Please check the WPENGINE_SSH_PRIVATE_KEY environment variable.';
  }
  if (message.includes('Site not found')) {
    return 'Site not found. It may have been deleted.';
  }
  if (message.includes('Failed to create audit')) {
    return 'Could not start the audit. Please try again.';
  }

  return message.length > 150 ? message.substring(0, 147) + '...' : message;
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body. Expected JSON.' },
      { status: 400 }
    );
  }

  const { siteId, all } = body;

  try {
    if (all) {
      const result = await runAllAudits();
      return NextResponse.json({
        ...result,
        message: `Audited ${result.succeeded + result.failed} sites. ${result.succeeded} succeeded, ${result.failed} failed.`
      });
    }

    if (!siteId) {
      return NextResponse.json(
        { error: 'Missing siteId. Please specify which site to audit.' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify site exists first
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, name')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json(
        { error: 'Site not found. It may have been deleted.' },
        { status: 404 }
      );
    }

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
      console.error('Failed to create audit record:', auditError);
      return NextResponse.json(
        { error: 'Could not start the audit. Please try again.' },
        { status: 500 }
      );
    }

    // Start audit asynchronously (don't await)
    runAudit(siteId, audit.id).catch((error) => {
      console.error(`Background audit failed for ${site.name} (${siteId}):`, error);
    });

    // Return immediately with audit ID
    return NextResponse.json({
      auditId: audit.id,
      status: 'started',
      message: `Audit started for ${site.name}`
    });
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { error: formatAuditError(error), details: String(error) },
      { status: 500 }
    );
  }
}
