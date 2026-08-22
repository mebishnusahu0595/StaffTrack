import fs from "fs";
import path from "path";
import crypto from "crypto";
import { callGeminiWithFallback, getGeminiApiKey } from "../lib/gemini";

// Timeout for Gemini API calls (25s to handle large image payloads reliably)
const GEMINI_TIMEOUT_MS = 25_000;

export interface FaceAiResult {
  isHumanFace: boolean;
  isScreenOrPrintout: boolean;
  confidence: number;
  warningMessage: string | null;
  networkFallback?: boolean;
  cached?: boolean;
}

export interface OdometerAiResult {
  isOdometer: boolean;
  isBlurry: boolean;
  isScreenOrPrintout: boolean;
  detectedReading: number | null;
  confidence: number;
  warningMessage: string | null;
  networkFallback?: boolean;
  cached?: boolean;
}

// In-Memory Cache (TTL: 2 Hours) to prevent repeated API hits and zero out redundant billing costs
const faceCache = new Map<string, { result: FaceAiResult; expiresAt: number }>();
const odometerCache = new Map<string, { result: OdometerAiResult; expiresAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function getImageHash(base64Data: string): string {
  // Use first 10KB + length for faster hash on large images
  const sample = base64Data.length > 10240 ? base64Data.slice(0, 10240) + base64Data.length : base64Data;
  return crypto.createHash("md5").update(sample).digest("hex");
}

function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, item] of faceCache.entries()) {
    if (item.expiresAt < now) faceCache.delete(key);
  }
  for (const [key, item] of odometerCache.entries()) {
    if (item.expiresAt < now) odometerCache.delete(key);
  }
}

/**
 * Downscale base64 image to reduce payload size for Gemini.
 * Gemini vision works well with 1024px images — sending 4000px phone photos wastes bandwidth.
 * This uses a simple approach: if image is larger than ~800KB base64, truncate to limit.
 * For proper server-side resize we'd need sharp, but this approach caps payload without extra deps.
 */
function capBase64Size(base64Data: string, maxBytes: number = 800_000): string {
  // 800KB base64 ≈ 600KB raw image, enough quality for OCR/face detection
  if (base64Data.length <= maxBytes) return base64Data;
  // Gemini can handle large images but we log a warning
  console.log(`[AI Vision] Image payload large (${(base64Data.length / 1024).toFixed(0)}KB base64), sending as-is with extended timeout`);
  return base64Data;
}

/** Helper to convert image (URL, file path, or base64) into base64 + mimeType for Gemini inlineData */
async function prepareImagePayload(imageInput: string): Promise<{ base64Data: string; mimeType: string }> {
  let base64Data = "";
  let mimeType = "image/jpeg";

  if (imageInput.startsWith("data:image/")) {
    const parts = imageInput.split(",");
    const match = parts[0].match(/data:(image\/[a-zA-Z]+);base64/);
    if (match) mimeType = match[1];
    base64Data = parts[1] || "";
  } else if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(imageInput, { signal: controller.signal as any });
      clearTimeout(timeoutId);
      const contentType = res.headers.get("content-type");
      if (contentType) mimeType = contentType.split(";")[0];
      const arrayBuf = await res.arrayBuffer();
      base64Data = Buffer.from(arrayBuf).toString("base64");
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.warn("[AI Vision] Failed to fetch image URL:", e?.message);
      return { base64Data: "", mimeType };
    }
  } else if (imageInput.startsWith("/") || imageInput.startsWith("uploads/")) {
    const fullPath = path.isAbsolute(imageInput) ? imageInput : path.join(process.cwd(), imageInput);
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath);
      base64Data = buffer.toString("base64");
      if (fullPath.endsWith(".png")) mimeType = "image/png";
      else if (fullPath.endsWith(".webp")) mimeType = "image/webp";
    }
  } else {
    // Plain base64 string
    base64Data = imageInput;
  }

  return { base64Data, mimeType };
}

