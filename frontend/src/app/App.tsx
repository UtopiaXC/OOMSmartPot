import { StatusDot } from '../components/common';
import { StatsView } from '../components/stats';
import { ControlPanel } from '../components/control';
import { LiveStreamView } from '../components/stream';
import { AiAssistantPanel, WateringHistory } from '../components/ai';
import { SystemConfigPanel } from '../components/system';
import { DashboardLayout } from './DashboardLayout';

export default function App() {
  return (
    <DashboardLayout
      headerRight={
        // Sensors, camera, pump, AI assistant and config are all wired to the
        // live OOMSmartPot API — nothing is mocked in the running app.
        <StatusDot status="ok" label="Live backend" />
      }
      stats={<StatsView />}
      live={<LiveStreamView />}
      control={<ControlPanel />}
      ai={<AiAssistantPanel />}
      configuration={<SystemConfigPanel />}
      history={<WateringHistory />}
    />
  );
}
