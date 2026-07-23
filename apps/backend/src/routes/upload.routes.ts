import { Router } from 'express';
import multer from 'multer';
import { storageService } from '../infrastructure/storage/storage.service';
import { restaurantSessionMiddleware } from '../middlewares/auth/restaurant-session.middleware';
import { asyncHandler } from '../shared/utils/async-handler';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/upload', restaurantSessionMiddleware, upload.single('file'), asyncHandler(async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const restaurantId = req.restaurantId;
  const originalName = req.file.originalname;
  const ext = originalName.substring(originalName.lastIndexOf('.'));
  const timestamp = Date.now();
  // Safe filename
  const filename = `uploads/${restaurantId}/${timestamp}${ext}`;

  // Upload to payments bucket (using as general storage bucket)
  const uploadedPath = await storageService.upload('payments', filename, req.file.buffer, req.file.mimetype);
  
  // Get signed URL
  const publicUrl = await storageService.generateSignedUrl('payments', filename, 315360000); // 10 years expiration

  res.status(200).json({
    success: true,
    data: {
      url: publicUrl,
      path: uploadedPath,
    }
  });
}));

export default router;