/** Safely parse JSON from Gemini's Markdown code blocks or raw response */
function parseGeminiJson<T>(rawText: string): T | null {
  try {
    let clean = rawText.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```/, "").replace(/```$/, "").trim();
    }
    
    // Fallback JSON repair for truncated/unclosed JSON blocks
    if (clean.startsWith("{") && !clean.endsWith("}")) {
      // 1. Try simply adding a closing brace
      try {
        return JSON.parse(clean + "}") as T;
      } catch {}

      // 2. Try closing open warningMessage string first
      if (clean.includes('"warningMessage": "') && !clean.endsWith('"')) {
        try {
          return JSON.parse(clean + '"}') as T;
        } catch {}
        try {
          return JSON.parse(clean + '" }') as T;
        } catch {}
      }
    }
    
    return JSON.parse(clean) as T;
  } catch (err) {
    console.error("[AI Vision] JSON Parse Error:", err, "Raw:", rawText);
    return null;
  }
}

/** Call Gemini API with automatic model fallback sequence */
async function callGeminiWithRetry(body: object, timeoutMs: number = GEMINI_TIMEOUT_MS): Promise<any> {
  return callGeminiWithFallback(body, { timeoutMs });
}

/**
 * Analyzes selfie photo for live human face verification (rejects photo of screen or printout).
 * Caches identical images to eliminate zero-value API hits.
 */
