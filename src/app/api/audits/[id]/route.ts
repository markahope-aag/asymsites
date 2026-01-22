import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// Cancel/fail a stuck audit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // Only allow canceling running or pending audits
  const { data: audit, error: fetchError } = await supabase
    .from('audits')
    .select('status')
    .eq('id', id)
    .single();

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  if (audit.status !== 'running' && audit.status !== 'pending') {
    return NextResponse.json(
      { error: 'Can only cancel running or pending audits' },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from('audits')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: 'Audit was manually cancelled',
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel audit' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Audit cancelled successfully' });
}
