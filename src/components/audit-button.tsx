'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface AuditButtonProps {
  siteId?: string;
  onComplete?: () => void;
}

interface AuditProgress {
  step: string;
  percent: number;
}

function formatErrorMessage(error: string | undefined): string {
  if (!error) return 'Audit failed due to an unknown error';

  // Make common error messages more user-friendly
  if (error.includes('Cannot parse privateKey')) {
    return 'SSH key configuration error. Please check the WPENGINE_SSH_PRIVATE_KEY setting.';
  }
  if (error.includes('ETIMEDOUT') || error.includes('timeout')) {
    return 'Connection timed out. The server may be busy or unreachable.';
  }
  if (error.includes('ECONNREFUSED')) {
    return 'Connection refused. Please check if the server is running.';
  }
  if (error.includes('authentication') || error.includes('Permission denied')) {
    return 'Authentication failed. Please verify your SSH credentials.';
  }
  if (error.includes('WP-CLI error')) {
    // Extract just the meaningful part of WP-CLI errors
    const match = error.match(/WP-CLI error[^:]*:\s*(.+)/s);
    if (match) {
      const details = match[1].trim().split('\n')[0];
      return `WordPress CLI error: ${details}`;
    }
  }

  // Truncate very long error messages
  if (error.length > 150) {
    return error.substring(0, 147) + '...';
  }

  return error;
}

export function AuditButton({ siteId, onComplete }: AuditButtonProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AuditProgress | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const router = useRouter();

  const pollProgress = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/audits/${id}`);
      if (!response.ok) return;

      const audit = await response.json();

      if (audit.status === 'running' && audit.raw_data?.progress) {
        setProgress(audit.raw_data.progress);
      } else if (audit.status === 'completed') {
        setProgress({ step: 'Complete', percent: 100 });
        setLoading(false);
        setAuditId(null);
        toast.success(`Audit complete! Health score: ${audit.health_score}/100`);
        onComplete?.();
        router.refresh();
      } else if (audit.status === 'failed') {
        setProgress(null);
        setLoading(false);
        setAuditId(null);
        toast.error(formatErrorMessage(audit.error_message));
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  }, [onComplete, router]);

  useEffect(() => {
    if (!auditId || !loading) return;

    const interval = setInterval(() => pollProgress(auditId), 1000);
    return () => clearInterval(interval);
  }, [auditId, loading, pollProgress]);

  const runAudit = async () => {
    setLoading(true);
    setProgress({ step: 'Starting...', percent: 0 });

    try {
      const response = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteId ? { siteId } : { all: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Audit failed');
      }

      if (result.auditId) {
        setAuditId(result.auditId);
      } else {
        // All audits completed
        setLoading(false);
        setProgress(null);
        onComplete?.();
        router.refresh();
      }
    } catch (error) {
      console.error('Audit error:', error);
      setLoading(false);
      setProgress(null);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(formatErrorMessage(message));
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={runAudit}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Running...' : siteId ? 'Run Audit' : 'Audit All Sites'}
      </button>

      {loading && progress && (
        <div className="w-64">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{progress.step}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
