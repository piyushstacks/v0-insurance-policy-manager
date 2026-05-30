import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Ensure the S3 client is only initialized if environment variables exist
export const b2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.B2_ENDPOINT || '',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || '',
  },
});

export const b2Bucket = process.env.B2_BUCKET_NAME || '';
export const b2PublicUrl = process.env.NEXT_PUBLIC_B2_PUBLIC_URL || '';

/**
 * Uploads a file to Backblaze B2
 * @param fileName - The unique path/name of the file
 * @param fileBuffer - The Buffer or array buffer containing the file data
 * @param contentType - The MIME type of the file
 */
export async function uploadToB2(fileName: string, fileBuffer: Buffer | Uint8Array, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: b2Bucket,
    Key: fileName,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await b2Client.send(command);
  
  // Return the public URL for the file
  return getB2PublicUrl(fileName);
}

/**
 * Deletes a file from Backblaze B2
 * @param fileName - The path/name of the file to delete
 */
export async function deleteFromB2(fileName: string) {
  const command = new DeleteObjectCommand({
    Bucket: b2Bucket,
    Key: fileName,
  });

  await b2Client.send(command);
}

/**
 * Gets the public URL for a B2 object
 * @param fileName - The path/name of the file
 */
export function getB2PublicUrl(fileName: string) {
  if (b2PublicUrl) {
    // Remove trailing slash if present, then append file name
    const baseUrl = b2PublicUrl.endsWith('/') ? b2PublicUrl.slice(0, -1) : b2PublicUrl;
    return `${baseUrl}/${fileName}`;
  }
  
  // Fallback to generic f00x B2 url format. 
  // e.g. https://f000.backblazeb2.com/file/bucketname/filename
  // It is strongly recommended to use B2_PUBLIC_URL which can point to a Cloudflare proxied custom domain.
  return `https://f000.backblazeb2.com/file/${b2Bucket}/${fileName}`;
}
