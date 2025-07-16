import prisma from '../src/prismaClient';

const checkPhotos = async () => {
  console.log('🔍 Checking photo processing results...\n');

  // Check if Kura Revolving Sushi Bar now has photos in the database
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

  console.log(`📍 Business: ${business.name}`);
  console.log(`📊 Photos in database: ${business.photos.length}`);
  
  // Check raw data
  const googleSource = business.sourceBusinesses.find(s => s.source === 'GOOGLE');
  if (googleSource) {
    const rawData = googleSource.rawData as any;
    const rawPhotos = rawData?.photos || [];
    console.log(`📱 Photos in raw data: ${rawPhotos.length}`);
    
    if (rawPhotos.length > 0) {
      console.log('✅ Raw data has photos');
      console.log('📷 Sample photo structure:');
      console.log(JSON.stringify(rawPhotos[0], null, 2));
    } else {
      console.log('❌ No photos in raw data');
    }
  }

  if (business.photos.length > 0) {
    console.log('\n🎉 SUCCESS! Photos were processed:');
    business.photos.forEach((photo, i) => {
      console.log(`  ${i + 1}. Source: ${photo.source}, Main: ${photo.mainPhoto}`);
      console.log(`     S3 Key: ${photo.s3Key ? '✅ Yes' : '❌ No'}`);
      console.log(`     URL: ${photo.url ? '✅ Yes' : '❌ No'}`);
    });
  } else {
    console.log('\n⚠️  No photos in database yet');
    console.log('This could mean:');
    console.log('1. Photo processing is still running (check logs)');
    console.log('2. Photo processing failed (check error logs)');
    console.log('3. Photo processing service might not be running');
  }

  // Check all businesses for photo coverage
  const totalBusinesses = await prisma.business.count();
  const businessesWithPhotos = await prisma.business.count({
    where: {
      photos: { some: {} }
    }
  });

  console.log(`\n📈 Overall stats:`);
  console.log(`   Total businesses: ${totalBusinesses}`);
  console.log(`   With photos: ${businessesWithPhotos}`);
  console.log(`   Coverage: ${((businessesWithPhotos / totalBusinesses) * 100).toFixed(1)}%`);
};

checkPhotos().then(() => process.exit(0));