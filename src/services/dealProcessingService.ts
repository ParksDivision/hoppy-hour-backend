// src/services/dealProcessingService.ts
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prismaClient';
import { logger } from '../utils/logger/logger';
import { subscribeToEvent, publishEvent } from '../events/eventBus';
import type { BusinessDeduplicatedEvent, DealProcessedEvent } from '../events/eventTypes';

// =====================================================
// DEAL PROCESSING SERVICE - CURRENTLY PAUSED
// =====================================================
// This service is temporarily disabled while we develop
// a more robust deal extraction solution that can handle
// multiple data sources and formats beyond regex patterns
// =====================================================

// Simple deal extraction patterns (PRESERVED FOR REFERENCE)
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

// Pure function to normalize time (PRESERVED)
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

// Pure function to extract deals from text (PRESERVED FOR FUTURE USE)
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

// Main deal processing function (PRESERVED BUT NOT ACTIVE)
const processBusinessDeals = async (businessId: string): Promise<void> => {
  logger.warn({ businessId }, 'Deal processing is currently PAUSED - skipping extraction');
  
  // Publish a "no deals processed" event to complete the workflow
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

  // Don't publish the event since we're bypassing deal processing entirely
  // publishEvent(noDealEvent);

  return;

  /* 
  ORIGINAL LOGIC PRESERVED FOR FUTURE ENHANCEMENT:
  
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
  */
};

// Event handler for business deduplication completion (DISABLED)
const handleBusinessDeduplicatedEvent = async (event: BusinessDeduplicatedEvent): Promise<void> => {
  logger.debug({
    eventId: event.id,
    businessId: event.data.businessId,
    action: event.data.action
  }, 'Deal processing PAUSED - skipping deal extraction for business');

  // Don't process deals - this will be handled by the new system later
  return;
};

// UPDATED: Initialize deal processing service (DISABLED)
export const initializeDealProcessingService = (): void => {
  // COMMENTED OUT - Deal processing is paused
  // subscribeToEvent('business.deduplicated', handleBusinessDeduplicatedEvent);
  
  logger.warn('DealProcessingService is PAUSED - event listeners disabled');
  logger.info('Deal extraction will be re-enabled with more robust solution');
  logger.info('Current flow: Raw → Standardize → Dedupe → Photos (deals skipped)');
};

// Manual processing function (PRESERVED for future testing)
export const manualProcessBusinessDeals = async (businessId: string): Promise<void> => {
  logger.warn({ businessId }, 'Manual deal processing requested but service is PAUSED');
  logger.info('To process deals manually, re-enable the service and call processBusinessDeals()');
  return;
};

// Get current deal processing status
 const getDealProcessingStatus = () => {
  return {
    status: 'PAUSED',
    reason: 'Regex-based extraction being replaced with more robust solution',
    capabilities: [
      'Time-based deal extraction',
      'Day-of-week parsing', 
      'Price pattern matching',
      'Multi-source text processing'
    ],
    plannedImprovements: [
      'AI-powered deal extraction',
      'Multi-language support',
      'Confidence scoring',
      'Real-time verification',
      'Multiple data source integration'
    ],
    preservedFunctions: [
      'extractDealsFromText',
      'normalizeTime', 
      'processBusinessDeals',
      'DEAL_PATTERNS',
      'DAY_PATTERNS'
    ]
  };
};

// Export preserved functions for future use
export { 
  processBusinessDeals, 
  extractDealsFromText,
  normalizeTime,
  DEAL_PATTERNS,
  DAY_PATTERNS,
  getDealProcessingStatus
};