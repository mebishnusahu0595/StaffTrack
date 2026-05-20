const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://192.168.1.34:8081",
  "http://192.168.1.34:3000"
];

export const allowedOrigins = (process.env.CORS_ORIGINS ?? defaultAllowedOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function isAllowedOrigin(origin?: string) {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

export function corsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: any) => void) {
  if (isAllowedOrigin(origin)) {
    // Reflect the specific origin if it's allowed, or true if undefined (for non-browser clients)
    callback(null, origin || true);
    return;
  }

  callback(new Error(`CORS origin not allowed: ${origin}`));
}

