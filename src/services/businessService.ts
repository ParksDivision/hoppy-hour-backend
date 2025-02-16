import { Business, Prisma } from '@prisma/client';
import prisma from '../prismaClient';


// create one
export const createBusinessService = async (data: Prisma.BusinessCreateInput) => {
    return await prisma.business.create({
      data
    });
  };


// create many
export const createManyBusinessService = async (
    data: Prisma.BusinessCreateManyInput[]
  ) => {
      return await prisma.business.createMany({
        data,
        skipDuplicates: true // Optional: Avoid errors for duplicate records
      });
  };

  // get one
  export const getOneBusinessService = async (
      conditions: Prisma.BusinessWhereUniqueInput
    ) => {
        return await prisma.business.findUnique({
          where: conditions
        });
    };


// get many
export const getManyBusinessService = async (
    conditions?: Prisma.BusinessWhereInput
  ) => {
      return await prisma.business.findMany({
        where: conditions
      });
  };


// update one
export const updateOneBusinessService = async (
    data: Prisma.BusinessUpdateInput
  ) => {
      const id = JSON.stringify(data.id)
      return await prisma.business.update({
        where: {
          id,
        },
        data
      });
  };

// update many
export const updateManyBusinessService = async (
    data: Prisma.BusinessUpdateManyMutationInput
  ) => {
      const id = JSON.stringify(data.id)
      return await prisma.business.updateMany({
        where: { id },
        data: data
      });
  };

// delete one
export const deleteOneBusinessService = async (
    conditions: Prisma.BusinessWhereUniqueInput
  ) => {
      return await prisma.business.delete({
        where: conditions,
      });
  };

// delete many
export const deleteManyBusinessService = async (
    conditions: Prisma.BusinessWhereInput
  ) => {
      return await prisma.business.deleteMany({
        where: conditions,
      });
  };


