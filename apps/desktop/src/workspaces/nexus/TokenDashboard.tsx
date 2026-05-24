import React, { useEffect, useState } from 'react';
import { useCostStore, type SpendSnapshot } from '../../core/store/useCostStore';

interface TokenDashboardProps {
  sessionId: string;
}

export const TokenDashboard: React.FC<TokenDashboardProps> = ({ sessionId }) => {
  const { config, computeSnapshot } = useCostStore();
  const [snapshot, setSnapshot] = useState<SpendSnapshot | null>(null);

  useEffect(() => {
    const updateSnapshot = () => {
      const snap = computeSnapshot(sessionId);
      setSnapshot(snap);
    };

    updateSnapshot();
    const interval = setInterval(updateSnapshot, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, [sessionId, computeSnapshot]);

  if (!snapshot) return <div className="p-4 text-outline">Loading...</div>;

  const sessionPercent = (snapshot.sessionSpend / config.sessionSpendCap) * 100;
  const dailyPercent = (snapshot.dailySpend / config.dailyBudget) * 100;
  const monthlyPercent = (snapshot.monthlySpend / config.monthlyBudget) * 100;

  return (
    <div className="p-4 bg-surface-container rounded-lg space-y-4">
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-on-surface-variant">Session Budget</span>
          <span className="font-mono text-on-surface">${snapshot.sessionSpend.toFixed(2)} / ${config.sessionSpendCap}</span>
        </div>
        <div className="w-full bg-surface-container-high rounded h-2">
          <div
            className={`h-2 rounded transition-all ${
              sessionPercent > 100 ? 'bg-error' :
              sessionPercent > 75 ? 'bg-warning' :
              'bg-primary'
            }`}
            style={{ width: `${Math.min(sessionPercent, 100)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-on-surface-variant">Daily Budget</span>
          <span className="font-mono text-on-surface">${snapshot.dailySpend.toFixed(2)} / ${config.dailyBudget}</span>
        </div>
        <div className="w-full bg-surface-container-high rounded h-2">
          <div
            className={`h-2 rounded transition-all ${
              dailyPercent > 100 ? 'bg-error' :
              dailyPercent > 75 ? 'bg-warning' :
              'bg-primary'
            }`}
            style={{ width: `${Math.min(dailyPercent, 100)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-on-surface-variant">Monthly Budget</span>
          <span className="font-mono text-on-surface">${snapshot.monthlySpend.toFixed(2)} / ${config.monthlyBudget}</span>
        </div>
        <div className="w-full bg-surface-container-high rounded h-2">
          <div
            className={`h-2 rounded transition-all ${
              monthlyPercent > 100 ? 'bg-error' :
              monthlyPercent > 75 ? 'bg-warning' :
              'bg-primary'
            }`}
            style={{ width: `${Math.min(monthlyPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-on-surface-variant space-y-1">
        <div>Tokens: {snapshot.sessionTokens.toLocaleString()}</div>
        <div>Est. Completion: {(snapshot.estimatedCompletion * 100).toFixed(0)}%</div>
      </div>

      {snapshot.isWarningThreshold && !snapshot.isHardStop && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded text-warning text-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            <span>Approaching spend cap</span>
          </div>
        </div>
      )}

      {snapshot.isHardStop && (
        <div className="p-3 bg-error/10 border border-error/30 rounded text-error text-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">block</span>
            <span>Spend cap reached. New requests blocked.</span>
          </div>
        </div>
      )}
    </div>
  );
};
