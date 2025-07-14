import { Router } from 'express';
import { 
  getOneUser,
  getManyUsers,
  createUser,
  createManyUsers,
  updateUser,
  updateManyUsers,
  deleteUser,
  deleteManyUsers
} from '../controllers/userController';

const userRoutes = Router();

// GET routes
userRoutes.get('/:id', getOneUser);
userRoutes.get('/', getManyUsers);

// POST routes - Fixed duplicate route conflict
userRoutes.post('/many', createManyUsers);  // Specific route first
userRoutes.post('/', createUser);           // General route second

// PUT routes
userRoutes.put('/update/:id', updateUser);
userRoutes.put('/update', updateManyUsers);

// DELETE routes
userRoutes.delete('/delete/:id', deleteUser);
userRoutes.delete('/delete', deleteManyUsers);

export default userRoutes;