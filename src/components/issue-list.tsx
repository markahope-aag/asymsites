'use client';

import { useState } from 'react';
import { Issue } from '@/lib/types';

interface IssueListProps {
  issues: Issue[];
  onRunAction?: (issue: Issue) => void;
}

export function IssueList({ issues, onRunAction }: IssueListProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const filteredIssues = issues.filter(
    (issue) => filter === 'all' || issue.severity === filter
  );

  const severityColors = {
    critical: 'border-red-500 bg-red-50',
    warning: 'border-yellow-500 bg-yellow-50',
    info: 'border-blue-500 bg-blue-50',
  };

  const severityBadges = {
    critical: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1">
                ({issues.filter((i) => i.severity === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredIssues.map((issue) => (
          <div
            key={issue.id}
            className={`border-l-4 p-4 rounded-r ${severityColors[issue.severity]}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${severityBadges[issue.severity]}`}
                  >
                    {issue.severity}
                  </span>
                  <span className="text-xs text-gray-500 uppercase">
                    {issue.category}
                  </span>
                </div>
                <h4 className="font-medium mt-1">{issue.title}</h4>
                {issue.description && (
                  <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
                )}
                {issue.recommendation && (
                  <p className="text-sm text-gray-500 mt-2 italic">
                    {issue.recommendation}
                  </p>
                )}
              </div>

              {issue.auto_fixable && issue.fix_action && onRunAction && (
                <button
                  onClick={() => onRunAction(issue)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Fix
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredIssues.length === 0 && (
          <p className="text-gray-500 text-center py-8">No issues found</p>
        )}
      </div>
    </div>
  );
}
