import { useState, useEffect } from 'react';
import { initSDK, getAccelerationMode } from './runanywhere';
import { CaptureTab } from './components/CaptureTab';
import { BriefingTab } from './components/BriefingTab';
import { SetupTab } from './components/SetupTab';
import type { Briefing } from './types';

type Tab = 'capture' | 'briefing' | 'setup';

export function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('capture');
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [transcript, setTranscript] = useState('');
  const [visualContext, setVisualContext] = useState('');

  useEffect(() => {
    initSDK()
      .then(() => setSdkReady(true))
      .catch((err) => setSdkError(err instanceof Error ? err.message : String(err)));
  }, []);

  const handleBriefingGenerated = (b: Briefing) => {
    setBriefing(b);
    setActiveTab('briefing');
  };

  if (sdkError) {
    return (
      <div className="app-loading">
        <div className="empty-state-icon">⚠️</div>
        <h2>SDK Initialization Error</h2>
        <p className="error-text">{sdkError}</p>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <h2>Initializing SilentScribe 360</h2>
        <p>Preparing on-device AI engines...</p>
      </div>
    );
  }

  const accel = getAccelerationMode();

  return (
    <div className="app">
      <div className="app-bg" />

      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">🔏</span>
          <div className="header-title">
            <h1>SilentScribe 360</h1>
            <span>Zero-Trust Meeting Intelligence</span>
          </div>
        </div>
        <div className="header-right">
          <span className="badge badge-offline">Offline</span>
          {accel && (
            <span className="badge badge-accel">
              {accel === 'webgpu' ? 'WebGPU' : 'CPU'}
            </span>
          )}
        </div>
      </header>

      <nav className="tab-bar">
        <button
          className={activeTab === 'capture' ? 'active' : ''}
          onClick={() => setActiveTab('capture')}
        >
          🎙️ Capture
        </button>
        <button
          className={activeTab === 'briefing' ? 'active' : ''}
          onClick={() => setActiveTab('briefing')}
        >
          📋 Briefing
        </button>
        <button
          className={activeTab === 'setup' ? 'active' : ''}
          onClick={() => setActiveTab('setup')}
        >
          ⚙️ Setup
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'capture' && (
          <CaptureTab
            onBriefingGenerated={handleBriefingGenerated}
            onTranscriptUpdate={setTranscript}
            onVisualContextUpdate={setVisualContext}
          />
        )}
        {activeTab === 'briefing' && (
          <BriefingTab briefing={briefing} />
        )}
        {activeTab === 'setup' && <SetupTab />}
      </main>
    </div>
  );
}
