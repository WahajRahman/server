import express from 'express';
import { getProductVarients } from '../controllers/productVarients.js';

const router = express.Router();

router.get('/product-varients', getProductVarients);

export default router;