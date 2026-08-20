import { getAllUsers, createUser, updateUserRole, deactivateUser } from '../models/userModel.js';
import { getAllRoles, getReportsForRole, assignReportsToRole } from '../models/roleModel.js';
import { getUserByUsername } from '../services/ldapService.js';
import logger from '../config/logger.js';

export async function getUsers(req, res) {
  try {
    const users = await getAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createUserHandler(req, res) {
  try {
    const { username, fullName, roleId } = req.body;
    if (!username || !fullName || !roleId) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    // Optionally verify with LDAP
    const ldapUser = await getUserByUsername(username);
    if (!ldapUser) {
      return res.status(400).json({ success: false, error: 'User not found in LDAP' });
    }
    const id = await createUser(username, fullName, roleId);
    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateUserRoleHandler(req, res) {
  try {
    const { userId, roleId } = req.body;
    await updateUserRole(userId, roleId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deactivateUserHandler(req, res) {
  try {
    const { userId } = req.params;
    await deactivateUser(userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRoles(req, res) {
  try {
    const roles = await getAllRoles();
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRoleReports(req, res) {
  try {
    const { roleId } = req.params;
    const reports = await getReportsForRole(roleId);
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function assignRoleReports(req, res) {
  try {
    const { roleId } = req.params;
    const { reportKeys } = req.body;
    await assignReportsToRole(roleId, reportKeys);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}