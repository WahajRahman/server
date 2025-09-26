import express from "express";
import { getItemById, getItems } from "../controllers/itemsController.js";
import { requestLogger } from '../middleware/requestLogger.js';
const router = express.Router();

router.get("/allItems", requestLogger, getItems);
router.get("/item/:id", requestLogger, getItemById);


export default router;