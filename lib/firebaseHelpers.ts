import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import * as FileSystem from 'expo-file-system';

/**
 * Upload an image file to Firebase Storage
 * @param uri - Local file URI
 * @param path - Storage path (e.g., 'users/userId/profile.jpg')
 * @returns Download URL
 */
export async function uploadImageToStorage(uri: string, path: string): Promise<string> {
  try {
    // Read the file as a blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Create a reference to the file location
    const storageRef = ref(storage, path);
    
    // Upload the file
    await uploadBytes(storageRef, blob);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Upload multiple images to Firebase Storage
 * @param uris - Array of local file URIs
 * @param basePath - Base storage path (e.g., 'users/userId/')
 * @returns Array of download URLs
 */
export async function uploadMultipleImagesToStorage(
  uris: string[],
  basePath: string
): Promise<string[]> {
  const uploadPromises = uris.map((uri, index) => {
    const fileName = `image_${index}_${Date.now()}.jpg`;
    return uploadImageToStorage(uri, `${basePath}${fileName}`);
  });
  
  return Promise.all(uploadPromises);
}

