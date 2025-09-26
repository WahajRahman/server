import express from 'express';
import { login, signup, logout } from '../controllers/authenticationProcessController.js';
import { requestLogger } from '../middleware/requestLogger.js';
const router = express.Router();

router.post('/signup', requestLogger, signup);
router.post('/login', requestLogger, login);
router.post('/logout', requestLogger, logout);

export default router;