import { Router } from 'express';
import v1Routes from './v1.routes';

const router = Router();

/**
 * Main Router
 */
router.use('/api/v1', v1Routes);

export default router;
