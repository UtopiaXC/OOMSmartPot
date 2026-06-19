import { useState } from 'react';
import { Card } from '../common';
import { usePump } from '../../hooks/usePump';
import { PumpControl } from './PumpControl';

/**
 * Top-level pump control panel.
 *
 * Self-contained: creates its own Pump via the factory (RestPump → live API,
 * intercepted by MSW in tests). Owns the selected run duration; delegates all
 * pump state to usePump (optimistic run/stop + status polling).
 */
export function ControlPanel() {
  const { status, error, sending, run, stop, refresh } = usePump();
  const [durationSec, setDurationSec] = useState(5);

  return (
    <Card title="Pump Control">
      <PumpControl
        status={status}
        error={error}
        sending={sending}
        durationSec={durationSec}
        onDurationChange={setDurationSec}
        onRun={() => run(durationSec * 1000)}
        onStop={stop}
        onRetry={refresh}
      />
    </Card>
  );
}
