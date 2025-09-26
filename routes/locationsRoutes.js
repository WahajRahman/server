import express from "express";
import { getSites, getCurrencies, getWarehouses } from "../controllers/locationsController.js";
import { requestLogger } from '../middleware/requestLogger.js';
const router = express.Router();

router.get('/sites', requestLogger, getSites);
router.get('/warehouses', requestLogger, getWarehouses);
router.get('/currencies', requestLogger, getCurrencies);

export default router;