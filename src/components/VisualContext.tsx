import { useState, useRef, useCallback } from 'react';
import { ModelManager, ModelCategory } from '@runanywhere/web';
import { VLMWorkerBridge, VideoCapture } from '@runanywhere/web-llamacpp';
import { useModelLoader } from '../hooks/useModelLoader';

interface Props {
    onContextExtracted: (text: string) => void;
}

export function VisualContext({ onContextExtracted }: Props) {
    const vlmLoader = useModelLoader(ModelCategory.Multimodal);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [extractedText, setExtractedText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [cameraActive, setCameraActive] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const captureRef = useRef<VideoCapture | null>(null);
    const imageDataRef = useRef<{ rgbPixels: Uint8Array; width: number; height: number } | null>(null);

    // Handle file upload
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setImagePreview(dataUrl);
            setExtractedText('');
            setError(null);

            // Convert to RGB pixels for VLM
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxDim = 256;
                const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Convert RGBA to RGB
                const rgbPixels = new Uint8Array(canvas.width * canvas.height * 3);
                for (let i = 0; i < imageData.data.length / 4; i++) {
                    rgbPixels[i * 3] = imageData.data[i * 4];
                    rgbPixels[i * 3 + 1] = imageData.data[i * 4 + 1];
                    rgbPixels[i * 3 + 2] = imageData.data[i * 4 + 2];
                }

                imageDataRef.current = { rgbPixels, width: canvas.width, height: canvas.height };
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }, []);

    // Capture from camera
    const captureFromCamera = useCallback(async () => {
        try {
            const cam = new VideoCapture({ facingMode: 'environment' });
            await cam.start();
            captureRef.current = cam;
            setCameraActive(true);

            // Capture a frame after a short delay
            setTimeout(() => {
                const frame = cam.captureFrame(256);
                if (frame) {
                    imageDataRef.current = {
                        rgbPixels: frame.rgbPixels,
                        width: frame.width,
                        height: frame.height,
                    };

                    // Create preview from the frame
                    const canvas = document.createElement('canvas');
                    canvas.width = frame.width;
                    canvas.height = frame.height;
                    const ctx = canvas.getContext('2d')!;
                    const imgData = ctx.createImageData(frame.width, frame.height);
                    for (let i = 0; i < frame.rgbPixels.length / 3; i++) {
                        imgData.data[i * 4] = frame.rgbPixels[i * 3];
                        imgData.data[i * 4 + 1] = frame.rgbPixels[i * 3 + 1];
                        imgData.data[i * 4 + 2] = frame.rgbPixels[i * 3 + 2];
                        imgData.data[i * 4 + 3] = 255;
                    }
                    ctx.putImageData(imgData, 0, 0);
                    setImagePreview(canvas.toDataURL());
                }

                cam.stop();
                setCameraActive(false);
            }, 1000);
        } catch (err) {
            setError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
            setCameraActive(false);
        }
    }, []);

    // Extract text from image using VLM
    const extractFromImage = useCallback(async () => {
        if (!imageDataRef.current) {
            setError('No image loaded');
            return;
        }

        setExtracting(true);
        setError(null);
        const startTime = Date.now();

        try {
            // Ensure VLM model is loaded
            if (!ModelManager.getLoadedModel(ModelCategory.Multimodal)) {
                await vlmLoader.ensure();
            }

            const bridge = VLMWorkerBridge.shared;
            if (!bridge.isModelLoaded) {
                setError('Vision model not loaded. Please load it from the Setup tab.');
                setExtracting(false);
                return;
            }

            const { rgbPixels, width, height } = imageDataRef.current;

            const result = await bridge.process(
                rgbPixels,
                width,
                height,
                'Read the text in this image. Write exactly what the text says, word for word.',
                { maxTokens: 80, temperature: 0.1 },
            );

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            setExtractedText(`${result.text.trim()}\n\n⏱️ Processed in ${elapsed}s on-device`);
            onContextExtracted(result.text.trim());
        } catch (err) {
            setError(`Vision extraction failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setExtracting(false);
        }
    }, [vlmLoader, onContextExtracted]);

    const removeImage = useCallback(() => {
        setImagePreview(null);
        setExtractedText('');
        imageDataRef.current = null;
        onContextExtracted('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [onContextExtracted]);

    return (
        <div className="visual-context-section">
            <div className="visual-context-card">
                <h3>📸 Visual Context <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6 }}>(Optional)</span></h3>

                {!imagePreview ? (
                    <>
                        <div
                            className="image-upload-area"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <span className="upload-icon">📷</span>
                            <p>Upload a slide, whiteboard, or meeting notes</p>
                            <span>Click to browse or drag & drop</span>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, gap: 8 }}>
                            <button
                                className="btn btn-sm"
                                onClick={captureFromCamera}
                                disabled={cameraActive}
                            >
                                📷 {cameraActive ? 'Capturing...' : 'Capture from Camera'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="image-preview">
                            <img src={imagePreview} alt="Visual context" />
                            <button className="image-preview-remove" onClick={removeImage}>×</button>
                        </div>

                        {!extractedText && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={extractFromImage}
                                    disabled={extracting}
                                >
                                    {extracting ? '🔄 Extracting...' : '🔍 Extract Text with Vision AI'}
                                </button>
                            </div>
                        )}

                        {extracting && (
                            <div className="vision-extracting">
                                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                Analyzing image with on-device vision model...
                            </div>
                        )}

                        {extractedText && (
                            <div className="vision-result-text">
                                <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#06b6d4' }}>
                                    Extracted Context:
                                </strong>
                                <p style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{extractedText}</p>
                                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => { setExtractedText(''); }}
                                    >
                                        🔄 Re-extract
                                    </button>
                                    <span style={{ fontSize: 10, opacity: 0.5 }}>
                                        💡 Tip: The 450M vision model works best with printed text and slides. Dense handwriting may have limited accuracy.
                                    </span>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {error && (
                    <div style={{ marginTop: 8 }}>
                        <span className="error-text" style={{ fontSize: 12 }}>⚠️ {error}</span>
                    </div>
                )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
}
