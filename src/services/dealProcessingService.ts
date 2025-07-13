import { v4 as uuidv4 } from 'uuid';
import prisma from '../prismaClient';
import { logger } from '../utils/logger/logger';
import { subscribeToEvent, publishEvent } from '../events/eventBus';
import type { BusinessDeduplicatedEvent, DealProcessedEvent } from '../events/eventTypes';

// Simple deal extraction patterns
const DEAL_PATTERNS = [
  // Happy hour times
  /happy\s+hour[:\s]*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
  // Specific time ranges with deals
  /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))[:\s]*([^.!]+)/gi,
  // Price deals
  /(\$\d+(?:\.\d{2})?)\s+(beer|drink|cocktail|wine|shot)s?/gi,
  // Percentage deals
  /(half\s+price|50%\s+off|25%\s+off)\s+([^.!]+)/gi,
  // Buy X get Y deals
  /(\d+)\s+for\s+(\$\d+(?:\.\d{2})?)/gi,
];

const DAY_PATTERNS = [
  { pattern: /monday|mon\b/gi, day: 1 },
  { pattern: /tuesday|tue\b|tues\b/gi, day: 2 },
  { pattern: /wednesday|wed\b/gi, day: 3 },
  { pattern: /thursday|thu\b|thur\b|thurs\b/gi, day: 4 },
  { pattern: /friday|fri\b/gi, day: 5 },
  { pattern: /saturday|sat\b/gi, day: 6 },
  { pattern: /sunday|sun\b/gi, day: 0 },
];

// Pure function to normalize time
const normalizeTime = (timeStr: string): string => {
  const time = timeStr.toLowerCase().trim();
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  
  if (!match) return time;
  
  let hour = parseInt(match[1]);
  const minute = match[2] || '00';
  const period = match[3] || '';
  
  // Convert to 24-hour format for storage
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  
  return `${hour.toString().padStart(2, '0')}:${minute}`;
};

// Pure function to extract deals from text
const extractDealsFromText = (text: string): Array<{
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  description: string;
  sourceText: string;
}> => {
  const deals: Array<{
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    description: string;
    sourceText: string;
  }> = [];

  if (!text || text.trim().length === 0) return deals;

  // Extract time-based deals
  const timeMatches = [...text.matchAll(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)[:\s]*([^.!]{1,100})/gi)];
  
  timeMatches.forEach(match => {
    const startTime = normalizeTime(match[1]);
    const endTime = normalizeTime(match[2]);
    const description = match[3].trim();
    
    // Try to find day of week in surrounding text
    let dayOfWeek: number | undefined;
    for (const dayPattern of DAY_PATTERNS) {
      if (dayPattern.pattern.test(text)) {
        dayOfWeek = dayPattern.day;
        break;
      }
    }
    
    if (description.length > 5) { // Only include meaningful descriptions
      deals.push({
        dayOfWeek,
        startTime,
        endTime,
        description,
        sourceText: match[0]
      });
    }
  });

  // Extract general deals without specific times
  const generalMatches = [...text.matchAll(/(half\s+price|50%\s+off|25%\s+off|\$\d+(?:\.\d{2})?\s+(?:beer|drink|cocktail|wine|shot)s?)/gi)];
  
  generalMatches.forEach(match => {
    deals.push({
      description: match[0].trim(),
      sourceText: match[0]
    });
  });

  return deals;
};

// Main deal processing function
const processBusinessDeals = async (businessId: string): Promise<void> => {
  try {
    // Get business with existing data
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      logger.warn({ businessId }, 'Business not found for deal processing');
      return;
    }

    const allDeals: Array<{
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      title: string;
      description: string;
      extractedBy: string;
      sourceText: string;
      confidence: number;
    }> = [];

    // Extract deals from various text sources
    const textSources = [
      business.operatingHours.join(' '),
      // Add more sources as they become available (reviews, descriptions, etc.)
    ];

    textSources.forEach((text) => {
      if (!text || text.trim().length === 0) return;
      
      const extractedDeals = extractDealsFromText(text);
      
      extractedDeals.forEach(deal => {
        allDeals.push({
          dayOfWeek: deal.dayOfWeek,
          startTime: deal.startTime,
          endTime: deal.endTime,
          title: deal.description.slice(0, 100), // Truncate for title
          description: deal.description,
          extractedBy: 'pattern-extraction',
          sourceText: deal.sourceText,
          confidence: 0.7 // Medium confidence for pattern matching
        });
      });
    });

    // Save deals to database and publish appropriate event
    if (allDeals.length > 0) {
      // Delete existing deals for this business
      await prisma.deal.deleteMany({
        where: { businessId }
      });

      // Create new deals
      await prisma.deal.createMany({
        data: allDeals.map(deal => ({
          businessId,
          dayOfWeek: deal.dayOfWeek,
          startTime: deal.startTime,
          endTime: deal.endTime,
          title: deal.title,
          description: deal.description,
          extractedBy: deal.extractedBy,
          sourceText: deal.sourceText,
          confidence: deal.confidence,
          isActive: true,
          isVerified: false
        }))
      });

      // Publish deal processed event with deals found
      const dealEvent: DealProcessedEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        source: 'deal-processing-service',
        type: 'business.deals.processed',
        data: {
          businessId,
          dealsExtracted: allDeals.length,
          hasActiveDeals: true
        }
      };

      publishEvent(dealEvent);

      logger.info({
        businessId,
        businessName: business.name,
        dealsExtracted: allDeals.length,
        eventId: dealEvent.id
      }, 'Successfully extracted and saved deals - triggering photo processing');

    } else {
      // Publish event even with no deals (for analytics and workflow completion)
      const noDealEvent: DealProcessedEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        source: 'deal-processing-service',
        type: 'business.deals.processed',
        data: {
          businessId,
          dealsExtracted: 0,
          hasActiveDeals: false
        }
      };

      publishEvent(noDealEvent);

      logger.debug({
        businessId,
        businessName: business.name,
        eventId: noDealEvent.id
      }, 'No deals found for business - photo processing will be skipped');
    }

  } catch (error) {
    logger.error({
      err: error,
      businessId
    }, 'Failed to process business deals');
  }
};

// Event handler for business deduplication completion
const handleBusinessDeduplicatedEvent = async (event: BusinessDeduplicatedEvent): Promise<void> => {
  try {
    logger.debug({
      eventId: event.id,
      businessId: event.data.businessId,
      action: event.data.action
    }, 'Processing deals for deduplicated business');

    await processBusinessDeals(event.data.businessId);

  } catch (error) {
    logger.error({
      err: error,
      eventId: event.id,
      businessId: event.data.businessId
    }, 'Failed to process deals for business');
  }
};

// Initialize deal processing service
export const initializeDealProcessingService = (): void => {
  subscribeToEvent('business.deduplicated', handleBusinessDeduplicatedEvent);
  logger.info('DealProcessingService event listeners registered');
};

// Export for manual processing
export { processBusinessDeals };