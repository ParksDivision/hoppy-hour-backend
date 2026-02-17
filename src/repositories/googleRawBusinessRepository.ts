/**
 * Google Raw Business Repository
 *
 * This repository provides database operations for the google_raw_business table.
 * It handles all Prisma interactions for storing and retrieving Google Places data.
 */

import prisma from '../utils/database';
import { Prisma } from '@prisma/client';
import { GoogleRawBusinessData } from '../services/googlePlaces/types';
import { logger } from '../utils/logger';

/**
 * Create a single Google raw business record
 *
 * @param data - Business data from Google Places API
 * @param createdBy - User/system identifier for audit trail
 * @returns Created business record with generated ID
 */
export const createGoogleRawBusiness = async (
  data: GoogleRawBusinessData,
  createdBy: string = 'system'
) => {
  try {
    const business = await prisma.googleRawBusiness.create({
      data: {
        googlePlaceId: data.googlePlaceId,
        name: data.name,
        addressFull: data.addressFull ?? Prisma.JsonNull,
        location: data.location ?? Prisma.JsonNull,
        primaryPhone: data.primaryPhone,
        uri: data.uri,
        data: data.data ?? Prisma.JsonNull,
        createdOn: new Date(),
        createdBy,
        updatedOn: new Date(),
        updatedBy: createdBy,
      },
    });

    logger.debug({ businessId: business.id, name: business.name }, 'Created Google raw business');

    return business;
  } catch (error) {
    logger.error({ error, data }, 'Failed to create Google raw business');
    throw error;
  }
};

/**
 * Bulk create multiple Google raw business records
 *
 * @param businesses - Array of business data from Google Places API
 * @param createdBy - User/system identifier for audit trail
 * @returns Count of created records
 */
export const bulkUpsertGoogleRawBusinesses = async (
  businesses: GoogleRawBusinessData[],
  createdBy: string = 'system'
) => {
  try {
    const now = new Date();

    const results = await prisma.$transaction(
      businesses.map((business) =>
        prisma.googleRawBusiness.upsert({
          where: { googlePlaceId: business.googlePlaceId! },
          create: {
            googlePlaceId: business.googlePlaceId,
            name: business.name,
            addressFull: business.addressFull ?? Prisma.JsonNull,
            location: business.location ?? Prisma.JsonNull,
            primaryPhone: business.primaryPhone,
            uri: business.uri,
            data: business.data ?? Prisma.JsonNull,
            createdOn: now,
            createdBy,
            updatedOn: now,
            updatedBy: createdBy,
          },
          update: {
            name: business.name,
            addressFull: business.addressFull ?? Prisma.JsonNull,
            location: business.location ?? Prisma.JsonNull,
            primaryPhone: business.primaryPhone,
            uri: business.uri,
            data: business.data ?? Prisma.JsonNull,
            updatedOn: now,
            updatedBy: createdBy,
          },
        })
      )
    );

    logger.info(
      { count: results.length, total: businesses.length },
      'Bulk upserted Google raw businesses'
    );

    return { count: results.length };
  } catch (error) {
    logger.error({ error, count: businesses.length }, 'Failed to bulk upsert Google raw businesses');
    throw error;
  }
};

/**
 * Find a Google raw business by ID
 *
 * @param id - Business UUID
 * @returns Business record or null if not found
 */
export const findGoogleRawBusinessById = async (id: string) => {
  try {
    return await prisma.googleRawBusiness.findUnique({
      where: { id },
    });
  } catch (error) {
    logger.error({ error, id }, 'Failed to find Google raw business by ID');
    throw error;
  }
};

/**
 * Find Google raw businesses by name (partial match)
 *
 * @param name - Business name to search for
 * @param limit - Maximum number of results to return
 * @returns Array of matching business records
 */
export const findGoogleRawBusinessesByName = async (name: string, limit: number = 10) => {
  try {
    return await prisma.googleRawBusiness.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive',
        },
      },
      take: limit,
      orderBy: { createdOn: 'desc' },
    });
  } catch (error) {
    logger.error({ error, name }, 'Failed to find Google raw businesses by name');
    throw error;
  }
};

/**
 * Get all Google raw businesses with pagination
 *
 * @param skip - Number of records to skip
 * @param take - Number of records to return
 * @returns Array of business records
 */
export const getAllGoogleRawBusinesses = async (skip: number = 0, take: number = 50) => {
  try {
    return await prisma.googleRawBusiness.findMany({
      skip,
      take,
      orderBy: { createdOn: 'desc' },
    });
  } catch (error) {
    logger.error({ error, skip, take }, 'Failed to get all Google raw businesses');
    throw error;
  }
};

/**
 * Count total Google raw businesses in database
 *
 * @returns Total count of records
 */
export const countGoogleRawBusinesses = async () => {
  try {
    return await prisma.googleRawBusiness.count();
  } catch (error) {
    logger.error({ error }, 'Failed to count Google raw businesses');
    throw error;
  }
};

/**
 * Update a Google raw business record
 *
 * @param id - Business UUID
 * @param data - Updated business data
 * @param updatedBy - User/system identifier for audit trail
 * @returns Updated business record
 */
export const updateGoogleRawBusiness = async (
  id: string,
  data: Partial<GoogleRawBusinessData>,
  updatedBy: string = 'system'
) => {
  try {
    const updateData: Prisma.GoogleRawBusinessUpdateInput = {
      updatedOn: new Date(),
      updatedBy,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.primaryPhone !== undefined) updateData.primaryPhone = data.primaryPhone;
    if (data.uri !== undefined) updateData.uri = data.uri;
    if (data.addressFull !== undefined) updateData.addressFull = data.addressFull ?? Prisma.JsonNull;
    if (data.location !== undefined) updateData.location = data.location ?? Prisma.JsonNull;
    if (data.data !== undefined) updateData.data = data.data ?? Prisma.JsonNull;

    const business = await prisma.googleRawBusiness.update({
      where: { id },
      data: updateData,
    });

    logger.debug({ businessId: business.id }, 'Updated Google raw business');

    return business;
  } catch (error) {
    logger.error({ error, id }, 'Failed to update Google raw business');
    throw error;
  }
};

/**
 * Delete a Google raw business record
 *
 * @param id - Business UUID
 * @returns Deleted business record
 */
export const deleteGoogleRawBusiness = async (id: string) => {
  try {
    const business = await prisma.googleRawBusiness.delete({
      where: { id },
    });

    logger.debug({ businessId: business.id }, 'Deleted Google raw business');

    return business;
  } catch (error) {
    logger.error({ error, id }, 'Failed to delete Google raw business');
    throw error;
  }
};
