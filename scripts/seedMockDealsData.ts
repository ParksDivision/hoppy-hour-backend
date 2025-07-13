// scripts/seedMockDealsData.ts
import { v4 as uuidv4 } from 'uuid';
import { publishEvent } from '../src/events/eventBus';
import { cloudflareS3Service } from '../src/utils/cloudflareS3Service';
import { logger } from '../src/utils/logger/logger';
import prisma from '../src/prismaClient';
import sharp from 'sharp';

// Type definitions
interface MockBusiness {
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  rating: number;
  priceLevel: number;
  dealHours: string[];
}

interface PhotoRecord {
  id: string;
  businessId: string;
  sourceId: string;
  source: string;
  width: number;
  height: number;
  url: string | null;
  s3Key: string | null;
  s3KeyThumbnail: string | null;
  s3KeySmall: string | null;
  s3KeyMedium: string | null;
  s3KeyLarge: string | null;
  mainPhoto: boolean;
  format?: string;
  fileSize?: number;
  lastProcessed?: Date;
  createdOn: Date;
  lastFetched: Date;
}

// Mock business data with realistic Austin locations and deal patterns
const MOCK_BUSINESSES: MockBusiness[] = [
  {
    name: "The Tipsy Armadillo",
    address: "123 E 6th St, Austin, TX 78701",
    lat: 30.2672, lng: -97.7431,
    types: ["bar", "restaurant"],
    rating: 4.2,
    priceLevel: 2,
    dealHours: [
      "Monday: 4:00 PM – 2:00 AM, Happy Hour 4:00 PM – 7:00 PM with $5 cocktails and half-price appetizers",
      "Tuesday: 4:00 PM – 2:00 AM, $3 beer specials 5:00 PM – 8:00 PM",
      "Wednesday: 4:00 PM – 2:00 AM, Wine Wednesday 6:00 PM – 9:00 PM with $6 glasses",
      "Thursday: 4:00 PM – 2:00 AM, $4 margaritas 4:00 PM – 7:00 PM",
      "Friday: 4:00 PM – 2:00 AM, Happy Hour 4:00 PM – 6:00 PM"
    ]
  },
  {
    name: "Sunset Brewing Company",
    address: "456 S Lamar Blvd, Austin, TX 78704",
    lat: 30.2106, lng: -97.7689,
    types: ["bar", "brewery"],
    rating: 4.5,
    priceLevel: 2,
    dealHours: [
      "Monday: 3:00 PM – 12:00 AM, $4 pints 3:00 PM – 6:00 PM",
      "Tuesday: 3:00 PM – 12:00 AM, Half-price growler fills 5:00 PM – 8:00 PM",
      "Wednesday: 3:00 PM – 12:00 AM, $5 craft beer specials 4:00 PM – 7:00 PM",
      "Thursday: 3:00 PM – 12:00 AM, Happy Hour 3:00 PM – 6:00 PM with $3 drafts",
      "Friday: 3:00 PM – 1:00 AM, TGIF special 4:00 PM – 7:00 PM"
    ]
  },
  {
    name: "East Side Social Club",
    address: "789 E Cesar Chavez St, Austin, TX 78702",
    lat: 30.2644, lng: -97.7177,
    types: ["bar", "restaurant"],
    rating: 4.0,
    priceLevel: 3,
    dealHours: [
      "Monday: 5:00 PM – 2:00 AM, Industry Night with 50% off drinks 5:00 PM – 7:00 PM",
      "Tuesday: 5:00 PM – 2:00 AM, Taco Tuesday with $2 tacos 6:00 PM – 9:00 PM",
      "Wednesday: 5:00 PM – 2:00 AM, Wine down Wednesday 7:00 PM – 10:00 PM",
      "Thursday: 5:00 PM – 2:00 AM, $6 cocktail specials 5:00 PM – 8:00 PM",
      "Friday: 5:00 PM – 2:00 AM, Happy Hour 5:00 PM – 7:00 PM"
    ]
  },
  {
    name: "Rainey Street Rooftop",
    address: "321 Rainey St, Austin, TX 78701",
    lat: 30.2597, lng: -97.7394,
    types: ["bar", "restaurant"],
    rating: 4.3,
    priceLevel: 3,
    dealHours: [
      "Monday: 4:00 PM – 2:00 AM, $7 craft cocktails 4:00 PM – 6:00 PM",
      "Tuesday: 4:00 PM – 2:00 AM, $4 local beer 5:00 PM – 7:00 PM",
      "Wednesday: 4:00 PM – 2:00 AM, Half-price wine bottles 6:00 PM – 9:00 PM",
      "Thursday: 4:00 PM – 2:00 AM, $5 whiskey shots 4:00 PM – 7:00 PM",
      "Friday: 4:00 PM – 2:00 AM, Sunset Happy Hour 4:00 PM – 6:30 PM"
    ]
  },
  {
    name: "The Dive Bar",
    address: "567 W 5th St, Austin, TX 78701",
    lat: 30.2691, lng: -97.7498,
    types: ["bar"],
    rating: 3.8,
    priceLevel: 1,
    dealHours: [
      "Monday: 2:00 PM – 2:00 AM, $2 beer cans all day",
      "Tuesday: 2:00 PM – 2:00 AM, $1 shot specials 7:00 PM – 9:00 PM",
      "Wednesday: 2:00 PM – 2:00 AM, $3 well drinks 5:00 PM – 8:00 PM",
      "Thursday: 2:00 PM – 2:00 AM, $4 pitchers 6:00 PM – 9:00 PM",
      "Friday: 2:00 PM – 2:00 AM, Happy Hour 2:00 PM – 5:00 PM"
    ]
  },
  {
    name: "Mueller Market Taphouse",
    address: "890 Mueller Blvd, Austin, TX 78723",
    lat: 30.2854, lng: -97.7074,
    types: ["bar", "restaurant"],
    rating: 4.4,
    priceLevel: 2,
    dealHours: [
      "Monday: 3:00 PM – 11:00 PM, $5 local drafts 3:00 PM – 6:00 PM",
      "Tuesday: 3:00 PM – 11:00 PM, Wing Tuesday with $0.75 wings 5:00 PM – 8:00 PM",
      "Wednesday: 3:00 PM – 11:00 PM, $8 cocktail specials 4:00 PM – 7:00 PM",
      "Thursday: 3:00 PM – 11:00 PM, Half-price appetizers 3:00 PM – 6:00 PM",
      "Friday: 3:00 PM – 12:00 AM, Happy Hour 3:00 PM – 6:00 PM"
    ]
  },
  {
    name: "South Congress Saloon",
    address: "234 S Congress Ave, Austin, TX 78704",
    lat: 30.2270, lng: -97.7432,
    types: ["bar", "restaurant"],
    rating: 4.1,
    priceLevel: 2,
    dealHours: [
      "Monday: 4:00 PM – 1:00 AM, $6 margaritas 4:00 PM – 7:00 PM",
      "Tuesday: 4:00 PM – 1:00 AM, $3 Tecate cans 5:00 PM – 8:00 PM",
      "Wednesday: 4:00 PM – 1:00 AM, $5 whiskey drinks 6:00 PM – 9:00 PM",
      "Thursday: 4:00 PM – 1:00 AM, $4 draft beer 4:00 PM – 7:00 PM",
      "Friday: 4:00 PM – 2:00 AM, Happy Hour 4:00 PM – 6:00 PM"
    ]
  },
  {
    name: "West Campus Watering Hole",
    address: "678 W 24th St, Austin, TX 78705",
    lat: 30.2915, lng: -97.7488,
    types: ["bar"],
    rating: 3.9,
    priceLevel: 1,
    dealHours: [
      "Monday: 5:00 PM – 2:00 AM, $2 beer specials 5:00 PM – 8:00 PM",
      "Tuesday: 5:00 PM – 2:00 AM, $1 shot night 8:00 PM – 10:00 PM",
      "Wednesday: 5:00 PM – 2:00 AM, $3 well cocktails 6:00 PM – 9:00 PM",
      "Thursday: 5:00 PM – 2:00 AM, $5 pitchers 7:00 PM – 10:00 PM",
      "Friday: 5:00 PM – 2:00 AM, Happy Hour 5:00 PM – 7:00 PM"
    ]
  },
  {
    name: "The Chill Spot",
    address: "345 Barton Springs Rd, Austin, TX 78704",
    lat: 30.2556, lng: -97.7726,
    types: ["bar", "restaurant"],
    rating: 4.6,
    priceLevel: 3,
    dealHours: [
      "Monday: 3:00 PM – 12:00 AM, $9 craft cocktails 3:00 PM – 6:00 PM",
      "Tuesday: 3:00 PM – 12:00 AM, $6 wine specials 4:00 PM – 7:00 PM",
      "Wednesday: 3:00 PM – 12:00 AM, $7 premium beer 5:00 PM – 8:00 PM",
      "Thursday: 3:00 PM – 12:00 AM, $8 signature drinks 3:00 PM – 6:00 PM",
      "Friday: 3:00 PM – 1:00 AM, Sunset Happy Hour 3:00 PM – 6:00 PM"
    ]
  },
  {
    name: "North Loop Nook",
    address: "456 N Loop Blvd, Austin, TX 78751",
    lat: 30.3356, lng: -97.7192,
    types: ["bar", "restaurant"],
    rating: 4.2,
    priceLevel: 2,
    dealHours: [
      "Monday: 4:00 PM – 11:00 PM, $4 local beer 4:00 PM – 7:00 PM",
      "Tuesday: 4:00 PM – 11:00 PM, Taco and beer combo $8 5:00 PM – 8:00 PM",
      "Wednesday: 4:00 PM – 11:00 PM, $6 wine glasses 6:00 PM – 9:00 PM",
      "Thursday: 4:00 PM – 11:00 PM, $5 cocktails 4:00 PM – 7:00 PM",
      "Friday: 4:00 PM – 12:00 AM, Happy Hour 4:00 PM – 6:00 PM"
    ]
  }
];

