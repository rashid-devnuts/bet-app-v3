import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
const adminController = new AdminController();

// Apply authentication middleware to all admin routes
router.use(authenticateToken);

// Update bet status
router.put('/bets/:betId/status', adminController.updateBetStatus.bind(adminController));

export default router;
