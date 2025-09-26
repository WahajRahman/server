import express from "express";
import { getCompanies } from "../controllers/CompaniesController.js";
import { requestLogger } from '../middleware/requestLogger.js';
const router = express.Router();

router.get("/", requestLogger, getCompanies);

export default router;

