/**
 * City Coordinates Configuration
 *
 * Defines search coordinates for comprehensive business discovery in various cities.
 * Uses neighborhood-based approach to ensure complete coverage.
 */

export interface SearchCoordinate {
  name: string; // Neighborhood or area name
  latitude: number;
  longitude: number;
  radius: number; // Search radius in meters
}

export interface CitySearchConfig {
  cityName: string;
  coordinates: SearchCoordinate[];
}

/**
 * Austin, TX Neighborhood Coordinates
 *
 * Comprehensive coverage of Austin with denser coverage in high-business areas
 * like Downtown, South Congress, East Austin, etc.
 */
export const austinCoordinates: SearchCoordinate[] = [
  // Downtown Austin - Dense coverage with smaller radius for complete capture
  { name: 'Downtown Core - 6th Street', latitude: 30.2672, longitude: -97.7431, radius: 1000 },
  { name: 'Downtown - Rainey Street', latitude: 30.2633, longitude: -97.7353, radius: 800 },
  { name: 'Downtown - West 6th', latitude: 30.2696, longitude: -97.7506, radius: 1000 },
  { name: 'Downtown - Congress Avenue', latitude: 30.2747, longitude: -97.7403, radius: 1000 },
  { name: 'Downtown - Warehouse District', latitude: 30.2653, longitude: -97.7486, radius: 1000 },
  { name: 'Downtown - Red River Cultural District', latitude: 30.2658, longitude: -97.7368, radius: 800 },

  // Central Austin
  { name: 'South Congress (SoCo)', latitude: 30.2471, longitude: -97.7479, radius: 1500 },
  { name: 'South Lamar', latitude: 30.2502, longitude: -97.7681, radius: 1500 },
  { name: 'Barton Hills', latitude: 30.2587, longitude: -97.7780, radius: 1500 },
  { name: 'Zilker', latitude: 30.2677, longitude: -97.7731, radius: 1500 },
  { name: 'West Campus - UT Area', latitude: 30.2866, longitude: -97.7436, radius: 1200 },
  { name: 'The Drag - Guadalupe', latitude: 30.2864, longitude: -97.7394, radius: 1000 },

  // East Austin
  { name: 'East 6th Street', latitude: 30.2625, longitude: -97.7265, radius: 1200 },
  { name: 'East Cesar Chavez', latitude: 30.2593, longitude: -97.7193, radius: 1500 },
  { name: 'Holly', latitude: 30.2531, longitude: -97.7152, radius: 1500 },
  { name: 'Govalle', latitude: 30.2612, longitude: -97.6985, radius: 1500 },
  { name: 'Mueller', latitude: 30.2974, longitude: -97.7077, radius: 1500 },
  { name: 'Cherrywood', latitude: 30.2849, longitude: -97.7134, radius: 1500 },

  // North Austin
  { name: 'Hyde Park', latitude: 30.3045, longitude: -97.7297, radius: 1500 },
  { name: 'North Loop', latitude: 30.3145, longitude: -97.7260, radius: 1500 },
  { name: 'Crestview', latitude: 30.3394, longitude: -97.7285, radius: 2000 },
  { name: 'Allandale', latitude: 30.3528, longitude: -97.7402, radius: 2000 },
  { name: 'The Domain', latitude: 30.3965, longitude: -97.7236, radius: 1500 },
  { name: 'Arboretum', latitude: 30.3839, longitude: -97.7435, radius: 1500 },

  // South Austin
  { name: 'St. Edwards Area', latitude: 30.2303, longitude: -97.7413, radius: 1500 },
  { name: 'Travis Heights', latitude: 30.2434, longitude: -97.7381, radius: 1500 },
  { name: 'Bouldin Creek', latitude: 30.2520, longitude: -97.7576, radius: 1200 },
  { name: 'Dawson', latitude: 30.2370, longitude: -97.7565, radius: 1500 },
  { name: 'Sunset Valley', latitude: 30.2312, longitude: -97.8016, radius: 2000 },
  { name: 'Circle C', latitude: 30.2036, longitude: -97.8679, radius: 2000 },

  // West Austin
  { name: 'Clarksville', latitude: 30.2826, longitude: -97.7620, radius: 1200 },
  { name: 'Old West Austin', latitude: 30.2804, longitude: -97.7526, radius: 1200 },
  { name: 'Tarrytown', latitude: 30.2962, longitude: -97.7713, radius: 1500 },
  { name: 'Westlake Hills', latitude: 30.2963, longitude: -97.7988, radius: 2000 },
  { name: 'Rollingwood', latitude: 30.2738, longitude: -97.7953, radius: 1500 },

  // Northwest Austin
  { name: 'Balcones Woods', latitude: 30.3654, longitude: -97.7596, radius: 2000 },
  { name: 'Mesa Park', latitude: 30.3847, longitude: -97.7598, radius: 2000 },
  { name: 'Great Hills', latitude: 30.4088, longitude: -97.7648, radius: 2000 },
  { name: 'Anderson Mill', latitude: 30.4525, longitude: -97.8063, radius: 2500 },

  // Southeast Austin
  { name: 'Riverside', latitude: 30.2436, longitude: -97.7201, radius: 1500 },
  { name: 'Montopolis', latitude: 30.2387, longitude: -97.6873, radius: 2000 },
  { name: 'Pleasant Valley', latitude: 30.2281, longitude: -97.6994, radius: 2000 },
  { name: 'Onion Creek', latitude: 30.1741, longitude: -97.7794, radius: 2500 },

  // Northeast Austin
  { name: 'Windsor Park', latitude: 30.3188, longitude: -97.6893, radius: 2000 },
  { name: 'Georgian Acres', latitude: 30.3405, longitude: -97.6870, radius: 2000 },
  { name: 'Walnut Creek', latitude: 30.3898, longitude: -97.6888, radius: 2000 },
  { name: 'Pflugerville Border', latitude: 30.4495, longitude: -97.6740, radius: 2500 },

  // Airport Area
  { name: 'Airport Boulevard Corridor', latitude: 30.3173, longitude: -97.7074, radius: 1500 },

  // Additional high-density commercial areas
  { name: 'Brodie Lane', latitude: 30.2079, longitude: -97.8471, radius: 2000 },
  { name: 'Lakeline', latitude: 30.4515, longitude: -97.8075, radius: 2000 },
  { name: '2nd Street District', latitude: 30.2671, longitude: -97.7456, radius: 800 },
];

/**
 * City configurations
 */
export const cityConfigs: Record<string, CitySearchConfig> = {
  austin: {
    cityName: 'Austin, TX',
    coordinates: austinCoordinates,
  },
  // Add more cities here as needed
  // dallas: { cityName: 'Dallas, TX', coordinates: dallasCoordinates },
  // houston: { cityName: 'Houston, TX', coordinates: houstonCoordinates },
};

/**
 * Get coordinates for a specific city
 */
export function getCityCoordinates(cityKey: string): SearchCoordinate[] | null {
  const config = cityConfigs[cityKey.toLowerCase()];
  return config ? config.coordinates : null;
}

/**
 * Get all available cities
 */
export function getAvailableCities(): string[] {
  return Object.keys(cityConfigs);
}
