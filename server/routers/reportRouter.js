import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { getReport } from '../controllers/reportController.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(getReport));

export default router;
