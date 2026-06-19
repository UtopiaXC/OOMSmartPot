import React from 'react';

interface DashboardLayoutProps {
  /** Stats / sensor readings section — spans the full width at the top */
  stats: React.ReactNode;
  /** Live camera / stream section */
  live: React.ReactNode;
  /** Pump / control section */
  control: React.ReactNode;
  /** AI assistant (suggestions + upcoming schedule + trigger) */
  ai: React.ReactNode;
  /** System configuration (GET/PUT) */
  configuration: React.ReactNode;
  /** Watering history table — spans the full width */
  history: React.ReactNode;
  /** Optional badge or connection status shown in the header right side */
  headerRight?: React.ReactNode;
}

/**
 * DashboardLayout — the top-level shell for the Plant Monitor dashboard.
 *
 * Slot layout:
 *   ┌─────────────────────────────────────────┐
 *   │  Header: "Plant Monitor"   [headerRight] │
 *   ├─────────────────────────────────────────┤
 *   │           stats (full width)             │
 *   ├──────────────────────┬──────────────────┤
 *   │   live (stream)      │  control (pump)  │
 *   ├──────────────────────┼──────────────────┤
 *   │   ai (assistant)     │  configuration   │
 *   ├──────────────────────┴──────────────────┤
 *   │           history (full width)           │
 *   └─────────────────────────────────────────┘
 */
export function DashboardLayout({
  stats,
  live,
  control,
  ai,
  configuration,
  history,
  headerRight,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-xl" aria-hidden="true">🌱</span>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">Plant Monitor</h1>
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats row — full width */}
        <section aria-label="Sensor statistics">{stats}</section>

        {/* Live stream + pump control */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section aria-label="Live stream">{live}</section>
          <section aria-label="Pump control">{control}</section>
        </div>

        {/* AI assistant + system configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section aria-label="AI assistant">{ai}</section>
          <section aria-label="System configuration">{configuration}</section>
        </div>

        {/* Watering history — full width */}
        <section aria-label="Watering history">{history}</section>
      </main>
    </div>
  );
}
