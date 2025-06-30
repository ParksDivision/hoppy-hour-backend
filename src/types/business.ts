export interface Location {
  lat: number;
  lng: number;
  name: string;
}

export interface StandardizedBusiness {
  name: string;
  normalizedName: string;
  address: string;
  normalizedAddress: string;
  phone?: string;
  normalizedPhone?: string;
  website?: string;
  domain?: string;
  latitude: number;
  longitude: number;
  categories: string[];
  isBar: boolean;
  isRestaurant: boolean;
  ratingGoogle?: number;
  priceLevel?: number;
  operatingHours: string[];
  sourceId: string;
  source: string;
  rawData: any;
}