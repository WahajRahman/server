import express from 'express';
import { getDeliveryModes, getDeliveryTerms, getPaymentTerms } from '../controllers/termsController.js';
import { requestLogger } from '../middleware/requestLogger.js';
const router = express.Router();

router.get('/dlvModes', requestLogger, getDeliveryModes);
router.get('/dlvTerms', requestLogger, getDeliveryTerms);
router.get('/paymentTerms', requestLogger, getPaymentTerms);


export default router;