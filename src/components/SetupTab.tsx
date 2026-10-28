import { useCallback } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { useModelLoader } from '../hooks/useModelLoader';

const MODEL_INFO = [
    {
        category: ModelCategory.Audio,
        icon: '🔴',
        iconClass: 'vad',
        name: 'Voice Activity Detection',
        desc: 'Silero VAD v5 — Real-time speech/silence detection',
        coexist: true,
    },
    {
        category: ModelCategory.SpeechRecognition,
        icon: '🎤',
        iconClass: 'stt',
        name: 'Speech-to-Text',
        desc: 'Whisper Tiny English — On-device transcription',
        coexist: true,
    },
    {
        category: ModelCategory.Language,
        icon: '🧠',
        iconClass: 'llm',
        name: 'Language Model',
        desc: 'LFM2 350M — Structured output & briefing generation',
        coexist: true,
    },
    {
        category: ModelCategory.Multimodal,
        icon: '👁️',
        iconClass: 'vlm',
        name: 'Vision Model',
        desc: 'LFM2-VL 450M — Slide & whiteboard text extraction',
        coexist: false,
    },
    {
        category: ModelCategory.SpeechSynthesis,
        icon: '🔊',
        iconClass: 'tts',
        name: 'Text-to-Speech',
        desc: 'Piper TTS — Optional audio briefing playback',
        coexist: true,
    },
];

export function SetupTab() {
    const vadLoader = useModelLoader(ModelCategory.Audio, true);
    const sttLoader = useModelLoader(ModelCategory.SpeechRecognition, true);
    const llmLoader = useModelLoader(ModelCategory.Language, true);
    const vlmLoader = useModelLoader(ModelCategory.Multimodal);
    const ttsLoader = useModelLoader(ModelCategory.SpeechSynthesis, true);

    const loaders = [vadLoader, sttLoader, llmLoader, vlmLoader, ttsLoader];

    const loadAllCore = useCallback(async () => {
        await Promise.all([
            vadLoader.ensure(),
            sttLoader.ensure(),
            llmLoader.ensure(),
        ]);
    }, [vadLoader, sttLoader, llmLoader]);

    const coreReady = vadLoader.state === 'ready'
        && sttLoader.state === 'ready'
        && llmLoader.state === 'ready';

    return (
        <div className="tab-panel">
            <div className="setup-view">
                <div className="setup-header">
                    <h2>⚙️ Model Setup</h2>
                    <p>Download and load AI models for on-device processing</p>
                </div>

                {/* Core models status */}
                <div style={{
                    padding: '12px 16px',
                    background: coreReady ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${coreReady ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'center' as const,
                    color: coreReady ? '#10b981' : '#f59e0b',
                }}>
                    {coreReady
                        ? '✅ Core models ready — VAD + STT + LLM loaded'
                        : '⚠️ Core models needed for recording & briefing generation'
                    }
                </div>

                {/* Model cards */}
                {MODEL_INFO.map((info, i) => {
                    const loader = loaders[i];
                    const isCore = i < 3;

                    return (
                        <div key={info.iconClass} className="model-card">
                            <div className={`model-card-icon ${info.iconClass}`}>
                                {info.icon}
                            </div>
                            <div className="model-card-info">
                                <div className="model-card-name">
                                    {info.name}
                                    {isCore && (
                                        <span style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            marginLeft: 6,
                                            padding: '1px 6px',
                                            borderRadius: 4,
                                            background: 'rgba(99, 102, 241, 0.15)',
                                            color: '#818cf8',
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5,
                                        }}>
                                            Core
                                        </span>
                                    )}
                                </div>
                                <div className="model-card-desc">{info.desc}</div>
                                {(loader.state === 'downloading') && (
                                    <div className="model-card-progress">
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${loader.progress * 100}%` }} />
                                        </div>
                                        <div className="model-card-progress-text">
                                            Downloading... {(loader.progress * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                )}
                                {loader.state === 'loading' && (
                                    <div className="model-card-progress-text" style={{ marginTop: 4 }}>
                                        Loading into engine...
                                    </div>
                                )}
                                {loader.error && (
                                    <div className="model-card-progress-text" style={{ color: '#ef4444', marginTop: 4 }}>
                                        Error: {loader.error}
                                    </div>
                                )}
                            </div>
                            <div className="model-card-status">
                                {loader.state === 'ready' ? (
                                    <div className="status-dot ready" title="Loaded" />
                                ) : loader.state === 'downloading' || loader.state === 'loading' ? (
                                    <div className="status-dot loading" title="Loading" />
                                ) : loader.state === 'error' ? (
                                    <button className="btn btn-sm" onClick={() => loader.ensure()}>
                                        Retry
                                    </button>
                                ) : (
                                    <button className="btn btn-sm" onClick={() => loader.ensure()}>
                                        Load
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Load all core button */}
                {!coreReady && (
                    <div className="setup-load-all">
                        <button className="btn btn-primary btn-lg" onClick={loadAllCore}>
                            🚀 Load All Core Models
                        </button>
                    </div>
                )}

                {/* Info section */}
                <div style={{
                    padding: '16px 20px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    lineHeight: 1.7,
                    color: 'var(--text-muted)',
                }}>
                    <p style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                        🔒 Privacy Guarantee
                    </p>
                    <p>All models run entirely in your browser using WebAssembly. No audio, images, or text ever leave your device. Models are cached locally for instant loading on return visits.</p>
                    <p style={{ marginTop: 8 }}>
                        <strong>Core models (VAD + STT + LLM)</strong> are required for recording and briefing generation.
                        The <strong>Vision model</strong> is optional for slide/whiteboard analysis.
                        <strong>TTS</strong> is optional for audio briefing playback.
                    </p>
                </div>
            </div>
        </div>
    );
}
