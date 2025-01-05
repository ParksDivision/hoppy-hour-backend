import { businesses, Prisma } from '@prisma/client';
import prisma from '../prismaClient';


// create one
export const createBusinessService = async (data: Omit<businesses, 'id' | 'created_on' | 'updated_on'>) => {
    return await prisma.businesses.create({
      data
    });
  };


// create many
export const createManyBusinessService = async (
    data: Omit<businesses, 'id' | 'created_on' | 'updated_on'>[]
  ) => {
      return await prisma.businesses.createMany({
        data,
        skipDuplicates: true // Optional: Avoid errors for duplicate records
      });
  };

  // get one
  export const getOneBusinessService = async (
      conditions: Prisma.businessesWhereUniqueInput
    ) => {
        return await prisma.businesses.findUnique({
          where: conditions
        });
    };


// get many
export const getManyBusinessService = async (
    conditions?: Prisma.businessesWhereInput
  ) => {
      return await prisma.businesses.findMany({
        where: conditions
      });
  };


// update one
export const updateOneBusinessService = async (
    data: Prisma.businessesUpdateInput
  ) => {
      const id = JSON.stringify(data.id)
      return await prisma.businesses.update({
        where: {
          id,
        },
        data
      });
  };

// update many
export const updateManyBusinessService = async (
    data: Prisma.businessesUpdateManyMutationInput
  ) => {
      const id = JSON.stringify(data.id)
      return await prisma.businesses.updateMany({
        where: { id },
        data: data
      });
  };

// delete one
export const deleteOneBusinessService = async (
    conditions: Prisma.businessesWhereUniqueInput
  ) => {
      return await prisma.businesses.delete({
        where: conditions,
      });
  };

// delete many
export const deleteManyBusinessService = async (
    conditions: Prisma.businessesWhereInput
  ) => {
      return await prisma.businesses.deleteMany({
        where: conditions,
      });
  };


