/**
 * Centralized Gemini AI Client with Model Fallback
 * Primary: gemini-3.7-flash
 * Fallbacks: gemini-3.6-flash -> gemini-3.5-flash -> gemini-2.5-flash -> gemini-1.5-flash
 */

export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];

export const getGeminiApiKey = (): string => process.env.GEMINI_API_KEY || "";

export const getGeminiEndpoint = (model: string = GEMINI_FALLBACK_MODELS[0]): string =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getGeminiApiKey()}`;

export const getGeminiStreamEndpoint = (model: string = GEMINI_FALLBACK_MODELS[0]): string =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${getGeminiApiKey()}`;

export interface GeminiCallOption {
  timeoutMs?: number;
  models?: string[];
}

/**
 * Call Gemini API with automatic model fallback sequence.
 * Starts with gemini-3.7-flash; if rate-limited (429), not found (404), or 5xx server error,
 * automatically falls back to gemini-3.6-flash, gemini-3.5-flash, etc.
 */
export async function callGeminiWithFallback(
  body: object,
  options: GeminiCallOption = {}
): Promise<any | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.warn("[Gemini API] GEMINI_API_KEY is not set.");
    return null;
  }

  const models = options.models && options.models.length > 0 ? options.models : GEMINI_FALLBACK_MODELS;
  const timeoutMs = options.timeoutMs || 25_000;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = getGeminiEndpoint(model);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal as any,
        body: JSON.stringify(body)
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      const errText = await response.text();
      console.warn(
        `[Gemini API] Model ${model} returned status ${response.status}: ${errText.slice(0, 160)}. Attempting fallback...`
      );
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`[Gemini API] Model ${model} call failed: ${err?.message || err}. Attempting fallback...`);
    }
  }

  console.error("[Gemini API] All fallback models exhausted. Request failed.");
  return null;
}

/**
 * Open a streaming connection with automatic model fallback sequence.
 */
export async function streamGeminiWithFallback(
  body: object,
  options: GeminiCallOption = {}
): Promise<{ response: Response; model: string } | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.warn("[Gemini API] GEMINI_API_KEY is not set.");
    return null;
  }

  const models = options.models && options.models.length > 0 ? options.models : GEMINI_FALLBACK_MODELS;
  const timeoutMs = options.timeoutMs || 15_000;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = getGeminiStreamEndpoint(model);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal as any,
        body: JSON.stringify(body)
      });
      clearTimeout(timeoutId);

      if (response.ok && response.body) {
        return { response, model };
      }

      const errText = await response.text();
      console.warn(
        `[Gemini Stream] Model ${model} returned status ${response.status}: ${errText.slice(0, 160)}. Trying next model...`
      );
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`[Gemini Stream] Model ${model} failed: ${err?.message || err}. Trying next model...`);
    }
  }

  console.error("[Gemini Stream] All fallback models exhausted.");
  return null;
}
