import { User, Prisma } from '@prisma/client';
import prisma from '../prismaClient';

// Create one user
export const createUserService = async (data: Prisma.UserCreateInput): Promise<User> => {
  return await prisma.user.create({
    data
  });
};

// Create many users
export const createManyUserService = async (
  data: Prisma.UserCreateInput[]
): Promise<Prisma.BatchPayload> => {
  return await prisma.user.createMany({
    data,
    skipDuplicates: true // Optional: Avoid errors for duplicate records
  });
};

// Get one user
export const getOneUserService = async (
  conditions: Prisma.UserWhereUniqueInput
): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: conditions
  });
};

// Get many users
export const getManyUserService = async (
  conditions?: Prisma.UserWhereInput
): Promise<User[]> => {
  return await prisma.user.findMany({
    where: conditions
  });
};

// Update one user
export const updateOneUserService = async (
  where: Prisma.UserWhereUniqueInput,
  data: Prisma.UserUpdateInput
): Promise<User> => {
  return await prisma.user.update({
    where,
    data
  });
};

// Update many users
export const updateManyUserService = async (
  userIds: string[],
  data: Prisma.UserUpdateManyMutationInput
): Promise<Prisma.BatchPayload> => {
  return await prisma.user.updateMany({
    where: { 
      id: { 
        in: userIds 
      } 
    },
    data
  });
};

// Delete one user
export const deleteOneUserService = async (
  conditions: Prisma.UserWhereUniqueInput
): Promise<User> => {
  return await prisma.user.delete({
    where: conditions,
  });
};

// Delete many users
export const deleteManyUserService = async (
  conditions: Prisma.UserWhereInput
): Promise<Prisma.BatchPayload> => {
  return await prisma.user.deleteMany({
    where: conditions,
  });
};