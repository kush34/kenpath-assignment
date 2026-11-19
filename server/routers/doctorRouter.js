import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireDoctor } from '../middlewares/requireDoctor.js';
import { listPatients, getPatientReport } from '../controllers/doctorController.js';

const router = Router();

router.get('/patients', requireAuth, requireDoctor, asyncHandler(listPatients));
router.get('/patients/:patientId/reports', requireAuth, requireDoctor, asyncHandler(getPatientReport));

export default router;
