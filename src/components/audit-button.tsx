'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuditButtonProps {
  siteId?: string;
  onComplete?: () => void;
}

export function AuditButton({ siteId, onComplete }: AuditButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const runAudit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteId ? { siteId } : { all: true }),
      });

      if (!response.ok) {
        throw new Error('Audit failed');
      }

      onComplete?.();
      router.refresh();
    } catch (error) {
      console.error('Audit error:', error);
      alert('Audit failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={runAudit}
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Running...' : siteId ? 'Run Audit' : 'Audit All Sites'}
    </button>
  );
}
