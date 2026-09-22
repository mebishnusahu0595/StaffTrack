require('dotenv').config();
const fs = require('fs');
const { getGeminiEndpoint } = require('./dist/lib/gemini');

async function testOdometerPrompt(filename) {
  const filePath = '/var/www/stafftrack/backend/uploads/' + filename;
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const base64Data = buffer.toString('base64');
  
  const prompt = `You are an expert AI vehicle odometer OCR system.
Analyze this vehicle dashboard/meter photo:
1. Is this a real vehicle odometer display? (isOdometer: boolean)
2. Is the numerical reading blurry, cut off, or illegible? (isBlurry: boolean)
3. Is this a photo taken off another phone screen or printout? (isScreenOrPrintout: boolean)
4. Extract the exact numerical odometer reading in KM as a number.
   - For analog/mechanical roll drums: usually 5 or 6 digits. In standard 2-wheelers and vehicles, the rightmost drum is tenths of a kilometer (0.1 KM, often rotating/sub-km or different color). Extract the main total whole kilometers integer reading (e.g. if the meter shows 3 7 2 8 9 and rolling tenth digit, the total KM is 37289).
   - For digital displays: extract the main total ODO reading in KM (ignore TRIP meters).
   - If unreadable, set null. (detectedReading: number | null)
5. Confidence score between 0.0 and 1.0 (confidence: number)
6. Optional warning or issue description (warningMessage: string | null)

Return JSON ONLY:
{"isOdometer": boolean, "isBlurry": boolean, "isScreenOrPrintout": boolean, "detectedReading": number | null, "confidence": number, "warningMessage": string | null}`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  };

  const url = getGeminiEndpoint('gemini-3.5-flash');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log(filename, '-> parsed:\n', text ? JSON.parse(text) : data);
}

async function main() {
  await testOdometerPrompt('1789105552997-146877346.jpeg');
}
main();
