import { users, Prisma } from '@prisma/client';
import prisma from '../prismaClient';


// create one
export const createUserService = async (data: Prisma.usersCreateInput) => {
    return await prisma.users.create({
      data
    });
  };


// create many
export const createManyUserService = async (
    data: Prisma.usersCreateInput[]
  ) => {
      return await prisma.users.createMany({
        data,
        skipDuplicates: true // Optional: Avoid errors for duplicate records
      });
  };

  // get one
  export const getOneUserService = async (
      conditions: Prisma.usersWhereUniqueInput
    ) => {
        return await prisma.users.findUnique({
          where: conditions
        });
    };


// get many
export const getManyUserService = async (
    conditions?: Prisma.usersWhereInput
  ) => {
      return await prisma.users.findMany({
        where: conditions
      });
  };


// update one
export const updateOneUserService = async (
    data: Prisma.usersUpdateInput
  ) => {
      const id = JSON.stringify(data.id)
      return await prisma.users.update({
        where: {
          id,
        },
        data
      });
  };

// update many
export const updateManyUserService = async (
    data: Prisma.usersUpdateManyMutationInput
  ) => {
      const id = JSON.stringify(data.id)
      return await prisma.users.updateMany({
        where: { id },
        data: data
      });
  };

// delete one
export const deleteOneUserService = async (
    conditions: Prisma.usersWhereUniqueInput
  ) => {
      return await prisma.users.delete({
        where: conditions,
      });
  };

// delete many
export const deleteManyUserService = async (
    conditions: Prisma.usersWhereInput
  ) => {
      return await prisma.users.deleteMany({
        where: conditions,
      });
  };


