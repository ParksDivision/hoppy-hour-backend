import { User, Prisma } from '@prisma/client';
import prisma from '../prismaClient';


// create one
export const createUserService = async (data: Prisma.UserCreateInput) => {
    return await prisma.user.create({
      data
    });
  };


// create many
export const createManyUserService = async (
    data: Prisma.UserCreateInput[]
  ) => {
      return await prisma.user.createMany({
        data,
        skipDuplicates: true // Optional: Avoid errors for duplicate records
      });
  };

  // get one
  export const getOneUserService = async (
      conditions: Prisma.UserWhereUniqueInput
    ) => {
        return await prisma.user.findUnique({
          where: conditions
        });
    };


// get many
export const getManyUserService = async (
    conditions?: Prisma.UserWhereInput
  ) => {
      return await prisma.user.findMany({
        where: conditions
      });
  };


// update one
export const updateOneUserService = async (
    data: Prisma.UserUpdateInput
  ) => {
      const id = JSON.stringify(data.id)
      return await prisma.user.update({
        where: {
          id,
        },
        data
      });
  };

// update many
export const updateManyUserService = async (
    data: Prisma.UserUpdateManyMutationInput
  ) => {
      const id = JSON.stringify(data.id)
      return await prisma.user.updateMany({
        where: { id },
        data: data
      });
  };

// delete one
export const deleteOneUserService = async (
    conditions: Prisma.UserWhereUniqueInput
  ) => {
      return await prisma.user.delete({
        where: conditions,
      });
  };

// delete many
export const deleteManyUserService = async (
    conditions: Prisma.UserWhereInput
  ) => {
      return await prisma.user.deleteMany({
        where: conditions,
      });
  };


