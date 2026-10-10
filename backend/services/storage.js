const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = process.env.S3_BUCKET;                       // unset on your laptop
const LOCAL_DIR = path.join(__dirname, '..', 'uploads');    // laptop fallback
const s3 = BUCKET ? new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' }) : null;

function makeKey(userId, originalName) {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  return `receipts/${userId}/${crypto.randomUUID()}-${safe}`;   // MUST start with receipts/
}

async function saveReceipt(userId, file) {   // file = multer memory file
  const key = makeKey(userId, file.originalname);
  if (!BUCKET) {
    const full = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer);
    return key;
  }
  await new Upload({
    client: s3,
    params: { Bucket: BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }
  }).done();
  return key;
}

// Returns a URL valid for 5 minutes (relative dev URL on your laptop)
async function getReceiptUrl(key) {
  if (!BUCKET) return `/api/dev-uploads/${key}`;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 300 });
}

async function deleteReceipt(key) {
  if (!BUCKET) {
    await fs.unlink(path.join(LOCAL_DIR, key)).catch(() => {});
    return;
  }
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { saveReceipt, getReceiptUrl, deleteReceipt };
