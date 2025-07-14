import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger/logger';
import { publishEvent, subscribeToEvent } from '../events/eventBus';
import { 
  findBusinessById,
  findBusinessBySourceId,
  findPotentialDuplicates,
  createBusiness,
  updateBusiness,
  mergeBusiness,
  searchBusinesses
} from '../repositories/businessRepository';
import type { BusinessStandardizedEvent, BusinessDeduplicatedEvent } from '../events/eventTypes';
import type { StandardizedBusiness } from '../types/business';
import { 
  calculateBusinessSimilarity, 
  isLikelyMatch, 
  findBestMatch, 
  type MatchCandidate 
} from '../utils/matching';


// Configuration constants
const CONFIDENCE_THRESHOLD = 0.7;
const HIGH_CONFIDENCE_THRESHOLD = 0.9;

// Pure function to determine if businesses should be merged based on data quality
const shouldMergeBasedOnDataQuality = (
  existingBusiness: any,
  standardizedBusiness: StandardizedBusiness
): boolean => {
  let improvements = 0;
  
  // Check if new data fills missing fields
  if (!existingBusiness.phone && standardizedBusiness.phone) improvements++;
  if (!existingBusiness.website && standardizedBusiness.website) improvements++;
  if (existingBusiness.operatingHours.length === 0 && standardizedBusiness.operatingHours.length > 0) improvements++;
  if (existingBusiness.categories.length < standardizedBusiness.categories.length) improvements++;
  
  // Check if new data has better ratings
  if (standardizedBusiness.source === 'GOOGLE' && !existingBusiness.ratingGoogle && standardizedBusiness.ratingGoogle) improvements++;
  if (standardizedBusiness.source === 'YELP' && !existingBusiness.ratingYelp && standardizedBusiness.ratingYelp) improvements++;
  
  // Check if price level is missing
  if (!existingBusiness.priceLevel && standardizedBusiness.priceLevel) improvements++;
  
  // Merge if we have 2 or more improvements
  return improvements >= 2;
};

// Pure function to analyze match candidates
const analyzeMatchCandidates = (
  standardizedBusiness: StandardizedBusiness,
  candidates: any[]
): MatchCandidate[] => {
  const matchCandidates: MatchCandidate[] = [];

  for (const candidate of candidates) {
    const scores = calculateBusinessSimilarity(
      {
        normalizedName: standardizedBusiness.normalizedName,
        latitude: standardizedBusiness.latitude,
        longitude: standardizedBusiness.longitude,
        normalizedPhone: standardizedBusiness.normalizedPhone,
        domain: standardizedBusiness.domain
      },
      {
        normalizedName: candidate.normalizedName || '',
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        normalizedPhone: candidate.normalizedPhone || undefined,
        domain: candidate.domain || undefined
      }
    );

    const matchResult = isLikelyMatch(scores);

    if (matchResult.isMatch) {
      matchCandidates.push({
        businessId: candidate.id,
        scores,
        confidence: matchResult.confidence
      });
    }
  }

  return matchCandidates;
};

