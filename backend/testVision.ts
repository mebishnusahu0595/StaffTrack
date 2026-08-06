import { analyzeFacePhoto } from "./src/services/aiVision.service";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
  console.log("Testing analyzeFacePhoto...");
  // Sample 1x1 black pixel gif base64
  const dummyBase64 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const result = await analyzeFacePhoto(dummyBase64);
  console.log("Result:", JSON.stringify(result, null, 2));
}

run();
