import express from "express";
import { getFinancialDimensions } from "../controllers/finanicalDimensions.js";
import { requestLogger } from "../middleware/requestLogger.js";

const router = express.Router();

router.use(requestLogger);

router.get('/financial-dimensions', getFinancialDimensions);

export default router;
