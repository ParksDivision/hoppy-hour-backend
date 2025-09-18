/**
 * Google Places API HTTP Client
 *
 * This file creates and configures an HTTP client specifically for making
 * requests to the Google Places API. It handles authentication, timeouts,
 * logging, and common error scenarios.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { googlePlacesConfig } from '../../config/googlePlaces';
import { logger } from '../../utils/logger';

const googlePlacesApi: AxiosInstance = axios.create({
  baseURL: googlePlacesConfig.baseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': googlePlacesConfig.apiKey,
  },
});

/**
 Response Interceptor for Logging and Error Handling
 */
googlePlacesApi.interceptors.response.use(
  (response) => {
    logger.debug(
      {
        method: response.config.method,
        url: response.config.url,
        status: response.status,
      },
      'Google Places API request completed'
    );

    return response;
  },

  (error: AxiosError) => {
    // Log the error with full context for debugging
    logger.error(
      {
        method: error.config?.method,
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
        errorDetails: error.response?.data,
      },
      'Google Places API request failed'
    );

    // Transform HTTP status codes into error messages
    if (error.response?.status === 403) {
      throw new Error('Google Places API: Invalid API key or quota exceeded');
    }
    if (error.response?.status === 429) {
      throw new Error('Google Places API: Rate limit exceeded');
    }
    if (error.response?.status === 404) {
      throw new Error('Google Places API: Resource not found');
    }

    // For any other errors, re-throw the original error
    throw error;
  }
);

export default googlePlacesApi;
