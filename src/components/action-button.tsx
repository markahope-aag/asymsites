'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ActionButtonProps {
  siteId: string;
  action: string;
  label: string;
  params?: Record<string, unknown>;
  variant?: 'primary' | 'secondary' | 'danger';
  onComplete?: () => void;
}

export function ActionButton({
  siteId,
  action,
  label,
  params,
  variant = 'secondary',
  onComplete,
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  const runAction = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, action, params }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Action failed');
      }

      onComplete?.();
      router.refresh();
    } catch (error) {
      console.error('Action error:', error);
      alert(`Action failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={runAction}
      disabled={loading}
      className={`px-4 py-2 rounded disabled:opacity-50 ${variantClasses[variant]}`}
    >
      {loading ? 'Running...' : label}
    </button>
  );
}
