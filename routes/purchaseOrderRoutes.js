import express from 'express';
import {
  createMutiplePurchaseOrderLines,
  createPurchaseOrder,
  createPurchaseOrderLines,
  deletePurchaseOrder,
  editPurchaseOrderHeader,
  editPurchaseOrderLines,
  getPurchaseOrderByNumber,
  getPurchaseOrderLines,
  getPurchaseOrders,
} from '../controllers/purchaseOrderController.js';
import { requestLogger } from '../middleware/requestLogger.js';
import { isAuthenticated } from '../middleware/authentication.js';


const router = express.Router();
 

router.post('/create', requestLogger, createPurchaseOrder);
router.get('/list', requestLogger, getPurchaseOrders);
router.post('/lines/create', requestLogger, createPurchaseOrderLines);
router.patch('/update/:poNumber', requestLogger, editPurchaseOrderHeader);
router.get('/details/:poNumber', requestLogger, getPurchaseOrderByNumber);
router.delete('/delete/:poNumber', requestLogger, deletePurchaseOrder);
router.get('/lines/:poNumber', requestLogger, getPurchaseOrderLines);
router.patch('/lines/update/:poNumber/:lineNumber', requestLogger, editPurchaseOrderLines);
router.post('/lines/batch/create', requestLogger, createMutiplePurchaseOrderLines);

export default router;

