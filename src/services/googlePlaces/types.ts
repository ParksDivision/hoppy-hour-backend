import { Prisma } from '@prisma/client';

export interface GooglePlacesSearchOptions {
  radius?: number;
  includedTypes?: string[];
  excludedTypes?: string[];
  maxResultCount?: number;
  rankPreference?: 'POPULARITY' | 'DISTANCE';
  detailLevel?: 'basic' | 'standard' | 'detailed';
}

// Database structure matching Prisma GoogleRawBusiness model
export interface GoogleRawBusinessData {
  name: string | null;
  addressFull: Prisma.JsonValue | null;
  location: Prisma.JsonValue | null;
  primaryPhone: string | null;
  uri: string | null;
  data: Prisma.JsonValue | null;
}

export type {
  Place,
  NearbySearchRequest,
  NearbySearchResponse,
  LatLng,
} from '../../schemas/googlePlaces.schema';
