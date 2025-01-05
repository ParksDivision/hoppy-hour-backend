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
} from '../controllers/userController'

const userRoutes = Router();

userRoutes.get('/:id', getOneUser);
userRoutes.get('/', getManyUsers)
userRoutes.post('/', createUser);
userRoutes.post('/', createManyUsers);
userRoutes.put('/update/:id', updateUser)
userRoutes.put('/update', updateManyUsers)
userRoutes.delete('/delete/:id', deleteUser)
userRoutes.delete('/delete', deleteManyUsers)

export default userRoutes;
