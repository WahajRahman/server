import express from 'express';
import {
  getVendors
} from '../controllers/purchaseOrderController.js';
import { requestLogger } from '../middleware/requestLogger.js';

const router = express.Router();

router.get('/vendors', requestLogger, getVendors);

export default router;