import { Request, Response } from 'express';
import prisma from '../utils/database';

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.create({
      data: { email, name },
    });

    res.status(201).json(user);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002') {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, name } = req.body;

    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { email, name },
    });

    res.json(user);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      if (error.code === 'P2002') {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
