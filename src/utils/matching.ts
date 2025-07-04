
export interface SimilarityScores {
  name: number;
  location: number;
  phone?: number;
  domain?: number;
  overall: number;
}

export interface MatchCandidate {
  businessId: string;
  scores: SimilarityScores;
  confidence: number;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator  // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate name similarity score (0-1, higher is more similar)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  
  const normalized1 = name1.toLowerCase().trim();
  const normalized2 = name2.toLowerCase().trim();
  
  // Exact match
  if (normalized1 === normalized2) return 1.0;
  
  // Calculate Levenshtein similarity
  const maxLen = Math.max(normalized1.length, normalized2.length);
  const distance = levenshteinDistance(normalized1, normalized2);
  const levenshteinScore = 1 - (distance / maxLen);
  
  // Calculate Jaccard similarity (word-based)
  const words1 = new Set(normalized1.split(/\s+/));
  const words2 = new Set(normalized2.split(/\s+/));
  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  const union = new Set(Array.from(words1).concat(Array.from(words2)));
  const jaccardScore = intersection.size / union.size;
  
  // Weighted combination
  return (levenshteinScore * 0.6) + (jaccardScore * 0.4);
}

/**
 * Calculate location proximity score based on distance (0-1, higher is closer)
 */
export function calculateLocationSimilarity(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  maxDistanceKm: number = 0.1 // 100 meters default
): number {
  const distance = calculateDistance(lat1, lng1, lat2, lng2);
  
  if (distance === 0) return 1.0;
  if (distance >= maxDistanceKm) return 0;
  
  return Math.max(0, 1 - (distance / maxDistanceKm));
}

/**
 * Calculate distance between two points using Haversine formula (in km)
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate phone number similarity (0-1)
 */
export function calculatePhoneSimilarity(phone1?: string, phone2?: string): number {
  if (!phone1 || !phone2) return 0;
  
  // Extract digits only
  const digits1 = phone1.replace(/\D/g, '');
  const digits2 = phone2.replace(/\D/g, '');
  
  if (digits1 === digits2) return 1.0;
  
  // Check if one is a subset of the other (e.g., with/without country code)
  if (digits1.length > digits2.length && digits1.endsWith(digits2)) return 0.9;
  if (digits2.length > digits1.length && digits2.endsWith(digits1)) return 0.9;
  
  return 0;
}

/**
 * Calculate domain similarity (0-1)
 */
export function calculateDomainSimilarity(domain1?: string, domain2?: string): number {
  if (!domain1 || !domain2) return 0;
  
  const normalized1 = domain1.toLowerCase().replace(/^www\./, '');
  const normalized2 = domain2.toLowerCase().replace(/^www\./, '');
  
  return normalized1 === normalized2 ? 1.0 : 0;
}

/**
 * Calculate overall business similarity
 */
export function calculateBusinessSimilarity(
  business1: {
    normalizedName: string;
    latitude: number;
    longitude: number;
    normalizedPhone?: string;
    domain?: string;
  },
  business2: {
    normalizedName: string;
    latitude: number;
    longitude: number;
    normalizedPhone?: string;
    domain?: string;
  }
): SimilarityScores {
  const nameScore = calculateNameSimilarity(business1.normalizedName, business2.normalizedName);
  const locationScore = calculateLocationSimilarity(
    business1.latitude, business1.longitude,
    business2.latitude, business2.longitude
  );
  const phoneScore = calculatePhoneSimilarity(business1.normalizedPhone, business2.normalizedPhone);
  const domainScore = calculateDomainSimilarity(business1.domain, business2.domain);
  
  // Calculate weighted overall score
  let weights = { name: 0.4, location: 0.4, phone: 0.1, domain: 0.1 };
  let totalWeight = 0.8; // base weight for name + location
  
  // Increase weight for phone/domain if they exist
  if (phoneScore > 0) totalWeight += 0.1;
  if (domainScore > 0) totalWeight += 0.1;
  
  const overall = (
    nameScore * weights.name +
    locationScore * weights.location +
    (phoneScore > 0 ? phoneScore * weights.phone : 0) +
    (domainScore > 0 ? domainScore * weights.domain : 0)
  ) / totalWeight;
  
  return {
    name: nameScore,
    location: locationScore,
    phone: phoneScore > 0 ? phoneScore : undefined,
    domain: domainScore > 0 ? domainScore : undefined,
    overall
  };
}

/**
 * Determine if two businesses are likely the same entity
 */
export function isLikelyMatch(scores: SimilarityScores): { isMatch: boolean; confidence: number } {
  // High confidence thresholds
  if (scores.name > 0.9 && scores.location > 0.9) {
    return { isMatch: true, confidence: 0.95 };
  }
  
  // Perfect phone or domain match with good name/location
  if ((scores.phone === 1.0 || scores.domain === 1.0) && scores.name > 0.7 && scores.location > 0.8) {
    return { isMatch: true, confidence: 0.9 };
  }
  
  // Good overall similarity
  if (scores.overall > 0.8) {
    return { isMatch: true, confidence: scores.overall };
  }
  
  // Medium confidence match
  if (scores.overall > 0.7 && scores.name > 0.8 && scores.location > 0.7) {
    return { isMatch: true, confidence: scores.overall };
  }
  
  return { isMatch: false, confidence: scores.overall };
}

/**
 * Find the best match from a list of candidates
 */
export function findBestMatch(candidates: MatchCandidate[]): MatchCandidate | null {
  if (candidates.length === 0) return null;
  
  // Sort by confidence descending
  const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
  
  // Return best match if confidence is above threshold
  const best = sorted[0];
  return best.confidence > 0.7 ? best : null;
}