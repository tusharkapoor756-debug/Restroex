import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();
const controller = new HealthController();

router.get('/', (req, res) => controller.check(req, res));

export default router;
