import { Router } from 'express';
import { dispatchNotifications } from '../controllers/notification.controller';
import { verifyFirebaseToken } from '../middleware/firebaseAuth.middleware';

const router = Router();

router.post('/dispatch', verifyFirebaseToken, dispatchNotifications);

export default router;