// Main business deduplication processing function
const processBusinessDeduplication = async (standardizedBusiness: StandardizedBusiness): Promise<{
  businessId: string;
  action: 'created' | 'merged' | 'updated';
  confidence: number;
}> => {
  
  // First, check if we already have this exact business by source ID
  const existingBySource = await findBusinessBySourceId(
    standardizedBusiness.sourceId, 
    standardizedBusiness.source
  );

  if (existingBySource) {
    // Update existing business
    const updatedBusiness = await updateBusiness(
      existingBySource.id,
      standardizedBusiness,
      1.0 // High confidence for source ID match
    );

    return {
      businessId: updatedBusiness.id,
      action: 'updated',
      confidence: 1.0
    };
  }

  // Find potential duplicate candidates
  const candidates = await findPotentialDuplicates(standardizedBusiness);

  if (candidates.length === 0) {
    // No potential duplicates found, create new business
    const newBusiness = await createBusiness(standardizedBusiness);
    
    return {
      businessId: newBusiness.id,
      action: 'created',
      confidence: 1.0
    };
  }

  // Analyze candidates for similarity
  const matchCandidates = analyzeMatchCandidates(standardizedBusiness, candidates);

  // Find the best match
  const bestMatch = findBestMatch(matchCandidates);

  if (!bestMatch) {
    // No good matches found, create new business
    const newBusiness = await createBusiness(standardizedBusiness);
    
    return {
      businessId: newBusiness.id,
      action: 'created',
      confidence: 1.0
    };
  }

  // We have a match - decide whether to merge or update
  const matchedBusiness = await findBusinessById(bestMatch.businessId);
  if (!matchedBusiness) {
    throw new Error(`Matched business not found: ${bestMatch.businessId}`);
  }

  // High confidence matches get merged
  if (bestMatch.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    const mergedBusiness = await mergeBusiness(
      bestMatch.businessId,
      standardizedBusiness,
      bestMatch.confidence
    );

    logger.info({
      targetBusinessId: bestMatch.businessId,
      sourceBusinessName: standardizedBusiness.name,
      targetBusinessName: matchedBusiness.name,
      confidence: bestMatch.confidence,
      nameScore: bestMatch.scores.name,
      locationScore: bestMatch.scores.location
    }, 'Merged business with high confidence match');

    return {
      businessId: mergedBusiness.id,
      action: 'merged',
      confidence: bestMatch.confidence
    };
  }

  // Medium confidence matches get updated if they enhance existing data
  if (bestMatch.confidence >= CONFIDENCE_THRESHOLD) {
    const shouldMerge = shouldMergeBasedOnDataQuality(matchedBusiness, standardizedBusiness);

    if (shouldMerge) {
      const mergedBusiness = await mergeBusiness(
        bestMatch.businessId,
        standardizedBusiness,
        bestMatch.confidence
      );

      logger.info({
        targetBusinessId: bestMatch.businessId,
        sourceBusinessName: standardizedBusiness.name,
        targetBusinessName: matchedBusiness.name,
        confidence: bestMatch.confidence,
        reason: 'data_quality_improvement'
      }, 'Merged business based on data quality improvement');

      return {
        businessId: mergedBusiness.id,
        action: 'merged',
        confidence: bestMatch.confidence
      };
    } else {
      // Update existing business with new information
      const updatedBusiness = await updateBusiness(
        bestMatch.businessId,
        standardizedBusiness,
        bestMatch.confidence
      );

      return {
        businessId: updatedBusiness.id,
        action: 'updated',
        confidence: bestMatch.confidence
      };
    }
  }

  // Below threshold - create new business
  const newBusiness = await createBusiness(standardizedBusiness);
  
  return {
    businessId: newBusiness.id,
    action: 'created',
    confidence: 1.0
  };
};

// Event handler function
const handleStandardizedBusinessEvent = async (event: BusinessStandardizedEvent): Promise<void> => {
  try {
    logger.info({
      eventId: event.id,
      sourceId: event.data.sourceId,
      source: event.data.source,
      businessName: event.data.standardizedBusiness.name
    }, 'Processing standardized business for deduplication');

    const result = await processBusinessDeduplication(event.data.standardizedBusiness);

    // Publish deduplicated event
    const deduplicatedEvent: BusinessDeduplicatedEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      source: 'deduplication-service',
      type: 'business.deduplicated',
      data: {
        businessId: result.businessId,
        action: result.action,
        confidence: result.confidence
      }
    };

    publishEvent(deduplicatedEvent);

    logger.info({
      originalEventId: event.id,
      newEventId: deduplicatedEvent.id,
      businessId: result.businessId,
      action: result.action,
      confidence: result.confidence
    }, 'Business deduplication completed successfully');

  } catch (error) {
    logger.error({
      err: error,
      eventId: event.id,
      sourceId: event.data.sourceId
    }, 'Failed to process business deduplication');
    throw error;
  }
};

// Statistics function
export const getDeduplicationStats = async (): Promise<{
  totalBusinesses: number;
  businessesBySource: Record<string, number>;
  averageConfidence: number;
  duplicatesFoundToday: number;
}> => {
  try {
    // This would require additional tracking in the database
    // For now, return basic stats from the business table
    const totalBusinesses = await searchBusinesses({});
    
    const businessesBySource: Record<string, number> = {
      GOOGLE: totalBusinesses.filter(b => b.placeId).length,
      YELP: totalBusinesses.filter(b => b.yelpId).length,
      MANUAL: totalBusinesses.filter(b => !b.placeId && !b.yelpId).length
    };

    const confidenceValues = totalBusinesses.map(b => b.confidence).filter(c => c !== null) as number[];
    const averageConfidence = confidenceValues.length > 0 
      ? confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length
      : 0;

    // Count businesses updated today (proxy for duplicates found)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const duplicatesFoundToday = totalBusinesses.filter(
      b => b.updatedOn && b.updatedOn >= today && b.createdOn && b.createdOn < today
    ).length;

    return {
      totalBusinesses: totalBusinesses.length,
      businessesBySource,
      averageConfidence,
      duplicatesFoundToday
    };

  } catch (error) {
    logger.error({ err: error }, 'Failed to get deduplication stats');
    throw error;
  }
};

// Initialization function
export const initializeDeduplicationService = (): void => {
  subscribeToEvent('business.standardized', handleStandardizedBusinessEvent);
  logger.info('DeduplicationService event listeners registered');
};

// Export individual functions for testing
export {
  shouldMergeBasedOnDataQuality,
  analyzeMatchCandidates,
  processBusinessDeduplication,
  handleStandardizedBusinessEvent
};