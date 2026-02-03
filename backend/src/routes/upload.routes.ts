import express from 'express';
import fs from 'fs';
import { multerUpload, filesToAttachmentInfos, getPresignedPutUrl, fileInfoFromSaved, uploadBufferToS3 } from '../services/upload.service';
import { requireAuth } from '../middleware/auth.middleware';

const router = express.Router();

// presign URL for direct S3 PUT uploads
router.post('/upload-presign', requireAuth, async (req, res) => {
  try {
    const { filename, contentType } = req.body as { filename?: string; contentType?: string };
    if (!filename || !contentType) return res.status(400).json({ error: 'filename and contentType required' });
    // sanitize and generate key
    const key = `${Date.now()}-${encodeURIComponent(filename)}`;
    const url = await getPresignedPutUrl(key, contentType);
    const publicUrl = process.env.S3_BUCKET && process.env.S3_REGION ? `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${encodeURIComponent(key)}` : undefined;
    res.json({ url, key, publicUrl, expiresIn: 900 });
  } catch (err:any) {
    res.status(500).json({ error: err?.message || 'Failed to presign' });
  }
});

// single or multiple file upload (legacy - stores locally or streams to S3 if configured)
router.post('/upload', requireAuth, multerUpload.array('files'), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || !files.length) return res.status(400).json({ error: 'No files uploaded' });
  console.log('uploaded files:', files.map((f)=>({ original: f.originalname, stored: f.filename, size: f.size })));

  // if S3 configured, stream files to S3 and return public URL
  if (process.env.S3_BUCKET) {
    const infos = [] as any[];
    for (const f of files) {
      const key = f.filename;
      const url = await uploadBufferToS3(fs.readFileSync(f.path), key, f.mimetype);
      // remove local file after upload
      try { fs.unlinkSync(f.path); } catch(e){}
      infos.push({ url, filename: f.originalname, mimeType: f.mimetype, size: f.size });
    }
    return res.json(infos);
  }

  const infos = filesToAttachmentInfos(files);
  res.json(infos);
});

export default router;
