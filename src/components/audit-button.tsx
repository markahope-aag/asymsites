'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface AuditButtonProps {
  siteId?: string;
  onComplete?: () => void;
}

interface AuditProgress {
  step: string;
  percent: number;
  started_at?: string;
  estimated_duration?: number;
}

// Step duration estimates (in seconds)
const STEP_ESTIMATES = {
  'Starting audit...': 5,
  'Checking plugins': 30,
  'Analyzing database': 120, // 2 minutes - can be slow
  'Testing performance': 45,
  'Security scan': 90, // 1.5 minutes - checksum verification is slow
  'SEO analysis': 30,
  'Finalizing': 15,
} as const;

// Show concern message after step has been running longer than expected
const getStaleThreshold = (step: string): number => {
  const estimate = STEP_ESTIMATES[step as keyof typeof STEP_ESTIMATES] || 60;
  return estimate * 2000; // 2x the estimate in milliseconds
};

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
    const match = error.match(/WP-CLI error[^:]*:\s*(.+)/);
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
  const [showConcern, setShowConcern] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const stepStartRef = useRef<{ step: string; time: number } | null>(null);
  const router = useRouter();

  const pollProgress = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/audits/${id}`);
      if (!response.ok) return;

      const audit = await response.json();

      if (audit.status === 'running' && audit.raw_data?.progress) {
        const currentStep = audit.raw_data.progress.step;
        setProgress(audit.raw_data.progress);

        // Track step changes and duration
        const now = Date.now();
        if (!stepStartRef.current || stepStartRef.current.step !== currentStep) {
          stepStartRef.current = { step: currentStep, time: now };
          setShowConcern(false);
        } else {
          // Check if current step has been running longer than expected
          const stepDuration = now - stepStartRef.current.time;
          const threshold = getStaleThreshold(currentStep);
          setShowConcern(stepDuration > threshold);
        }
      } else if (audit.status === 'completed') {
        setProgress({ step: 'Complete', percent: 100 });
        setLoading(false);
        setAuditId(null);
        setShowConcern(false);
        stepStartRef.current = null;
        toast.success(`Audit complete! Health score: ${audit.health_score}/100`);
        onComplete?.();
        router.refresh();
      } else if (audit.status === 'failed') {
        setProgress(null);
        setLoading(false);
        setAuditId(null);
        setShowConcern(false);
        stepStartRef.current = null;
        toast.error(formatErrorMessage(audit.error_message));
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  }, [onComplete, router]);

  const cancelAudit = async () => {
    if (!auditId) return;

    setCancelling(true);
    try {
      const response = await fetch(`/api/audits/${auditId}`, { method: 'DELETE' });
      const result = await response.json();

      if (response.ok) {
        toast.success('Audit cancelled');
        setLoading(false);
        setProgress(null);
        setAuditId(null);
        setShowConcern(false);
        stepStartRef.current = null;
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to cancel audit');
      }
    } catch (error) {
      console.error('Error cancelling audit:', error);
      toast.error('Failed to cancel audit');
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!auditId || !loading) return;

    const interval = setInterval(() => pollProgress(auditId), 1000);
    return () => clearInterval(interval);
  }, [auditId, loading, pollProgress]);

  const runAudit = async () => {
    setLoading(true);
    setProgress({ step: 'Starting...', percent: 0 });
    stepStartRef.current = { step: 'Starting...', time: Date.now() };

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
        stepStartRef.current = null;
        onComplete?.();
        router.refresh();
      }
    } catch (error) {
      console.error('Audit error:', error);
      setLoading(false);
      setProgress(null);
      stepStartRef.current = null;
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(formatErrorMessage(message));
    }
  };


  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          onClick={runAudit}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Running...' : siteId ? 'Run Audit' : 'Audit All Sites'}
        </button>

        {showConcern && (
          <button
            onClick={cancelAudit}
            disabled={cancelling}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
      </div>

      {loading && progress && (
        <div className="w-72">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span className="font-medium">{progress.step}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          
          {/* Step duration estimate */}
          <div className="text-xs text-gray-500">
            {(() => {
              const estimate = STEP_ESTIMATES[progress.step as keyof typeof STEP_ESTIMATES];
              if (estimate) {
                const minutes = Math.floor(estimate / 60);
                const seconds = estimate % 60;
                const timeStr = minutes > 0 
                  ? `${minutes}m ${seconds}s` 
                  : `${seconds}s`;
                return `Expected duration: ~${timeStr}`;
              }
              return 'Processing...';
            })()}
          </div>
          
          {/* Show concern message if taking longer than expected */}
          {showConcern && (
            <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              <div className="flex items-center gap-1">
                <span>⏳</span>
                <span>This step is taking longer than usual. Large sites or slow servers can cause delays.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
