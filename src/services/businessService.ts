import { Business, Prisma } from '@prisma/client';
import prisma from '../prismaClient';

// Create one business
export const createBusinessService = async (data: Prisma.BusinessCreateInput): Promise<Business> => {
  return await prisma.business.create({
    data
  });
};

// Create many businesses
export const createManyBusinessService = async (
  data: Prisma.BusinessCreateManyInput[]
): Promise<Prisma.BatchPayload> => {
  return await prisma.business.createMany({
    data,
    skipDuplicates: true // Optional: Avoid errors for duplicate records
  });
};

// Get one business
export const getOneBusinessService = async (
  conditions: Prisma.BusinessWhereUniqueInput
): Promise<Business | null> => {
  return await prisma.business.findUnique({
    where: conditions,
    include: {
      photos: true,
      deals: true
    }
  });
};

// Get many businesses
export const getManyBusinessService = async (
  conditions?: Prisma.BusinessWhereInput
): Promise<Business[]> => {
  return await prisma.business.findMany({
    where: conditions,
    include: {
      photos: true,
      deals: true
    }
  });
};

// Update one business
export const updateOneBusinessService = async (
  where: Prisma.BusinessWhereUniqueInput,
  data: Prisma.BusinessUpdateInput
): Promise<Business> => {
  return await prisma.business.update({
    where,
    data
  });
};

// Update many businesses
export const updateManyBusinessService = async (
  businessIds: string[],
  data: Prisma.BusinessUpdateManyMutationInput
): Promise<Prisma.BatchPayload> => {
  return await prisma.business.updateMany({
    where: { 
      id: { 
        in: businessIds 
      } 
    },
    data
  });
};

// Delete one business
export const deleteOneBusinessService = async (
  conditions: Prisma.BusinessWhereUniqueInput
): Promise<Business> => {
  return await prisma.business.delete({
    where: conditions,
  });
};

// Delete many businesses
export const deleteManyBusinessService = async (
  conditions: Prisma.BusinessWhereInput
): Promise<Prisma.BatchPayload> => {
  return await prisma.business.deleteMany({
    where: conditions,
  });
};