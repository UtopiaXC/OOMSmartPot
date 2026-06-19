import { useCallback, useEffect, useRef, useState } from 'react';
import { createSystemConfigClient } from '../system';
import type { SystemConfigClient } from '../system';
import type { SystemConfig } from '../system/types';

interface UseSystemConfigResult {
  config: SystemConfig | null;
  loading: boolean;
  error: string | null;
  /** True while a PUT save is in flight. */
  saving: boolean;
  /** True once a save has just succeeded (clears on the next edit/save). */
  saved: boolean;
  refresh: () => void;
  /** Persist the given config via PUT. */
  save: (next: SystemConfig) => void;
}

/**
 * Loads the backend system configuration and exposes a `save` (PUT) action with
 * loading / saved / error feedback.
 */
export function useSystemConfig(
  client: SystemConfigClient = createSystemConfigClient(),
): UseSystemConfigResult {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const clientRef = useRef<SystemConfigClient>(client);
  clientRef.current = client;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setConfig(await clientRef.current.get());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (next: SystemConfig) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const confirmed = await clientRef.current.update(next);
      setConfig(confirmed);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    config,
    loading,
    error,
    saving,
    saved,
    refresh: () => void refresh(),
    save: (next) => void save(next),
  };
}
