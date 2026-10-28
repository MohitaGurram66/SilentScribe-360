/** Structured executive briefing output from LLM */
export interface Briefing {
    executiveSummary: string;
    keyPoints: string[];
    decisions: string[];
    actionItems: ActionItem[];
    openQuestions: string[];
    metadata: BriefingMetadata;
}

export interface ActionItem {
    task: string;
    owner: string;
    deadline: string;
}

export interface BriefingMetadata {
    generatedAt: string;
    durationSeconds: number;
    wordCount: number;
    hasVisualContext: boolean;
    modelUsed: string;
    tokensUsed: number;
    processingTimeMs: number;
}

/** Transcript segment from VAD + STT */
export interface TranscriptSegment {
    id: number;
    text: string;
    startTime: number;
    timestamp: string;
}
