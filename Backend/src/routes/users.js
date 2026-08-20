import express from 'express';
import {
  getUsers,
  createUserHandler,
  updateUserRoleHandler,
  deactivateUserHandler,
  getRoles,
  getRoleReports,
  assignRoleReports,
} from '../controllers/userController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { searchLdapUsers, getLdapUserByUsername } from '../controllers/ldapController.js';

const router = express.Router();

// All routes require authentication and Admin role
router.use(authenticate);
router.use(requireRole('Admin'));

router.get('/', getUsers);
router.post('/', createUserHandler);
router.put('/:userId/role', updateUserRoleHandler);
router.delete('/:userId', deactivateUserHandler);
router.get('/roles', getRoles);
router.get('/roles/:roleId/reports', getRoleReports);
router.put('/roles/:roleId/reports', assignRoleReports);
// LDAP search (Admin only)
router.get('/ldap/search', searchLdapUsers);
router.get('/ldap/user/:username', getLdapUserByUsername);

export default router;