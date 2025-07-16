import prisma from '../src/prismaClient';
import { fetchNearbyBusinesses } from '../src/utils/api/google/api';
import { publishEvent } from '../src/events/eventBus';
import { v4 as uuidv4 } from 'uuid';

const fixOneBusiness = async () => {
  // Get one business with empty raw data
  const business = await prisma.sourceBusiness.findFirst({
    where: { source: 'GOOGLE' },
    include: { business: true }
  });

  if (!business) return;

  console.log(`Fixing business: ${business.business.name}`);

  // Fetch fresh data from Google
  const location = {
    lat: business.business.latitude,
    lng: business.business.longitude,
    name: business.business.name
  };

  const googleBusinesses = await fetchNearbyBusinesses(location);
  const freshData = googleBusinesses.find((gb: any) => gb.id === business.sourceId);

  if (freshData) {
    // Update raw data
    await prisma.sourceBusiness.update({
      where: { id: business.id },
      data: { rawData: freshData }
    });

    console.log(`Updated raw data. Has photos: ${!!(freshData.photos && freshData.photos.length > 0)}`);
    console.log(`Photo count: ${freshData.photos ? freshData.photos.length : 0}`);

    // Trigger photo processing
    publishEvent({
      id: uuidv4(),
      timestamp: new Date(),
      source: 'manual-test',
      type: 'business.deduplicated',
      data: {
        businessId: business.business.id,
        action: 'updated',
        confidence: 1.0
      }
    });

    console.log('Triggered photo processing');
  }
};

fixOneBusiness().then(() => process.exit(0));