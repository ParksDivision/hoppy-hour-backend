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

export const getOneUser = async (req: Request, res: Response) => {
  try {
      const user = await getOneUserService(req.body);

      if (!user) {
          res.status(404).json({ message: "User not found." });
        }
      res.status(200).json(user);
  } catch (error) {
      console.error("Error fetching user:");
      res.status(500).json({message: "Error fetching user."})
  }
};


export const getManyUsers = async (req: Request, res: Response) => {
try {
  const users = await getManyUserService(req.body);

  if (!users) {
    res.status(404).json({ message: "Users not found." });
  }
  res.json(users);
} catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({message: "Error fetching users."})
}
};


export const createUser = async (req: Request, res: Response) => {
try {
  const user = await createUserService(req.body);

  if (!user) {
    res.status(404).json({ message: "User not created." });
  }
  res.status(201).json(user);
} catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({message: "Error creating user:"})
}
};

export const createManyUsers = async (req: Request, res: Response) => {
try {
  const users = await createManyUserService(req.body);

  if (!users) {
    res.status(404).json({ message: "Users not created." });
  }
  res.status(201).json(users);
  } catch (error) {
    console.error("Error creating users:", error);
    res.status(500).json({message: "Error creating users."})
  }
};

export const updateUser = async (req: Request, res: Response) => {
try {
  const updatedUser = await updateOneUserService(req.body)

  if (!updatedUser) {
    res.status(404).json({ message: "User not updated." });
  }
  res.status(201).json(updatedUser);
} catch (error) {
  console.error("Error updating user:", error);
  res.status(500).json({message: "Error updating user."})
}
};

export const updateManyUsers = async (req: Request, res: Response) => {
  try {
    const updatedUsers = await updateManyUserService(req.body)

    if (!updatedUsers) {
      res.status(404).json({ message: "Users not updated." });
    }
    res.status(201).json(updatedUsers);
  } catch (error) {
    console.error("Error updating users:", error);
    res.status(500).json({message: "Error updating users."})
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
      const deletedUser = await deleteOneUserService(req.body)

      if (!deletedUser) {
          res.status(404).json({message: "User not deleted"})
      }
      res.status(204).json(deletedUser)
  } catch (error) {
      console.error("Error deleting user", error)
      res.status(500).json({message: "Error deleting user"})
  }
};

export const deleteManyUsers = async (req: Request, res: Response) => {
  try {
      const deletedUsers = await deleteManyUserService(req.body)

      if (!deletedUsers) {
          res.status(404).json({message: "Users not deleted"})
      }
      res.status(204).json(deletedUsers)
  } catch (error) {
      console.error("Error deleting users", error)
      res.status(500).json({message: "Error deleting users"})
  }
};
