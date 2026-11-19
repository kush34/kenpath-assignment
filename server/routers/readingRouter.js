import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { listReadings, createReading, updateReading, deleteReading } from '../controllers/readingController.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listReadings));
router.post('/', requireAuth, asyncHandler(createReading));
router.put('/:id', requireAuth, asyncHandler(updateReading));
router.delete('/:id', requireAuth, asyncHandler(deleteReading));

export default router;