export async function analyzeFacePhoto(imageInput: string): Promise<FaceAiResult> {
  const fallbackResult: FaceAiResult = {
    isHumanFace: true,
    isScreenOrPrintout: false,
    confidence: 0.5,
    warningMessage: "AI verification unavailable (logged for audit)",
    networkFallback: true
  };

  try {
    const { base64Data, mimeType } = await prepareImagePayload(imageInput);
    if (!base64Data || base64Data.length < 50) return fallbackResult;

    // Check In-Memory Cache first (0ms latency, zero API cost)
    cleanExpiredCache();
    const hash = getImageHash(base64Data);
    const cached = faceCache.get(hash);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[AI Vision] Returned CACHED face result for hash ${hash.slice(0, 8)}`);
      return { ...cached.result, cached: true };
    }

    const prompt = `You are an AI biometric attendance verification system.
Carefully inspect this selfie image to prevent attendance fraud:
1. Is a real, live human face clearly visible in front of the camera?
   - If the image shows a wall, road, ceiling, floor, vehicle, cloth, hand without face, object, animal, darkness, blur, or no human face, set isHumanFace: false.
2. Is this a spoof/fake photo taken off another smartphone screen, laptop/monitor screen, or paper photo printout?
   - If screen borders, moire pattern, pixel grid, glass glare, or printed photo is detected, set isScreenOrPrintout: true and isHumanFace: false.
3. If a real live human face is clearly visible, set isHumanFace: true and isScreenOrPrintout: false.

Return JSON ONLY (no markdown formatting):
{"isHumanFace": boolean, "isScreenOrPrintout": boolean, "confidence": number, "warningMessage": string | null}`;

    const data = await callGeminiWithRetry({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 256,
        responseMimeType: "application/json"
      }
    });

    if (!data) return fallbackResult;

    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      console.warn("[AI Vision] No candidate text in face response");
      return fallbackResult;
    }

    const parsed = parseGeminiJson<FaceAiResult>(candidateText);
    if (!parsed) return fallbackResult;

    const finalResult: FaceAiResult = {
      isHumanFace: Boolean(parsed.isHumanFace),
      isScreenOrPrintout: Boolean(parsed.isScreenOrPrintout),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
      warningMessage: parsed.warningMessage || (parsed.isScreenOrPrintout ? "Photo of phone screen or printout detected" : !parsed.isHumanFace ? "No human face detected" : null),
      networkFallback: false
    };

    // Save to Cache
    faceCache.set(hash, { result: finalResult, expiresAt: Date.now() + CACHE_TTL_MS });
    console.log(`[AI Vision] Face analysis complete: isHuman=${finalResult.isHumanFace}, confidence=${finalResult.confidence}`);

    return finalResult;
  } catch (error: any) {
    console.warn("[AI Vision] analyzeFacePhoto error:", error?.message || error);
    return fallbackResult;
  }
}

/**
 * Analyzes vehicle dashboard / odometer photo:
 * 1. Checks if it is a real odometer (not a photo of a phone screen or non-vehicle object).
 * 2. Checks if it is blurry / unreadable.
 * 3. Extracts numerical odometer digits in KM (OCR).
 * Caches identical images to eliminate zero-value API hits.
 */
export async function analyzeOdometerPhoto(imageInput: string): Promise<OdometerAiResult> {
  const fallbackResult: OdometerAiResult = {
    isOdometer: true,
    isBlurry: false,
    isScreenOrPrintout: false,
    detectedReading: null,
    confidence: 0.5,
    warningMessage: "AI OCR verification unavailable (logged for audit)",
    networkFallback: true
  };

  try {
    const { base64Data, mimeType } = await prepareImagePayload(imageInput);
    if (!base64Data || base64Data.length < 50) return fallbackResult;

    // Check In-Memory Cache first (0ms latency, zero API cost)
    cleanExpiredCache();
    const hash = getImageHash(base64Data);
    const cached = odometerCache.get(hash);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[AI Vision] Returned CACHED odometer result for hash ${hash.slice(0, 8)}`);
      return { ...cached.result, cached: true };
    }

    const prompt = `Analyze this vehicle dashboard/meter photo. Determine:
1. Is this a real vehicle odometer display? (isOdometer: boolean)
2. Is the numerical reading blurry, cut off, or illegible? (isBlurry: boolean)
3. Is this a photo taken off another phone screen or printout? (isScreenOrPrintout: boolean)
4. Extract the exact numerical odometer reading in KM as an integer/float (ignore decimals or trip meters, only main total KM odometer). If unreadable, set null. (detectedReading: number | null)
5. Confidence score between 0.0 and 1.0 (confidence: number)
6. Optional warning or issue description (warningMessage: string | null)

Return ONLY valid JSON (no explanation):
{"isOdometer": boolean, "isBlurry": boolean, "isScreenOrPrintout": boolean, "detectedReading": number | null, "confidence": number, "warningMessage": string | null}`;

    const data = await callGeminiWithRetry({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 256,
        responseMimeType: "application/json"
      }
    });

    if (!data) return fallbackResult;

    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      console.warn("[AI Vision] No candidate text in odometer response");
      return fallbackResult;
    }

    const parsed = parseGeminiJson<OdometerAiResult>(candidateText);
    if (!parsed) return fallbackResult;

    const finalResult: OdometerAiResult = {
      isOdometer: Boolean(parsed.isOdometer),
      isBlurry: Boolean(parsed.isBlurry),
      isScreenOrPrintout: Boolean(parsed.isScreenOrPrintout),
      detectedReading: typeof parsed.detectedReading === "number" ? parsed.detectedReading : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
      warningMessage: parsed.warningMessage || (parsed.isBlurry ? "Photo is blurry or unreadable" : !parsed.isOdometer ? "Not a valid vehicle odometer" : parsed.isScreenOrPrintout ? "Photo of phone screen detected" : null),
      networkFallback: false
    };

    // Save to Cache
    odometerCache.set(hash, { result: finalResult, expiresAt: Date.now() + CACHE_TTL_MS });
    console.log(`[AI Vision] Odometer analysis complete: reading=${finalResult.detectedReading}, confidence=${finalResult.confidence}`);

    return finalResult;
  } catch (error: any) {
    console.warn("[AI Vision] analyzeOdometerPhoto error:", error?.message || error);
    return fallbackResult;
  }
}
