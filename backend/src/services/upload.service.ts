import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(__dirname, '..', '..', 'uploads');

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// sanitize and generate unique filenames
function genFilename(original: string) {
  const ext = path.extname(original);
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9-_\.]/g, '_').slice(0, 64);
  const random = crypto.randomBytes(6).toString('hex');
  return `${Date.now()}-${random}-${base}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => cb(null, genFilename(file.originalname))
});

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

export const multerUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  }
});

type AttachmentInfo = { url: string; filename: string; mimeType: string; size: number };

export function filesToAttachmentInfos(files: Express.Multer.File[], port = process.env.PORT || '4000') {
  return files.map((f) => ({
    url: `${process.env.API_BASE_URL || `http://localhost:${port}`}/uploads/${encodeURIComponent(f.filename)}`,
    filename: f.originalname,
    mimeType: f.mimetype,
    size: f.size
  }));
}

export function fileInfoFromSaved(filename: string, originalname: string, mimetype: string, size: number, port = process.env.PORT || '4000') : AttachmentInfo {
  // If S3 configured, return S3 URL
  if (process.env.S3_BUCKET && process.env.S3_REGION) {
    const key = filename;
    const url = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${encodeURIComponent(key)}`;
    return { url, filename: originalname, mimeType: mimetype, size };
  }
  return {
    url: `${process.env.API_BASE_URL || `http://localhost:${port}`}/uploads/${encodeURIComponent(filename)}`,
    filename: originalname,
    mimeType: mimetype,
    size
  };
}

// S3 presign helper (PUT URL)
const s3Client = (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_REGION) ? new S3Client({ region: process.env.S3_REGION }) : null;

export async function getPresignedPutUrl(key: string, contentType: string, expiresSeconds = 900) {
  if (!s3Client || !process.env.S3_BUCKET) throw new Error('S3 not configured');
  const cmd = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType, ACL: 'private' });
  const url = await getSignedUrl(s3Client, cmd, { expiresIn: expiresSeconds });
  return url;
}

// server-side upload fallback - accept buffer and stream to S3
export async function uploadBufferToS3(buffer: Buffer, key: string, contentType: string) {
  if (!s3Client || !process.env.S3_BUCKET) throw new Error('S3 not configured');
  const cmd = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: buffer, ContentType: contentType, ACL: 'private' });
  await s3Client.send(cmd);
  return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${encodeURIComponent(key)}`;
}
