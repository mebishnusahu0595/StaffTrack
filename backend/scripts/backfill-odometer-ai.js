require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { analyzeOdometerPhoto } = require('./dist/services/aiVision.service');

async function main() {
  console.log('Finding attendance records needing odometer AI backfill...');
  const records = await prisma.attendance.findMany({
    where: {
      startOdometerPhotoUrl: { not: null }
    },
    orderBy: { date: 'desc' },
    take: 20
  });

  console.log(`Found ${records.length} records with start odometer photos.`);

  for (const record of records) {
    const aiAnalysis = record.checkInAiAnalysis || {};
    if (!aiAnalysis.odometerAi || aiAnalysis.odometerAi.detectedReading == null) {
      console.log(`Analyzing record ${record.id} for date ${record.date.toISOString().slice(0, 10)} (${record.startOdometerPhotoUrl})...`);
      try {
        const odoResult = await analyzeOdometerPhoto(record.startOdometerPhotoUrl);
        console.log(` -> Detected: ${odoResult.detectedReading} KM (isOdometer: ${odoResult.isOdometer})`);
        
        await prisma.attendance.update({
          where: { id: record.id },
          data: {
            checkInAiAnalysis: {
              ...aiAnalysis,
              odometerAi: odoResult,
              enteredOdometer: record.startOdometer ?? null
            }
          }
        });
      } catch (err) {
        console.warn(`Failed for record ${record.id}:`, err.message);
      }
    } else {
      console.log(`Record ${record.id} already has odometer reading: ${aiAnalysis.odometerAi.detectedReading} KM`);
    }
  }

  console.log('Odometer AI backfill complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
