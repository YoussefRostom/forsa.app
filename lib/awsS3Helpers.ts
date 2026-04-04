// Note: crypto polyfill is imported in App.tsx before this file is loaded
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray } from 'base64-js';

// Helper to convert base64 to Uint8Array (React Native compatible)
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  
  // Use base64-js library for reliable conversion
  return toByteArray(base64Data);
}

// Get environment variables with validation
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const AWS_BUCKET = process.env.AWS_BUCKET;
const AWS_BASE_URL = process.env.AWS_BASE_URL;

// Validate required environment variables
function validateAWSConfig() {
  if (!AWS_ACCESS_KEY_ID) {
    throw new Error('AWS_ACCESS_KEY_ID is not set in environment variables');
  }
  if (!AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS_SECRET_ACCESS_KEY is not set in environment variables');
  }
  if (!AWS_BUCKET) {
    throw new Error('AWS_BUCKET is not set in environment variables');
  }
  if (!AWS_BASE_URL) {
    throw new Error('AWS_BASE_URL is not set in environment variables');
  }
}

// Initialize S3 Client with proper types
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    validateAWSConfig();
    
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are required');
    }

    s3Client = new S3Client({
      region: AWS_DEFAULT_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
      forcePathStyle: false,
    });
  }
  
  return s3Client;
}

/**
 * Upload an image file to AWS S3
 * @param uri - Local file URI
 * @param path - S3 path (e.g., 'users/userId/profile.jpg')
 * @returns Public URL of the uploaded file
 */
export async function uploadImageToS3(uri: string, path: string): Promise<string> {
  try {
    // Validate AWS config before proceeding
    validateAWSConfig();
    
    if (!AWS_BUCKET || !AWS_BASE_URL) {
      throw new Error('AWS configuration is incomplete');
    }

    // Read the file as base64 using legacy API
    // The legacy API supports EncodingType.Base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Uint8Array
    const bytes = base64ToUint8Array(base64);

    // Get file extension from path or URI
    const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = `image/${fileExtension === 'png' ? 'png' : fileExtension === 'gif' ? 'gif' : 'jpeg'}`;

    // Ensure path doesn't start with /
    const s3Key = path.startsWith('/') ? path.substring(1) : path;

    // Get S3 client instance
    const client = getS3Client();

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: AWS_BUCKET,
      Key: s3Key,
      Body: bytes,
      ContentType: contentType,
      ACL: 'public-read', // Make the file publicly accessible
    });

    await client.send(command);

    // Return the public URL
    const publicUrl = `${AWS_BASE_URL}${s3Key}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw error;
  }
}

/**
 * Upload multiple images to AWS S3
 * @param uris - Array of local file URIs
 * @param basePath - Base S3 path (e.g., 'users/userId/')
 * @returns Array of public URLs
 */
export async function uploadMultipleImagesToS3(
  uris: string[],
  basePath: string
): Promise<string[]> {
  const uploadPromises = uris.map((uri, index) => {
    const fileName = `image_${index}_${Date.now()}.jpg`;
    const path = basePath.endsWith('/') ? `${basePath}${fileName}` : `${basePath}/${fileName}`;
    return uploadImageToS3(uri, path);
  });

  return Promise.all(uploadPromises);
}

