# SilentScribe 360

**Zero-Trust Meeting Intelligence** — A state-of-the-art React + TypeScript application demonstrating **on-device AI in the browser** using the [`@runanywhere/web`](https://www.npmjs.com/package/@runanywhere/web) SDK.

## Project Description

SilentScribe 360 is a fully private, offline-capable AI voice assistant that securely captures meetings, transcribes audio in real-time, extracts context from images, and generates personalized daily briefings. Unlike traditional cloud-based AI tools, all inference in SilentScribe 360 runs entirely locally within your browser using WebAssembly and WebGPU. This means there are no remote servers processing your information, no API keys to configure, and you have a 100% guarantee of data privacy.

### The Problem It Solves
In an era of stringent security requirements and widespread concerns about AI data harvesting, professionals often cannot upload confidential meetings, sensitive interviews, or proprietary internal documents to cloud-based LLM providers. SilentScribe 360 solves this by bringing the AI directly to the data instead of sending the data to the AI.

### Target Users
- **Journalists and Researchers:** Handling sensitive interviews who need transcription without risking source anonymity.
- **Corporate Executives & HR Professionals:** Discussing confidential business strategies or employee performance.
- **Healthcare & Legal Professionals:** Requiring strict compliance (e.g., HIPAA) regarding patient or client data.
- **Privacy Enthusiasts:** Users who simply prefer keeping their personal data on their own devices.

---

## Features

- **🎙️ Capture (Real-Time STT + VAD):** Capture voice memos and meetings seamlessly. Utilizes an on-device VAD (Voice Activity Detection) model to know when you speak and an STT (Speech-to-Text) model to transcribe the audio live. Features a **Visual Context** component to extract embedded text from uploaded images using an on-device Vision Language Model (VLM).
- **📋 Briefing (Automated Insights):** Generate intelligent, highly concise daily briefings from your captured transcripts using a lightweight local LLM (LFM2 350M). Supported by a local TTS (Text-to-Speech) engine for audio playback.
- **⚙️ Setup (Multi-Model Diagnostics):** A comprehensive model management tab to monitor download progress, view cache status via the Origin Private File System (OPFS), and confirm readiness among all required AI engines.

*(Note: The repository also includes components for isolated Chat, Voice, and Vision interactions, serving as modular building blocks for the main application).*

## Technologies & Models Used

Under the hood, SilentScribe 360 relies on `@runanywhere/web` to orchestrate multiple powerful open-source models natively in the browser:

- **LLM:** Liquid AI LFM2 350M (Q4_K_M) via `llama.cpp` for text generation and briefing summaries.
- **VLM:** LFM2-VL 450M via a dedicated Web Worker bridge for extracting context from images.
- **STT:** Whisper Tiny English via `sherpa-onnx` for real-time offline transcription.
- **TTS:** Piper TTS (US English) for reading out generated briefings.
- **VAD:** Silero VAD v5 to intelligently detect start and stop speaking events.

---

## Setup Instructions & How to Run the App

### Prerequisites
- Node.js installed on your machine.
- A modern desktop web browser: **Chrome 120+ or Edge 120+** is highly recommended to support shared array buffers, OPFS, and extensive WebAssembly usage.

### Installation
Clone the repository, navigate into the directory, and install the dependencies:
```bash
git clone https://github.com/prakyath006/SilentScribe-360.git
cd SilentScribe-360
npm install
```

### Running Locally
Start the Vite development server:
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. 

> **Important**: Upon first load, the application will transparently download and cache the necessary AI models (~1GB total) directly into your browser's Origin Private File System (OPFS). Subsequent loads will instantly utilize the cached models, enabling complete offline-first functionality without re-downloading.

---

## Project Structure

```
src/
├── main.tsx              # React root entry point
├── App.tsx               # Main application layout & Tab Navigation (Capture | Briefing | Setup)
├── runanywhere.ts        # SDK initialization & Model Catalog orchestration
├── hooks/
│   └── useModelLoader.ts # Shared hooks for intelligent model download/load tracking
├── workers/
│   └── vlm-worker.ts     # Dedicated Web Worker for off-thread Vision model execution
├── components/
│   ├── CaptureTab.tsx    # VAD + STT meeting capture interface
│   ├── BriefingTab.tsx   # LLM briefing generation interface
│   ├── SetupTab.tsx      # Multi-model health & loading diagnostics
│   ├── VisualContext.tsx # Modular component for image uploads -> VLM text extraction
│   └── ...               # Additional modular components (Chat, Voice, Vision)
└── styles/
    └── index.css         # Dark-themed, premium CSS system
```

## Deployment Support

SilentScribe 360 heavily utilizes `SharedArrayBuffer` for optimal WebAssembly performance across heavy AI models. Therefore, your deployment strategy **must** include cross-origin isolation headers.

### Vercel (Included)

Deploy directly to Vercel:
```bash
npm run build
npx vercel --prod
```

The included `vercel.json` automatically sets the required headers:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```

### Static Hosts
If deploying to another static host (like Netlify, GitHub Pages, or AWS Cloudfront), ensure your server responds with:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## License

MIT
