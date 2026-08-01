import fs from "fs";
import path from "path";
import crypto from "crypto";

const getGeminiApiKey = () => process.env.GEMINI_API_KEY || "";
const getGeminiEndpoint = () => `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${getGeminiApiKey()}`;

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
  return crypto.createHash("md5").update(base64Data).digest("hex");
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
    const res = await fetch(imageInput);
    const contentType = res.headers.get("content-type");
    if (contentType) mimeType = contentType.split(";")[0];
    const arrayBuf = await res.arrayBuffer();
    base64Data = Buffer.from(arrayBuf).toString("base64");
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
    return JSON.parse(clean) as T;
  } catch (err) {
    console.error("[AI Vision] JSON Parse Error:", err, "Raw:", rawText);
    return null;
  }
}

/**
 * Analyzes selfie photo for live human face verification (rejects photo of screen or printout).
 * Timed out at 3500ms for speed. Caches identical images to eliminate zero-value API hits.
 */
export async function analyzeFacePhoto(imageInput: string): Promise<FaceAiResult> {
  const fallbackResult: FaceAiResult = {
    isHumanFace: true,
    isScreenOrPrintout: false,
    confidence: 0.5,
    warningMessage: "Low network/offline fallback (logged for audit)",
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
      console.log(`[AI Vision] Returned CACHED face verification result for hash ${hash.slice(0, 8)} (Saved API hit)`);
      return { ...cached.result, cached: true };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const prompt = `Analyze this selfie photo for attendance check-in. Determine:
1. Is this a real living human face present in front of the camera?
2. Is this a photo taken off another phone screen, computer monitor, or printout?
Return ONLY valid JSON:
{
  "isHumanFace": boolean,
  "isScreenOrPrintout": boolean,
  "confidence": number,
  "warningMessage": string | null
}`;

    const response = await fetch(getGeminiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal as any,
      body: JSON.stringify({
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
          maxOutputTokens: 100
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[AI Vision] Gemini Face API status ${response.status}`);
      return fallbackResult;
    }

    const data = await response.json() as any;
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return fallbackResult;

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

    return finalResult;
  } catch (error: any) {
    console.warn("[AI Vision] analyzeFacePhoto timeout or error:", error?.message || error);
    return fallbackResult;
  }
}

/**
 * Analyzes vehicle dashboard / odometer photo:
 * 1. Checks if it is a real odometer (not a photo of a phone screen or non-vehicle object).
 * 2. Checks if it is blurry / unreadable.
 * 3. Extracts numerical odometer digits in KM (OCR).
 * Timed out at 3500ms for speed. Caches identical images to eliminate zero-value API hits.
 */
export async function analyzeOdometerPhoto(imageInput: string): Promise<OdometerAiResult> {
  const fallbackResult: OdometerAiResult = {
    isOdometer: true,
    isBlurry: false,
    isScreenOrPrintout: false,
    detectedReading: null,
    confidence: 0.5,
    warningMessage: "Low network/offline fallback (logged for audit)",
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
      console.log(`[AI Vision] Returned CACHED odometer result for hash ${hash.slice(0, 8)} (Saved API hit)`);
      return { ...cached.result, cached: true };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const prompt = `Analyze this vehicle odometer photo. Determine:
1. Is this a real vehicle odometer display?
2. Is the photo blurry/unreadable?
3. Is it a photo of another screen?
4. Extract numerical reading in KM (numbers only, e.g. 12540).
Return ONLY valid JSON:
{
  "isOdometer": boolean,
  "isBlurry": boolean,
  "isScreenOrPrintout": boolean,
  "detectedReading": number | null,
  "confidence": number,
  "warningMessage": string | null
}`;

    const response = await fetch(getGeminiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal as any,
      body: JSON.stringify({
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
          maxOutputTokens: 100
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[AI Vision] Gemini Odometer API status ${response.status}`);
      return fallbackResult;
    }

    const data = await response.json() as any;
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return fallbackResult;

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

    return finalResult;
  } catch (error: any) {
    console.warn("[AI Vision] analyzeOdometerPhoto timeout or error:", error?.message || error);
    return fallbackResult;
  }
}
