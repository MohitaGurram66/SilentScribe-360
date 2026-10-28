import { useState, useRef, useCallback, useEffect } from 'react';
import { ModelManager, ModelCategory } from '@runanywhere/web';
import { VAD, SpeechActivity, AudioCapture, STT } from '@runanywhere/web-onnx';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { useModelLoader } from '../hooks/useModelLoader';
import { VisualContext } from './VisualContext';
import type { Briefing, TranscriptSegment } from '../types';

const MAX_DURATION = 60; // seconds
const WAVEFORM_BARS = 30;

interface Props {
    onBriefingGenerated: (briefing: Briefing) => void;
    onTranscriptUpdate: (text: string) => void;
    onVisualContextUpdate: (text: string) => void;
}

type CaptureState = 'idle' | 'loading' | 'recording' | 'processing';

export function CaptureTab({ onBriefingGenerated, onTranscriptUpdate, onVisualContextUpdate }: Props) {
    // Model loaders
    const vadLoader = useModelLoader(ModelCategory.Audio, true);
    const sttLoader = useModelLoader(ModelCategory.SpeechRecognition, true);
    const llmLoader = useModelLoader(ModelCategory.Language, true);

    // State
    const [captureState, setCaptureState] = useState<CaptureState>('idle');
    const [elapsed, setElapsed] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [segments, setSegments] = useState<TranscriptSegment[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [processingStep, setProcessingStep] = useState('');
    const [visualContextText, setVisualContextText] = useState('');
    const [waveformLevels, setWaveformLevels] = useState<number[]>(new Array(WAVEFORM_BARS).fill(0));

    // Refs
    const micRef = useRef<AudioCapture | null>(null);
    const vadUnsubRef = useRef<(() => void) | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef(0);
    const segmentIdRef = useRef(0);
    const allAudioRef = useRef<Float32Array[]>([]);
    const transcriptRef = useRef('');
    const waveformRef = useRef<number[]>(new Array(WAVEFORM_BARS).fill(0));
    const isTranscribingRef = useRef(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            micRef.current?.stop();
            vadUnsubRef.current?.();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Ensure VAD + STT + LLM models are loaded
    const ensureModels = useCallback(async (): Promise<boolean> => {
        setCaptureState('loading');
        setError(null);

        try {
            const results = await Promise.all([
                vadLoader.ensure(),
                sttLoader.ensure(),
                llmLoader.ensure(),
            ]);

            if (results.every(Boolean)) {
                setCaptureState('idle');
                return true;
            }

            setError('Failed to load required models. Go to Setup tab to download them.');
            setCaptureState('idle');
            return false;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setCaptureState('idle');
            return false;
        }
    }, [vadLoader, sttLoader, llmLoader]);

    // Transcribe a speech segment
    const transcribeSegment = useCallback(async (audioSamples: Float32Array) => {
        if (isTranscribingRef.current) return;
        isTranscribingRef.current = true;

        try {
            const result = await STT.transcribe(audioSamples);
            if (result && result.text && result.text.trim().length > 0) {
                const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
                const mins = Math.floor(elapsedSec / 60);
                const secs = elapsedSec % 60;
                const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;

                const newSegment: TranscriptSegment = {
                    id: segmentIdRef.current++,
                    text: result.text.trim(),
                    startTime: elapsedSec,
                    timestamp,
                };

                setSegments(prev => [...prev, newSegment]);
                transcriptRef.current += (transcriptRef.current ? ' ' : '') + result.text.trim();
                onTranscriptUpdate(transcriptRef.current);
            }
        } catch (err) {
            console.error('STT error:', err);
        } finally {
            isTranscribingRef.current = false;
        }
    }, [onTranscriptUpdate]);

    // Start recording
    const startRecording = useCallback(async () => {
        setSegments([]);
        setError(null);
        transcriptRef.current = '';
        segmentIdRef.current = 0;
        allAudioRef.current = [];

        // Ensure models are loaded
        const anyMissing = !ModelManager.getLoadedModel(ModelCategory.Audio)
            || !ModelManager.getLoadedModel(ModelCategory.SpeechRecognition)
            || !ModelManager.getLoadedModel(ModelCategory.Language);

        if (anyMissing) {
            const ok = await ensureModels();
            if (!ok) return;
        }

        setCaptureState('recording');
        startTimeRef.current = Date.now();
        setElapsed(0);

        // Timer
        timerRef.current = setInterval(() => {
            const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setElapsed(secs);
            if (secs >= MAX_DURATION) {
                stopRecording();
            }
        }, 500);

        // Setup VAD
        const mic = new AudioCapture({ sampleRate: 16000 });
        micRef.current = mic;
        VAD.reset();

        vadUnsubRef.current = VAD.onSpeechActivity((activity) => {
            if (activity === SpeechActivity.Started || activity === SpeechActivity.Ongoing) {
                setIsSpeaking(true);
            }
            if (activity === SpeechActivity.Ended) {
                setIsSpeaking(false);
                const segment = VAD.popSpeechSegment();
                if (segment && segment.samples.length > 1600) {
                    // Store audio and transcribe
                    allAudioRef.current.push(new Float32Array(segment.samples));
                    transcribeSegment(segment.samples);
                }
            }
        });

        await mic.start(
            (chunk) => {
                VAD.processSamples(chunk);
            },
            (level) => {
                setAudioLevel(level);
                // Update waveform with shifting
                const newLevels = [...waveformRef.current];
                newLevels.shift();
                newLevels.push(level);
                waveformRef.current = newLevels;
                setWaveformLevels([...newLevels]);
            },
        );
    }, [ensureModels, transcribeSegment]);

    // Stop recording
    const stopRecording = useCallback(() => {
        micRef.current?.stop();
        vadUnsubRef.current?.();
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        VAD.flush();
        setIsSpeaking(false);
        setAudioLevel(0);
        setWaveformLevels(new Array(WAVEFORM_BARS).fill(0));
        setCaptureState('idle');
    }, []);

    // Cancel ref for briefing generation
    const cancelBriefingRef = useRef(false);

    // Generate the executive briefing
    const generateBriefing = useCallback(async () => {
        const fullTranscript = transcriptRef.current.trim();
        if (!fullTranscript) {
            setError('No transcript available. Please record a conversation first.');
            return;
        }

        setCaptureState('processing');
        setError(null);
        cancelBriefingRef.current = false;
        const genStart = Date.now();

        try {
            // Ensure LLM is loaded
            if (!ModelManager.getLoadedModel(ModelCategory.Language)) {
                setProcessingStep('Loading language model...');
                await llmLoader.ensure();
            }

            if (cancelBriefingRef.current) {
                setCaptureState('idle');
                setProcessingStep('');
                return;
            }

            setProcessingStep('Summarizing transcript...');

            // Truncate transcript if too long (small model can't handle much)
            const truncated = fullTranscript.length > 300
                ? fullTranscript.substring(0, 300) + '...'
                : fullTranscript;

            // Simple, short prompt — 350M models need very direct instructions
            const prompt = `Summarize this meeting in 2 sentences:\n\n${truncated}\n\nSummary:`;

            // Use generateStream with a timeout
            let summaryText = '';
            const timeoutMs = 60000; // 60 second max

            const { stream, cancel } = await TextGeneration.generateStream(prompt, {
                maxTokens: 64,
                temperature: 0.2,
            });

            const timeoutId = setTimeout(() => {
                cancel();
            }, timeoutMs);

            for await (const token of stream) {
                if (cancelBriefingRef.current) {
                    cancel();
                    break;
                }
                summaryText += token;
                // Stop if we get a reasonable ending
                if (summaryText.length > 20 && (summaryText.endsWith('.') || summaryText.endsWith('!'))) {
                    const sentenceCount = (summaryText.match(/[.!?]/g) || []).length;
                    if (sentenceCount >= 2) {
                        cancel();
                        break;
                    }
                }
            }

            clearTimeout(timeoutId);

            if (cancelBriefingRef.current) {
                setCaptureState('idle');
                setProcessingStep('');
                return;
            }

            setProcessingStep('Building briefing...');

            // Clean up summary
            summaryText = summaryText.trim();
            if (!summaryText || summaryText.length < 5) {
                summaryText = `Meeting conversation captured with ${fullTranscript.split(/\s+/).length} words of dialogue.`;
            }

            // Build structured briefing through LOCAL text parsing (not LLM)
            const sentences = fullTranscript.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

            // Extract key points = first 3-5 distinct sentences
            const keyPoints = sentences.slice(0, Math.min(5, sentences.length));

            // Look for decisions (keywords: decided, agreed, will use, going with, chose)
            const decisionKeywords = /\b(decid|agreed|will use|going with|chose|chosen|confirmed|approved)\b/i;
            const decisions = sentences.filter(s => decisionKeywords.test(s)).slice(0, 3);

            // Look for action items (keywords: will, need to, should, must, has to, assigned)
            const actionKeywords = /\b(will|need to|should|must|has to|assigned|responsible|handle|prepare|finalize)\b/i;
            const actionSentences = sentences.filter(s => actionKeywords.test(s)).slice(0, 5);
            const actionItems = actionSentences.map(s => {
                // Try to extract owner from sentence
                const nameMatch = s.match(/\b([A-Z][a-z]+)\s+(will|should|needs?|must|has)\b/);
                return {
                    task: s,
                    owner: nameMatch ? nameMatch[1] : 'TBD',
                    deadline: 'TBD',
                };
            });

            // Look for open questions (keywords: ?, unclear, undecided, revisit, TBD)
            const questionKeywords = /\b(unclear|undecided|revisit|tbd|not sure|question|concern|whether|still need)\b/i;
            const openQuestions = sentences
                .filter(s => questionKeywords.test(s) || s.includes('?'))
                .slice(0, 3);

            const processingTimeMs = Date.now() - genStart;

            const briefing: Briefing = {
                executiveSummary: summaryText,
                keyPoints: keyPoints.length > 0 ? keyPoints : ['Meeting conversation was captured and transcribed.'],
                decisions: decisions,
                actionItems: actionItems,
                openQuestions: openQuestions,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    durationSeconds: elapsed || Math.floor((Date.now() - startTimeRef.current) / 1000),
                    wordCount: fullTranscript.split(/\s+/).length,
                    hasVisualContext: !!visualContextText,
                    modelUsed: 'LFM2-350M',
                    tokensUsed: summaryText.split(/\s+/).length,
                    processingTimeMs,
                },
            };

            onBriefingGenerated(briefing);
        } catch (err) {
            if (!cancelBriefingRef.current) {
                setError(`Briefing generation failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        } finally {
            setCaptureState('idle');
            setProcessingStep('');
        }
    }, [elapsed, llmLoader, onBriefingGenerated, visualContextText]);

    // Cancel briefing generation
    const cancelBriefing = useCallback(() => {
        cancelBriefingRef.current = true;
        setCaptureState('idle');
        setProcessingStep('');
    }, []);

    const handleVisualContext = useCallback((text: string) => {
        setVisualContextText(text);
        onVisualContextUpdate(text);
    }, [onVisualContextUpdate]);

    // Format time display
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Timer ring properties
    const circumference = 2 * Math.PI * 70;
    const progress = elapsed / MAX_DURATION;
    const dashOffset = circumference * (1 - progress);

    const isRecording = captureState === 'recording';
    const isProcessing = captureState === 'processing';

    return (
        <div className="tab-panel" style={{ position: 'relative' }}>
            {/* Processing overlay */}
            {isProcessing && (
                <div className="processing-overlay">
                    <div className="processing-spinner" />
                    <div className="processing-text">{processingStep || 'Processing...'}</div>
                    <div className="processing-sub">All processing happens on your device (max 60s)</div>
                    <button
                        className="btn btn-danger"
                        style={{ marginTop: 16 }}
                        onClick={cancelBriefing}
                    >
                        ✕ Cancel
                    </button>
                </div>
            )}

            <div className="capture-view">
                {/* Timer Section */}
                <div className="timer-section">
                    <div className="timer-ring">
                        <svg viewBox="0 0 160 160">
                            <defs>
                                <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#06b6d4" />
                                </linearGradient>
                            </defs>
                            <circle className="timer-ring-bg" cx="80" cy="80" r="70" />
                            <circle
                                className="timer-ring-progress"
                                cx="80" cy="80" r="70"
                                strokeDasharray={circumference}
                                strokeDashoffset={isRecording ? dashOffset : circumference}
                            />
                        </svg>
                        <div className="timer-content">
                            <span className="timer-time">{formatTime(elapsed)}</span>
                            <span className="timer-label">
                                {isRecording ? `/ ${formatTime(MAX_DURATION)}` : 'Ready'}
                            </span>
                        </div>
                    </div>

                    {/* Waveform */}
                    {isRecording && (
                        <div className="waveform-container">
                            {waveformLevels.map((level, i) => (
                                <div
                                    key={i}
                                    className={`waveform-bar ${isSpeaking ? 'speaking' : ''}`}
                                    style={{ height: `${Math.max(4, level * 50)}px` }}
                                />
                            ))}
                        </div>
                    )}

                    {/* VAD indicator */}
                    {isRecording && (
                        <div className={`vad-indicator ${isSpeaking ? 'speaking' : 'silent'}`}>
                            <span className="vad-dot" />
                            {isSpeaking ? 'Speech Detected' : 'Listening...'}
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="capture-controls">
                    {captureState === 'idle' && (
                        <>
                            <button className="btn btn-primary btn-lg" onClick={startRecording}>
                                🎙️ Start Recording
                            </button>
                            {segments.length > 0 && (
                                <button className="btn btn-success btn-lg" onClick={generateBriefing}>
                                    📋 Generate Briefing
                                </button>
                            )}
                        </>
                    )}
                    {captureState === 'loading' && (
                        <button className="btn btn-lg" disabled>
                            ⏳ Loading Models...
                        </button>
                    )}
                    {isRecording && (
                        <button className="btn btn-danger btn-lg" onClick={stopRecording}>
                            ⏹ Stop Recording
                        </button>
                    )}
                </div>

                {/* Live Transcript */}
                <div className="live-transcript">
                    <div className="live-transcript-header">
                        <h3>Live Transcript</h3>
                        {isRecording && <span className="live-badge">● LIVE</span>}
                    </div>
                    <div className="transcript-segments">
                        {segments.length === 0 ? (
                            <p className="transcript-placeholder">
                                {isRecording
                                    ? 'Waiting for speech...'
                                    : 'Start recording to capture the conversation'}
                            </p>
                        ) : (
                            segments.map(seg => (
                                <div key={seg.id} className="transcript-segment">
                                    <span className="seg-time">[{seg.timestamp}]</span>
                                    {seg.text}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Visual Context */}
                <VisualContext onContextExtracted={handleVisualContext} />

                {/* Error display */}
                {error && (
                    <div className="model-banner">
                        <span className="error-text">⚠️ {error}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