// Configuration
const SEEDING_CONFIG = {
  includePhotos: true,
  photosPerBusiness: 3,
  maxConcurrentUploads: 2,
  delayBetweenBusinesses: 300, // ms
  maxBusinessesToProcess: MOCK_BUSINESSES.length, // Process all by default
  dryRun: false, // Set to true to test without actually creating data
};

// Function to create a simple placeholder image
const createPlaceholderImage = async (
  businessName: string, 
  imageType: 'main' | 'interior' | 'exterior' = 'main',
  width: number = 800, 
  height: number = 600
): Promise<Buffer> => {
  // Create different color schemes based on image type
  const colorSchemes = {
    main: [
      { r: 66, g: 165, b: 245 },  // Blue
      { r: 102, g: 187, b: 106 }, // Green
      { r: 255, g: 167, b: 38 },  // Orange
      { r: 171, g: 71, b: 188 },  // Purple
      { r: 239, g: 83, b: 80 },   // Red
    ],
    interior: [
      { r: 121, g: 85, b: 72 },   // Brown
      { r: 158, g: 158, b: 158 }, // Grey
      { r: 255, g: 193, b: 7 },   // Amber
    ],
    exterior: [
      { r: 76, g: 175, b: 80 },   // Green
      { r: 63, g: 81, b: 181 },   // Indigo
      { r: 233, g: 30, b: 99 },   // Pink
    ]
  };
  
  const colors = colorSchemes[imageType];
  const colorIndex = businessName.length % colors.length;
  const color = colors[colorIndex];
  
  const icons = {
    main: '🍺',
    interior: '🪑',
    exterior: '🏪'
  };
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${color.r},${color.g},${color.b});stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(${Math.max(0, color.r-50)},${Math.max(0, color.g-50)},${Math.max(0, color.b-50)});stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad1)" />
      <circle cx="50%" cy="35%" r="60" fill="rgba(255,255,255,0.2)" filter="url(#shadow)" />
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" fill="white">
        ${icons[imageType]}
      </text>
      <text x="50%" y="65%" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="white" filter="url(#shadow)">
        ${businessName.substring(0, 25)}
      </text>
      <text x="50%" y="75%" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="rgba(255,255,255,0.9)">
        ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} View
      </text>
      <text x="50%" y="85%" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="rgba(255,255,255,0.7)">
        Austin, TX
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
};

