const { randomUUID } = require('crypto');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION;

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function ensureS3Config() {
  if (!bucket || !region || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('S3 is not configured. Set AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }
}

async function uploadDriverDocument(file, driverId, docType) {
  ensureS3Config();

  const extension = file.originalname.includes('.')
    ? file.originalname.substring(file.originalname.lastIndexOf('.'))
    : '';
  const key = `drivers/${driverId}/${docType}-${randomUUID()}${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

module.exports = {
  uploadDriverDocument,
};
