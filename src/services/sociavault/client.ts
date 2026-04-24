import axios, { AxiosError } from 'axios';
import { sociavaultConfig } from '../../config/sociavault';
import { logger } from '../../utils/logger';

const sociavault = axios.create({
  baseURL: sociavaultConfig.baseUrl,
  timeout: sociavaultConfig.timeout,
  headers: {
    'X-API-Key': sociavaultConfig.apiKey ?? '',
    'Content-Type': 'application/json',
  },
});

/**
 * Returns the Unix timestamp (ms) for the cutoff date.
 * Posts older than this should be excluded.
 */
export function getCutoffTimestamp(): number {
  return Date.now() - sociavaultConfig.maxAgeDays * 24 * 60 * 60 * 1000;
}

export type SociavaultError = {
  status: number;
  message: string;
  endpoint: string;
};

/**
 * Make a GET request to SociaVault, returning the parsed response.
 * Throws a structured error on failure.
 */
export async function sociavaultGet<T>(
  path: string,
  params: Record<string, string | boolean | undefined>
): Promise<T> {
  if (!sociavaultConfig.apiKey) {
    throw new Error('SOCIAVAULT_API_KEY is not configured');
  }

  // Strip undefined params
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined)
  );

  try {
    const response = await sociavault.get<T>(path, { params: cleanParams });
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError<{ error?: string; message?: string }>;
    const status = axiosErr.response?.status ?? 0;
    const message =
      axiosErr.response?.data?.error ??
      axiosErr.response?.data?.message ??
      axiosErr.message;

    logger.error({ path, params: cleanParams, status, message }, 'SociaVault API error');

    throw new Error(`SociaVault ${path} failed (${status}): ${message}`);
  }
}
