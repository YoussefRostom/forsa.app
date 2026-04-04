import { Router } from 'express';
import {
  deleteMedia,
  getSignedUploadUrl,
  validateFileSize,
  getPlaybackUrl,
  getUploadLimits,
} from '../controllers/media.controller';
import { verifyFirebaseToken } from '../middleware/firebaseAuth.middleware';
import { uploadRateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

/**
 * GET /api/media/upload-limits
 * Get upload limits configuration (public, no auth required)
 */
router.get('/upload-limits', getUploadLimits);

/**
 * POST /api/media/signed-url
 * Generate signed Cloudinary upload URL for secure, scalable uploads
 * Body: { resourceType: 'image' | 'video', folder?: string, publicId?: string }
 */
router.post('/signed-url', verifyFirebaseToken, uploadRateLimiter, getSignedUploadUrl);

/**
 * POST /api/media/validate-size
 * Validate file size before upload
 * Body: { size: number, resourceType: 'image' | 'video' }
 */
router.post('/validate-size', verifyFirebaseToken, validateFileSize);

/**
 * POST /api/media/playback-url
 * Get streamable playback URL with Cloudinary transformations
 * Body: { publicId: string, resourceType: 'image' | 'video', transformations?: object }
 */
router.post('/playback-url', verifyFirebaseToken, getPlaybackUrl);

/**
 * POST /api/media/delete
 * Delete media from Cloudinary. Requires Firebase ID token + admin role or ownership.
 * Body: { publicId: string, resourceType?: 'image' | 'video', mediaId?: string }
 */
router.post('/delete', verifyFirebaseToken, deleteMedia);

export default router;
