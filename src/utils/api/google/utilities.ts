import { PlaceDetails } from "./api";

export const processPlaceData = (place: PlaceDetails) => ({
  placeId: place.id,
  name: place.displayName.text,
  latitude: place.location.latitude,
  longitude: place.location.longitude,
  address: place.formattedAddress,
  ratingGoogle: place.rating || null,
  priceLevel: place.priceLevel ? 
    ({ 
      'PRICE_LEVEL_INEXPENSIVE': 1,
      'PRICE_LEVEL_MODERATE': 2,
      'PRICE_LEVEL_EXPENSIVE': 3,
      'PRICE_LEVEL_VERY_EXPENSIVE': 4
    }[place.priceLevel] || null) : null,  // Convert string price level to number
  url: place.websiteUri || null,
//   phoneNumber: place.nationalPhoneNumber || null,
  isBar: place.types.includes('bar') 
    || place.types.includes('pub')
    || place.types.includes('wine_bar'),
  isRestaurant: place.types.includes('restaurant') 
    || place.types.includes('bar_and_grill') 
    || place.types.includes('fine_dining_restaurant'),
//   operatingHours: place.regularOpeningHours?.weekdayDescriptions || [],
  updatedOn: new Date()
});