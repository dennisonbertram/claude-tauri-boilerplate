import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { API_BASE } from './constants';

interface ResourceUsage {
  cpuUsagePercent: number;
  memoryUsageMb: number;
  memoryUsagePercent: number;
}

export function ResourceUsageSegment() {
  const { settings } = useSettings();
  const [usage, setUsage] = useState<ResourceUsage | null>(null);

  useEffect(() => {
    if (!settings.showResourceUsage) {
      setUsage(null);
      return;
    }

    let cancelled = false;

    async function fetchResourceUsage() {
      try {
        const res = await fetch(`${API_BASE}/api/system/diagnostics`);
        if (!res.ok) return;
        const data = (await res.json()) as ResourceUsage;
        if (!cancelled) {
          setUsage(data);
        }
      } catch {
        if (!cancelled) setUsage(null);
      }
    }

    void fetchResourceUsage();
    const interval = setInterval(fetchResourceUsage, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [settings.showResourceUsage]);

  if (!settings.showResourceUsage || !usage) return null;

  const cpuText = `${Math.round(usage.cpuUsagePercent * 10) / 10}%`;
  const memText = `${Math.round(usage.memoryUsageMb)} MB`;

  return (
    <div
      data-testid="resource-usage-segment"
      className="flex items-center gap-1 px-1.5 py-0.5"
      title={`CPU: ${cpuText}  Memory: ${memText} (${Math.round(usage.memoryUsagePercent * 10) / 10}%)`}
    >
      <span className="tabular-nums" data-testid="resource-usage-cpu">
        {cpuText}
      </span>
      <span className="text-muted-foreground/60">/</span>
      <span className="tabular-nums" data-testid="resource-usage-memory">
        {memText}
      </span>
    </div>
  );
}
