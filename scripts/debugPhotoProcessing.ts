// scripts/debugPhotoProcessing.ts
import prisma from '../src/prismaClient';
import { publishEvent } from '../src/events/eventBus';
import { v4 as uuidv4 } from 'uuid';

const debugPhotoProcessing = async () => {
  console.log('🔍 Debugging photo processing...\n');

  // Find Kura business
  const business = await prisma.business.findFirst({
    where: { 
      name: { contains: 'Kura', mode: 'insensitive' }
    },
    include: {
      photos: true,
      sourceBusinesses: true
    }
  });

  if (!business) {
    console.log('❌ Business not found');
    return;
  }

  const googleSource = business.sourceBusinesses.find(s => s.source === 'GOOGLE');
  const rawData = googleSource?.rawData as any;
  const photos = rawData?.photos || [];

  console.log(`📍 Business: ${business.name}`);
  console.log(`📊 Business ID: ${business.id}`);
  console.log(`📱 Photos in raw data: ${photos.length}`);
  console.log(`🗄️  Photos in database: ${business.photos.length}\n`);

  if (photos.length > 0) {
    console.log('✅ Raw data structure looks good');
    console.log(`📷 First photo name: ${photos[0].name}`);
    console.log(`📐 Dimensions: ${photos[0].widthPx}x${photos[0].heightPx}\n`);
  }

  // Check if photo processing service is initialized
  console.log('🔄 Testing photo processing event...');
  
  // Manually trigger photo processing and watch for logs
  const testEvent = {
    id: uuidv4(),
    timestamp: new Date(),
    source: 'debug-test',
    type: 'business.deduplicated' as const,
    data: {
      businessId: business.id,
      action: 'updated' as const,
      confidence: 1.0
    }
  };

  console.log(`📤 Publishing test event: ${testEvent.id}`);
  console.log(`   Event type: ${testEvent.type}`);
  console.log(`   Business ID: ${testEvent.data.businessId}`);
  console.log('\n🔍 Watch your logs for:');
  console.log('   - "Processing photos for deduplicated business"');
  console.log('   - "DEBUG: Google raw data analysis"');
  console.log('   - "Starting photo processing for business"');
  console.log('   - "Successfully downloaded photo" or "Failed to download photo"');
  console.log('   - "Successfully uploaded photo variants" or photo upload errors');
  console.log('\n⏰ Publishing event now...\n');

  publishEvent(testEvent);

  // Wait a moment for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check if anything was processed
  const updatedBusiness = await prisma.business.findUnique({
    where: { id: business.id },
    include: { photos: true }
  });

  console.log(`📊 Photos after test: ${updatedBusiness?.photos.length || 0}`);

  if ((updatedBusiness?.photos.length || 0) > 0) {
    console.log('🎉 SUCCESS! Photo processing worked!');
  } else {
    console.log('\n⚠️  No photos processed. Check for these issues:');
    console.log('1. Photo processing service not initialized');
    console.log('2. Event listeners not registered');
    console.log('3. Errors in photo download/upload');
    console.log('4. Cost controls blocking uploads');
    console.log('5. S3/Cloudflare configuration issues');
    console.log('\nCheck your console logs for error messages.');
  }
};

debugPhotoProcessing()
  .then(() => {
    console.log('\n✨ Debug completed. Check your logs above!');
    // Don't exit immediately so we can see any async log output
    setTimeout(() => process.exit(0), 3000);
  })
  .catch((error) => {
    console.error('\n💥 Debug failed:', error);
    process.exit(1);
  });