import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_REGION || 'us-east-2';
const BUCKET = process.env.AWS_S3_BUCKET as string;

if (!BUCKET) {
  // Don't throw at import time in case we only run locally without S3
  // but warn so developers know.
  console.warn('[storage:s3] AWS_S3_BUCKET not set; S3 uploads will fail.');
}

const s3 = new S3Client({ region: REGION });

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  if (!BUCKET) throw new Error('AWS_S3_BUCKET is required to upload to S3');
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    })
  );
  const url = publicUrl(key);
  return { key, url };
}

export function publicUrl(key: string): string {
  // Works for public buckets; for private, switch to signed URLs.
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encodeURI(key)}`;
}
