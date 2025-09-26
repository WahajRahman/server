import express from 'express';


import { requestLogger } from '../middleware/requestLogger.js';
import { getTransferOrderById, getTransferOrders } from '../controllers/transferOrderProcessController.js';

const router = express.Router();

router.get('/', requestLogger, getTransferOrders);
router.get('/:id', requestLogger, getTransferOrderById);

export default router;