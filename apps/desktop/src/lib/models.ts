export interface ModelOption {
  id: string;
  label: string;
  shortLabel: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", shortLabel: "Sonnet" },
  { id: "claude-opus-4-6", label: "Opus 4.6", shortLabel: "Opus" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", shortLabel: "Haiku" },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0]; // Sonnet

export function getModelDisplay(modelId: string): string {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  return model ? model.label : modelId;
}