// Function to upload mock photos for a business
const uploadMockPhotos = async (businessId: string, businessName: string): Promise<PhotoRecord[]> => {
  if (!SEEDING_CONFIG.includePhotos) {
    return [];
  }

  const photoTypes: Array<'main' | 'interior' | 'exterior'> = ['main', 'interior', 'exterior'];
  const uploadedPhotos: PhotoRecord[] = [];
  
  try {
    for (let i = 0; i < Math.min(SEEDING_CONFIG.photosPerBusiness, photoTypes.length); i++) {
      const photoType = photoTypes[i];
      const photoId = `mock_photo_${businessId}_${photoType}_${Date.now()}_${i}`;
      
      try {
        // Create the placeholder image
        const imageBuffer = await createPlaceholderImage(
          businessName, 
          photoType,
          photoType === 'main' ? 1200 : 800,
          photoType === 'main' ? 800 : 600
        );

        // Upload to S3 with cost control
        logger.debug(`Uploading ${photoType} photo for ${businessName}`);
        
        const uploadedVariants = await cloudflareS3Service.uploadImageWithVariants(
          imageBuffer,
          businessId,
          photoId
        );

        const photoRecord: PhotoRecord = {
          id: uuidv4(),
          businessId,
          sourceId: photoId,
          source: 'MOCK',
          width: photoType === 'main' ? 1200 : 800,
          height: photoType === 'main' ? 800 : 600,
          url: null, // Mock photos don't have external URLs
          s3Key: uploadedVariants.original || null,
          s3KeyThumbnail: uploadedVariants.thumbnail || null,
          s3KeySmall: uploadedVariants.small || null,
          s3KeyMedium: uploadedVariants.medium || null,
          s3KeyLarge: uploadedVariants.large || null,
          mainPhoto: photoType === 'main',
          format: 'jpeg',
          fileSize: imageBuffer.length,
          lastProcessed: new Date(),
          createdOn: new Date(),
          lastFetched: new Date()
        };

        uploadedPhotos.push(photoRecord);
        
        logger.debug(`Successfully uploaded ${photoType} photo for ${businessName}`);
        
        // Small delay between photo uploads
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (photoError) {
        logger.error(`Failed to upload ${photoType} photo for ${businessName}:`, photoError);
        // Continue with other photos
      }
    }
    
    return uploadedPhotos;
    
  } catch (error) {
    logger.error(`Failed to upload photos for ${businessName}:`, error);
    return [];
  }
};

// Function to wait for business to be processed through pipeline
const waitForBusinessProcessing = async (sourceId: string, maxWaitMs: number = 15000): Promise<string | null> => {
  const startTime = Date.now();
  let lastCheck = '';
  
  logger.debug(`🔍 Waiting for business with sourceId: ${sourceId}`);
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Check multiple ways the business might be stored
      
      // Method 1: Check via sourceBusinesses relation
      const businessViaSource = await prisma.business.findFirst({
        where: {
          sourceBusinesses: {
            some: {
              sourceId,
              source: 'GOOGLE'
            }
          }
        },
        include: {
          sourceBusinesses: true,
          deals: true
        }
      });
      
      if (businessViaSource) {
        logger.debug(`✅ Found business via sourceBusinesses: ${businessViaSource.id}`);
        return businessViaSource.id;
      }
      
      // Method 2: Check by placeId (fallback)
      const businessByPlaceId = await prisma.business.findFirst({
        where: {
          placeId: sourceId
        },
        include: {
          deals: true
        }
      });
      
      if (businessByPlaceId) {
        logger.debug(`✅ Found business via placeId: ${businessByPlaceId.id}`);
        return businessByPlaceId.id;
      }
      
      // Method 3: Check recent businesses by name (last resort)
      const recentBusinesses = await prisma.business.findMany({
        where: {
          createdOn: {
            gte: new Date(startTime - 5000) // Created in the last 5 seconds before we started waiting
          }
        },
        include: {
          sourceBusinesses: true,
          deals: true
        },
        orderBy: {
          createdOn: 'desc'
        },
        take: 5
      });
      
      const currentCheck = `Source: ${businessViaSource ? 'found' : 'not found'}, PlaceId: ${businessByPlaceId ? 'found' : 'not found'}, Recent: ${recentBusinesses.length}`;
      if (currentCheck !== lastCheck) {
        logger.debug(`🔍 Search progress: ${currentCheck}`);
        lastCheck = currentCheck;
      }
      
      // Debug: Show what we found
      if (recentBusinesses.length > 0) {
        logger.debug(`📋 Recent businesses found:`, recentBusinesses.map(b => ({
          id: b.id,
          name: b.name,
          sources: b.sourceBusinesses.map(s => ({ source: s.source, sourceId: s.sourceId })),
          deals: b.deals.length
        })));
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 750));
      
    } catch (error) {
      logger.debug(`❌ Error checking for business ${sourceId}:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Final debug: Check what's actually in the database
  try {
    const allRecentBusinesses = await prisma.business.findMany({
      where: {
        createdOn: {
          gte: new Date(startTime - 10000)
        }
      },
      include: {
        sourceBusinesses: true
      },
      orderBy: {
        createdOn: 'desc'
      },
      take: 10
    });
    
    logger.debug(`🔍 Final check - Recent businesses in DB:`, allRecentBusinesses.map(b => ({
      id: b.id,
      name: b.name,
      createdOn: b.createdOn,
      sources: b.sourceBusinesses.map(s => ({ source: s.source, sourceId: s.sourceId }))
    })));
    
    const sourceBusinessCount = await prisma.sourceBusiness.count();
    const businessCount = await prisma.business.count();
    logger.debug(`📊 Database counts: Businesses: ${businessCount}, SourceBusinesses: ${sourceBusinessCount}`);
    
  } catch (error) {
    logger.debug(`❌ Error in final check:`, error);
  }
  
  return null;
};

// Function to test if event system is working
const testEventSystem = async (): Promise<boolean> => {
  try {
    logger.info('🧪 Testing event system...');
    
    // Check if we can publish and process a simple test event
    const testEventId = uuidv4();
    const testEvent = {
      id: testEventId,
      timestamp: new Date(),
      source: 'event-system-test',
      type: 'business.raw.collected' as const,
      data: {
        sourceId: 'test-event-123',
        source: 'GOOGLE' as const,
        rawData: {
          id: 'test-event-123',
          displayName: { text: 'Test Event Business' },
          formattedAddress: 'Test Address',
          location: { latitude: 30.2672, longitude: -97.7431 },
          types: ['test'],
          regularOpeningHours: {
            weekdayDescriptions: ['Monday: Test hours with $5 test deals 4:00 PM – 7:00 PM']
          }
        },
        location: { lat: 30.2672, lng: -97.7431, name: 'Test Location' }
      }
    };
    
    publishEvent(testEvent);
    logger.debug('📤 Test event published, waiting for processing...');
    
    // Wait a bit and check if it was processed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const testBusiness = await waitForBusinessProcessing('test-event-123', 5000);
    
    if (testBusiness) {
      logger.info('✅ Event system is working - test business created');
      // Clean up test business
      try {
        await prisma.business.delete({ where: { id: testBusiness } });
        logger.debug('🧹 Cleaned up test business');
      } catch (error) {
        logger.debug('Failed to clean up test business:', error);
      }
      return true;
    } else {
      logger.warn('⚠️  Event system test failed - business not created');
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Event system test error:', error);
    return false;
  }
};

// Direct database creation function (bypass event system)
const createBusinessDirectly = async (businessData: { name: string; rawData: any }, sourceId: string): Promise<string> => {
  try {
    logger.debug('🏗️  Creating business directly in database...');
    
    // Extract data from the mock business format
    const business = MOCK_BUSINESSES.find((b: MockBusiness) => b.name === businessData.name);
    if (!business) {
      throw new Error(`Business ${businessData.name} not found in mock data`);
    }
    
    // Create business record
    const newBusiness = await prisma.business.create({
      data: {
        name: business.name,
        address: business.address,
        latitude: business.lat,
        longitude: business.lng,
        isBar: business.types.includes('bar'),
        isRestaurant: business.types.includes('restaurant'),
        ratingOverall: business.rating,
        ratingGoogle: business.rating,
        priceLevel: business.priceLevel,
        placeId: sourceId,
        categories: business.types,
        normalizedName: business.name.toLowerCase().trim(),
        normalizedAddress: business.address.toLowerCase().trim(),
        operatingHours: business.dealHours,
        confidence: 1.0
      }
    });
    
    // Create source business record
    await prisma.sourceBusiness.create({
      data: {
        businessId: newBusiness.id,
        source: 'GOOGLE',
        sourceId: sourceId,
        rawData: businessData.rawData,
        lastFetched: new Date()
      }
    });
    
    // Extract and create deals
    const deals = extractDealsFromHours(business.dealHours, newBusiness.id);
    if (deals.length > 0) {
      await prisma.deal.createMany({
        data: deals,
        skipDuplicates: true
      });
    }
    
    logger.debug(`✅ Created business directly: ${newBusiness.id} with ${deals.length} deals`);
    return newBusiness.id;
    
  } catch (error) {
    logger.error('Failed to create business directly:', error);
    throw error;
  }
};


const convertTo24Hour = (time: string): string => {
  try {
    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) {
      logger.debug(`Invalid time format: ${time}`);
      return time;
    }
    
    let hour = parseInt(match[1]);
    const minute = match[2];
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hour !== 12) {
      hour += 12;
    }
    if (period === 'AM' && hour === 12) {
      hour = 0;
    }
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  } catch (error) {
    logger.debug(`Error converting time ${time}: ${error}`);
    return time;
  }
};

// Helper function to extract deals from operating hours
const extractDealsFromHours = (dealHours: string[], businessId: string) => {
  const deals: any[] = [];
  const dayMap: Record<string, number> = {
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0
  };
  
  dealHours.forEach((hourString, index) => {
    // Extract day, times, and deals from strings like:
    // "Monday: 4:00 PM – 2:00 AM, Happy Hour 4:00 PM – 7:00 PM with $5 cocktails"
    const dayMatch = hourString.match(/^(\w+):/);
    const dealMatches = [...hourString.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*–\s*(\d{1,2}:\d{2}\s*(?:AM|PM))[^,]*,?\s*([^,]+)/gi)];
    
    if (dayMatch && dealMatches.length > 0) {
      const dayName = dayMatch[1].toLowerCase();
      const dayOfWeek = dayMap[dayName];

      dealMatches.forEach((match, dealIndex) => {
        const startTime = convertTo24Hour(match[1]);
        const endTime = convertTo24Hour(match[2]);
        const description = match[3] ? match[3].trim() : 'Happy Hour Special';

        if (
          description.length > 10 &&
          (
            description.includes('$') ||
            description.includes('half') ||
            description.includes('off')
          )
        ) {
          deals.push({
            id: uuidv4(),
            businessId,
            dayOfWeek,
            startTime,
            endTime,
            title: description.substring(0, 100),
            description: description,
            extractedBy: 'mock-data-direct',
            confidence: 1.0,
            sourceText: hourString,
            isActive: true,
            isVerified: false
          });
        }
      });
    }
  });

  return deals;
};

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'seed';
  
  // Parse CLI options
  if (args.includes('--dry-run')) {
    SEEDING_CONFIG.dryRun = true;
  }
  if (args.includes('--no-photos')) {
    SEEDING_CONFIG.includePhotos = false;
  }
  if (args.includes('--fast')) {
    SEEDING_CONFIG.delayBetweenBusinesses = 100;
    SEEDING_CONFIG.photosPerBusiness = 1;
    SEEDING_CONFIG.maxBusinessesToProcess = 5; // Only process 5 businesses in fast mode
  }
  if (args.includes('--quick')) {
    SEEDING_CONFIG.maxBusinessesToProcess = 3; // Only process 3 businesses
    SEEDING_CONFIG.delayBetweenBusinesses = 200;
  }
  
  const execute = async () => {
    switch (command) {
      case 'seed':
        await seedMockDealsData();
        break;
      case 'cleanup':
        await cleanupMockData();
        break;
      case 'test-events':
        const working = await testEventSystem();
        console.log(`Event system status: ${working ? '✅ Working' : '❌ Not working'}`);
        break;
      case 'debug':
        // Quick debug info
        const businessCount = await prisma.business.count();
        const dealCount = await prisma.deal.count();
        const photoCount = await prisma.photo.count();
        const sourceCount = await prisma.sourceBusiness.count();
        
        console.log('📊 Current Database Status:');
        console.log(`   Businesses: ${businessCount}`);
        console.log(`   Deals: ${dealCount}`);
        console.log(`   Photos: ${photoCount}`);
        console.log(`   Source Businesses: ${sourceCount}`);
        
        // Check recent activity
        const recent = await prisma.business.findMany({
          where: {
            createdOn: {
              gte: new Date(Date.now() - 60000) // Last minute
            }
          },
          include: {
            sourceBusinesses: true,
            deals: true,
            photos: true
          },
          orderBy: {
            createdOn: 'desc'
          },
          take: 5
        });
        
        console.log(`\n📋 Recent Activity (last minute): ${recent.length} businesses`);
        recent.forEach(b => {
          console.log(`   ${b.name}: ${b.deals.length} deals, ${b.photos.length} photos`);
        });
        break;
      case 'help':
        console.log(`
🍺 Hoppy Hour Mock Data Seeder

Usage:
  npm run seed                    # Seed mock data with photos (all businesses)
  npm run seed -- cleanup        # Clean up mock data
  npm run seed -- test-events    # Test event system only
  npm run seed -- debug          # Show database status
  npm run seed -- --dry-run      # Test without creating data
  npm run seed -- --no-photos    # Seed without photos
  npm run seed -- --quick        # Quick test (3 businesses only)
  npm run seed -- --fast         # Fast mode (5 businesses, minimal photos)

Options:
  --dry-run     Test the seeding process without creating data
  --no-photos   Skip photo upload (faster, lower cost)
  --quick       Process only 3 businesses for quick testing
  --fast        Process 5 businesses with reduced delays and photos
  cleanup       Remove all mock data and photos
  test-events   Test if the event processing system is working
  debug         Show current database status and recent activity
        `);
        return;
      default:
        throw new Error(`Unknown command: ${command}. Use 'seed', 'cleanup', 'test-events', 'debug', or 'help'`);
    }
  };
  
  execute()
    .then(() => {
      if (command === 'seed' && !SEEDING_CONFIG.dryRun) {
        console.log('\n✅ Mock data seeding completed successfully!');
        console.log('\n🔍 Test your API:');
        console.log('curl http://localhost:3001/business/with-deals | jq');
        console.log('curl http://localhost:3001/admin/deal-processing/stats | jq');
        console.log('\n🛠️  Debug commands:');
        console.log('npm run seed -- debug');
        console.log('npm run seed -- test-events');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Operation failed:', error.message);
      if (error.stack) {
        console.error('\nStack trace:', error.stack);
      }
      process.exit(1);
    });
} // <-- Add this closing brace to end the if (require.main === module) block

// Helper to convert time to 24-hour format
const seedMockDealsData = async () => {
  try {
    logger.info('🌱 Starting comprehensive mock deals data seeding...');
    
    if (SEEDING_CONFIG.dryRun) {
      logger.info('🏃 DRY RUN MODE - No data will be created');
    }
    
    // Check cost status before starting
    const costReport = await cloudflareS3Service.getCostReport();
    logger.info('💰 Cost status before seeding:', {
      currentSpent: costReport.currentMonth.total,
      remainingBudget: costReport.remainingBudget,
      emergencyMode: costReport.emergencyMode
    });
    
    if (costReport.emergencyMode) {
      logger.warn('⚠️  Emergency mode is active - photos will be skipped or limited');
      SEEDING_CONFIG.includePhotos = false;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let photosUploaded = 0;

    for (let i = 0; i < MOCK_BUSINESSES.length; i++) {
      const business = MOCK_BUSINESSES[i];
      
      try {
        logger.info(`📍 Processing mock business ${i + 1}/${MOCK_BUSINESSES.length}: ${business.name}`);

        if (SEEDING_CONFIG.dryRun) {
          logger.info(`   Would create: ${business.name} with ${business.dealHours.length} deal hours`);
          successCount++;
          continue;
        }

        const sourceId = `mock_business_${Date.now()}_${i}`;
        
        // Create raw business event that mimics Google Places API response
        const rawEvent = {
          id: uuidv4(),
          timestamp: new Date(),
          source: 'mock-data-script',
          type: 'business.raw.collected' as const,
          data: {
            sourceId,
            source: 'GOOGLE' as const,
            rawData: {
              id: sourceId,
              displayName: { text: business.name },
              formattedAddress: business.address,
              location: { 
                latitude: business.lat, 
                longitude: business.lng 
              },
              types: business.types,
              rating: business.rating,
              priceLevel: `PRICE_LEVEL_${business.priceLevel === 1 ? 'INEXPENSIVE' : business.priceLevel === 2 ? 'MODERATE' : 'EXPENSIVE'}`,
              regularOpeningHours: {
                weekdayDescriptions: business.dealHours
              },
              photos: SEEDING_CONFIG.includePhotos ? [
                {
                  name: `places/${sourceId}/photos/main_photo`,
                  widthPx: 1200,
                  heightPx: 800
                },
                {
                  name: `places/${sourceId}/photos/interior_photo`,
                  widthPx: 800,
                  heightPx: 600
                },
                {
                  name: `places/${sourceId}/photos/exterior_photo`,
                  widthPx: 1000,
                  heightPx: 750
                }
              ] : []
            },
            location: {
              lat: business.lat,
              lng: business.lng,
              name: 'Austin Mock Location'
            }
          }
        };

        // Publish the event to trigger the pipeline
        publishEvent(rawEvent);
        
        // Wait for business to be processed through the pipeline
        logger.debug(`   ⏳ Waiting for business to be processed...`);
        const businessId = await waitForBusinessProcessing(sourceId, 8000);
        
        if (businessId && SEEDING_CONFIG.includePhotos) {
          logger.debug(`   📸 Business processed, uploading photos...`);
          
          // Upload mock photos directly to the database
          const uploadedPhotos = await uploadMockPhotos(businessId, business.name);
          
          if (uploadedPhotos.length > 0) {
            // Save photos to database
            await prisma.photo.createMany({
              data: uploadedPhotos,
              skipDuplicates: true
            });
            
            photosUploaded += uploadedPhotos.length;
            logger.debug(`   ✅ Uploaded ${uploadedPhotos.length} photos`);
          }
        } else if (!businessId) {
          logger.warn(`   ⚠️  Business ${business.name} not found after processing - photos skipped`);
        }
        
        // Delay between businesses to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, SEEDING_CONFIG.delayBetweenBusinesses));
        
        successCount++;
        logger.info(`   ✅ Successfully processed: ${business.name}`);

      } catch (error) {
        errorCount++;
        logger.error(`   ❌ Failed to process mock business ${business.name}:`, error);
      }
    }

    // Final cost report
    const finalCostReport = await cloudflareS3Service.getCostReport();
    
    logger.info('🎉 Mock data seeding completed!', {
      successful: successCount,
      errors: errorCount,
      photosUploaded,
      costInfo: {
        initialCost: costReport.currentMonth.total,
        finalCost: finalCostReport.currentMonth.total,
        photoCost: finalCostReport.currentMonth.total - costReport.currentMonth.total,
        remainingBudget: finalCostReport.remainingBudget
      }
    });

    if (!SEEDING_CONFIG.dryRun) {
      logger.info('📊 Pipeline flow: Raw → Standardize → Dedupe → Deals → Photos (mock uploaded)');
      logger.info('🔍 Check your results with these endpoints:');
      console.log('   curl http://localhost:3001/business/with-deals');
      console.log('   curl http://localhost:3001/admin/deal-processing/stats');
      console.log('   curl http://localhost:3001/admin/photo-processing/stats');
    }

  } catch (error) {
    logger.error('💥 Failed to seed mock deals data:', error);
    throw error;
  }
};

// Cleanup function to remove mock data
const cleanupMockData = async () => {
  try {
    logger.info('🧹 Cleaning up mock data...');
    
    // Find all mock businesses
    const mockBusinesses = await prisma.business.findMany({
      where: {
        sourceBusinesses: {
          some: {
            source: 'GOOGLE',
            sourceId: {
              startsWith: 'mock_business_'
            }
          }
        }
      },
      include: {
        photos: true
      }
    });
    
    logger.info(`Found ${mockBusinesses.length} mock businesses to clean up`);
    
    // Delete S3 photos first
    for (const business of mockBusinesses) {
      for (const photo of business.photos) {
        if (photo.s3Key) {
          try {
            await cloudflareS3Service.deleteImage(photo.s3Key);
            logger.debug(`Deleted S3 photo: ${photo.s3Key}`);
          } catch (error) {
            logger.warn(`Failed to delete S3 photo ${photo.s3Key}:`, error);
          }
        }
      }
    }
    
    // Delete from database (cascade will handle related records)
    const deleted = await prisma.business.deleteMany({
      where: {
        sourceBusinesses: {
          some: {
            source: 'GOOGLE',
            sourceId: {
              startsWith: 'mock_business_'
            }
          }
        }
      }
    });
    
    logger.info(`🗑️  Cleaned up ${deleted.count} mock businesses and their related data`);
    
  } catch (error) {
    logger.error('Failed to cleanup mock data:', error);
    throw error;
  }
};

export { seedMockDealsData, cleanupMockData, SEEDING_CONFIG };
