export interface ChatWithSourcesCopy {
  title: string;
  scopeLabel?: string;
  educationAriaLabel: string;
  educationCopy: string;
  emptyState: string;
  inputLabel: string;
  inputPlaceholder: string;
  sendLabel: string;
  retryLabel: string;
  sourceViewerTitle: string;
  sourceViewerEducationAriaLabel: string;
  sourceViewerEducationCopy: string;
  citationEducationAriaLabel: string;
  citationEducationCopy: string;
  refineLabel: string;
  closeSourceLabel: string;
  loadingLabel: string;
  errorLabel: string;
}

export interface ChatWithSourcesLimits {
  maxMessageLength: number;
  maxStarterPrompts: number;
}

export interface ChatWithSourcesFeatures {
  citationRefinement: boolean;
  sourcePreview: boolean;
}

export interface ChatWithSourcesConfig {
  copy: ChatWithSourcesCopy;
  limits: ChatWithSourcesLimits;
  features: ChatWithSourcesFeatures;
  starterPrompts: string[];
}

export type ChatWithSourcesConfigInput = Partial<{
  copy: Partial<ChatWithSourcesCopy>;
  limits: Partial<ChatWithSourcesLimits>;
  features: Partial<ChatWithSourcesFeatures>;
  starterPrompts: string[];
}>;

export const defaultChatWithSourcesConfig: ChatWithSourcesConfig = {
  copy: {
    title: "CHAT WITH SOURCES",
    scopeLabel: undefined,
    educationAriaLabel: "About chat with sources",
    educationCopy:
      "GroundX retrieves relevant source passages first, then the middleware asks the configured LLM to answer from that context. Source chips open the supporting document details.",
    emptyState: "Ask a question about the selected GroundX content.",
    inputLabel: "Message",
    inputPlaceholder: "Ask about the documents in this scope.",
    sendLabel: "Send",
    retryLabel: "Retry",
    sourceViewerTitle: "SOURCE DETAILS",
    sourceViewerEducationAriaLabel: "About source details",
    sourceViewerEducationCopy:
      "Source details come from GroundX search results. Coordinates and page data are preserved when GroundX returns them.",
    citationEducationAriaLabel: "About source citations",
    citationEducationCopy:
      "Citations point to the GroundX result used to support the answer. Open them to review the source document, page data, and quoted chunk.",
    refineLabel: "Refine citation",
    closeSourceLabel: "Close source details",
    loadingLabel: "Grounding answer",
    errorLabel: "The answer could not be generated.",
  },
  limits: {
    maxMessageLength: 1200,
    maxStarterPrompts: 4,
  },
  features: {
    citationRefinement: true,
    sourcePreview: true,
  },
  starterPrompts: [
    "Summarize the most important findings.",
    "What documents support this answer?",
  ],
};

export function createChatWithSourcesConfig(
  overrides: ChatWithSourcesConfigInput = {}
): ChatWithSourcesConfig {
  const config: ChatWithSourcesConfig = {
    copy: { ...defaultChatWithSourcesConfig.copy, ...(overrides.copy ?? {}) },
    limits: { ...defaultChatWithSourcesConfig.limits, ...(overrides.limits ?? {}) },
    features: { ...defaultChatWithSourcesConfig.features, ...(overrides.features ?? {}) },
    starterPrompts: overrides.starterPrompts ?? defaultChatWithSourcesConfig.starterPrompts,
  };

  if (!config.copy.title.trim()) throw new Error("Chat with sources title is required");
  if (!config.copy.inputLabel.trim()) throw new Error("Chat with sources inputLabel is required");
  if (!Number.isInteger(config.limits.maxMessageLength) || config.limits.maxMessageLength < 1) {
    throw new Error("maxMessageLength must be a positive integer");
  }
  if (!Number.isInteger(config.limits.maxStarterPrompts) || config.limits.maxStarterPrompts < 0) {
    throw new Error("maxStarterPrompts must be zero or a positive integer");
  }
  if (config.starterPrompts.length > config.limits.maxStarterPrompts) {
    throw new Error("starterPrompts cannot exceed maxStarterPrompts");
  }
  if (config.starterPrompts.some((prompt) => !prompt.trim())) {
    throw new Error("starterPrompts cannot contain empty prompts");
  }

  return config;
}
