import { Request, Response } from 'express';
import {
  getOneUserService,
  getManyUserService, 
  createUserService,
  createManyUserService,
  updateOneUserService,
  updateManyUserService,
  deleteOneUserService,
  deleteManyUserService
} from '../services/userService';
import { logger } from '../utils/logger/logger';

export const getOneUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ message: "User ID is required." });
      return;
    }

    const user = await getOneUserService({ id });

    if (!user) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    
    res.status(200).json(user);
  } catch (error) {
    logger.error({ err: error }, "Error fetching user");
    res.status(500).json({ message: "Error fetching user." });
  }
};

export const getManyUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await getManyUserService(req.body);

    if (!users || users.length === 0) {
      res.status(404).json({ message: "Users not found." });
      return;
    }
    
    res.status(200).json(users);
  } catch (error) {
    logger.error({ err: error }, "Error fetching users");
    res.status(500).json({ message: "Error fetching users." });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await createUserService(req.body);

    if (!user) {
      res.status(400).json({ message: "User not created." });
      return;
    }
    
    res.status(201).json(user);
  } catch (error) {
    logger.error({ err: error }, "Error creating user");
    res.status(500).json({ message: "Error creating user." });
  }
};

export const createManyUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await createManyUserService(req.body);

    if (!users) {
      res.status(400).json({ message: "Users not created." });
      return;
    }
    
    res.status(201).json(users);
  } catch (error) {
    logger.error({ err: error }, "Error creating users");
    res.status(500).json({ message: "Error creating users." });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ message: "User ID is required." });
      return;
    }

    const updatedUser = await updateOneUserService({ id }, req.body);

    if (!updatedUser) {
      res.status(404).json({ message: "User not updated." });
      return;
    }
    
    res.status(200).json(updatedUser);
  } catch (error) {
    logger.error({ err: error }, "Error updating user");
    res.status(500).json({ message: "Error updating user." });
  }
};

export const updateManyUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds, updateData } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ message: "User IDs array is required." });
      return;
    }

    const updatedUsers = await updateManyUserService(userIds, updateData);

    if (!updatedUsers) {
      res.status(404).json({ message: "Users not updated." });
      return;
    }
    
    res.status(200).json(updatedUsers);
  } catch (error) {
    logger.error({ err: error }, "Error updating users");
    res.status(500).json({ message: "Error updating users." });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ message: "User ID is required." });
      return;
    }

    const deletedUser = await deleteOneUserService({ id });

    if (!deletedUser) {
      res.status(404).json({ message: "User not deleted." });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "Error deleting user");
    res.status(500).json({ message: "Error deleting user." });
  }
};

export const deleteManyUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ message: "User IDs array is required." });
      return;
    }

    const deletedUsers = await deleteManyUserService({ id: { in: userIds } });

    if (!deletedUsers) {
      res.status(404).json({ message: "Users not deleted." });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, "Error deleting users");
    res.status(500).json({ message: "Error deleting users." });
  }
};