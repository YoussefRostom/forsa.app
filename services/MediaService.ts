import Constants from 'expo-constants';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, query, where, orderBy, onSnapshot, Unsubscribe, getDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { getBackendUrlCandidates, rememberWorkingBackendUrl } from '../lib/config';
import { getCurrentUserRole, getVisibleToRoles, type Role } from './UserRoleService';

// Helper function to get environment variables with multiple fallbacks
function getEnvVar(key: string, fallbackKey?: string): string | undefined {
  // Try process.env first (works in Expo with EXPO_PUBLIC_ prefix)
  let value = process.env[key];
  if (value && value.trim()) return value.trim();
  
  // Try fallback key if provided
  if (fallbackKey) {
    value = process.env[fallbackKey];
    if (value && value.trim()) return value.trim();
  }
  
  // Try non-EXPO_PUBLIC_ version as fallback (for backwards compatibility)
  const nonExpoKey = key.replace('EXPO_PUBLIC_', '');
  value = process.env[nonExpoKey];
  if (value && value.trim()) return value.trim();
  
  // Try Constants.expoConfig.extra (for app.json configuration)
  const extraValue = Constants.expoConfig?.extra?.[key.replace('EXPO_PUBLIC_', '').toLowerCase()] ||
                    Constants.expoConfig?.extra?.[nonExpoKey.toLowerCase()] ||
                    (fallbackKey ? Constants.expoConfig?.extra?.[fallbackKey.replace('EXPO_PUBLIC_', '').toLowerCase()] : undefined);
  if (extraValue) return String(extraValue).trim();
  
  // Try Constants.manifest.extra (legacy - with type guard)
  const manifest = Constants.manifest as any;
  if (manifest?.extra) {
    const manifestValue = manifest.extra[key.replace('EXPO_PUBLIC_', '').toLowerCase()] ||
                          manifest.extra[nonExpoKey.toLowerCase()] ||
                          (fallbackKey ? manifest.extra[fallbackKey.replace('EXPO_PUBLIC_', '').toLowerCase()] : undefined);
    if (manifestValue) return String(manifestValue).trim();
  }
  
  return undefined;
}

// Types
export type ResourceType = 'image' | 'video';
export type Visibility = 'public' | 'private' | 'unlisted';

export interface CloudinaryResponse {
  public_id: string;
  asset_id?: string;
  secure_url: string;
  format?: string;
  bytes?: number;
  duration?: number;
  width?: number;
  height?: number;
  resource_type: string;
  [key: string]: any;
}

export interface MediaDoc {
  id: string;
  ownerId: string;
  resourceType: ResourceType;
  visibility: Visibility;
  cloudinaryPublicId: string;
  cloudinaryAssetId: string | null;
  secureUrl: string;
  playbackUrl: string;
  format: string | null;
  sizeBytes: number | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  createdAt: any;
  updatedAt: any;
  status: 'ready' | 'failed';
  error: string | null;
}

export interface TaggedUserMeta {
  id: string;
  name: string;
  role?: string;
}

interface SignedUploadConfig {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: ResourceType;
}

const CLOUDINARY_CHUNKED_VIDEO_THRESHOLD_BYTES = 20 * 1024 * 1024;
const CLOUDINARY_VIDEO_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function summarizeUnexpectedUploadResponse(responseText: string, status: number): string {
  const trimmed = responseText.trim();
  const snippet = trimmed.slice(0, 180);

  if (trimmed.startsWith('<')) {
    return `Upload failed: expected JSON but received HTML (HTTP ${status}). This usually means the upload endpoint or Cloudinary credentials are wrong, or the request was intercepted by an error page.`;
  }

  if (!trimmed) {
    return `Upload failed: empty response from upload endpoint (HTTP ${status}).`;
  }

  return `Upload failed: unexpected response from upload endpoint (HTTP ${status}): ${snippet}`;
}

function appendCloudinaryUploadParams(
  formData: FormData,
  signedConfig: SignedUploadConfig | null,
  folder: string,
  uploadPreset?: string
): void {
  if (signedConfig) {
    formData.append('api_key', signedConfig.apiKey);
    formData.append('timestamp', String(signedConfig.timestamp));
    formData.append('signature', signedConfig.signature);
    formData.append('folder', signedConfig.folder);
    return;
  }

  formData.append('upload_preset', String(uploadPreset || '').trim());
  formData.append('folder', folder);
}

async function performCloudinaryUploadRequest(
  endpoint: string,
  formData: FormData,
  timeoutMs: number,
  uploadMode: 'signed' | 'unsigned',
  onProgress?: (progress: number) => void,
  headers?: Record<string, string>
): Promise<CloudinaryResponse & { error?: { message?: string }; done?: boolean }> {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeoutId = setTimeout(() => {
      try {
        xhr.abort();
      } catch {
        // no-op
      }
    }, timeoutMs);

    xhr.open('POST', endpoint);
    xhr.responseType = 'text';
    xhr.setRequestHeader('Accept', 'application/json');

    Object.entries(headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      clearTimeout(timeoutId);

      try {
        const responseText = typeof xhr.response === 'string' ? xhr.response : xhr.responseText;
        const parsed = parseJsonSafely<CloudinaryResponse & { error?: { message?: string }; done?: boolean }>(responseText || '');

        if (xhr.status < 200 || xhr.status >= 300) {
          let errorMessage = parsed?.error?.message
            ? `Cloudinary upload failed: ${parsed.error.message}`
            : summarizeUnexpectedUploadResponse(responseText || '', xhr.status);

          if (xhr.status === 401) {
            errorMessage += '\n\nThis usually means:\n' +
              '1. Your upload preset name is incorrect, OR\n' +
              '2. Your upload preset is not set to "Unsigned" mode, OR\n' +
              '3. Your cloud name is incorrect\n\n' +
              'Please verify your Cloudinary credentials in the .env file and ensure:\n' +
              '- The upload preset exists and is set to "Unsigned"\n' +
              '- The cloud name matches your Cloudinary account\n' +
              '- You have restarted the Expo server after updating .env';
          }

          if (uploadMode === 'signed' && xhr.status === 403) {
            errorMessage += '\n\nThe backend signed the upload request, but Cloudinary rejected it. Check backend Cloudinary env vars and server clock skew.';
          }

          reject(new Error(errorMessage));
          return;
        }

        if (!parsed) {
          reject(new Error(summarizeUnexpectedUploadResponse(responseText || '', xhr.status)));
          return;
        }

        if (parsed?.error) {
          reject(new Error(`Cloudinary error: ${parsed.error.message || 'Unknown error'}`));
          return;
        }

        resolve(parsed);
      } catch (parseError: any) {
        reject(new Error(parseError?.message || 'Failed to parse upload response'));
      }
    };

    xhr.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('Failed to upload media to Cloudinary. Please check your connection and try again.'));
    };

    xhr.onabort = () => {
      clearTimeout(timeoutId);
      reject(new Error('Upload timed out. Please try a smaller file or a stronger connection.'));
    };

    onProgress?.(1);
    xhr.send(formData);
  });
}

async function uploadLargeVideoInChunks(params: {
  localUri: string;
  endpoint: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  folder: string;
  uploadMode: 'signed' | 'unsigned';
  signedConfig: SignedUploadConfig | null;
  uploadPreset?: string;
  onProgress?: (progress: number) => void;
}): Promise<CloudinaryResponse> {
  const FileSystem = await import('expo-file-system/legacy');
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const cacheDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  let start = 0;
  let finalResponse: (CloudinaryResponse & { done?: boolean }) | null = null;

  while (start < params.fileSize) {
    const chunkLength = Math.min(CLOUDINARY_VIDEO_CHUNK_SIZE_BYTES, params.fileSize - start);
    const endExclusive = start + chunkLength;
    const base64Chunk = await FileSystem.readAsStringAsync(params.localUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: start,
      length: chunkLength,
    });

    const chunkUri = `${cacheDirectory}cloudinary-video-chunk-${uploadId}-${start}.part`;

    try {
      await FileSystem.writeAsStringAsync(chunkUri, base64Chunk, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const formData = new FormData();
      formData.append('file', {
        uri: chunkUri,
        type: params.mimeType,
        name: `${params.filename}.part`,
      } as any);
      appendCloudinaryUploadParams(formData, params.signedConfig, params.folder, params.uploadPreset);

      finalResponse = await performCloudinaryUploadRequest(
        params.endpoint,
        formData,
        180000,
        params.uploadMode,
        params.onProgress
          ? (chunkProgress) => {
              const uploadedBytes = start + Math.round((chunkProgress / 100) * chunkLength);
              const overallProgress = Math.min(100, Math.max(0, Math.round((uploadedBytes / params.fileSize) * 100)));
              params.onProgress?.(overallProgress);
            }
          : undefined,
        {
          'X-Unique-Upload-Id': uploadId,
          'Content-Range': `bytes ${start}-${endExclusive - 1}/${params.fileSize}`,
        }
      );
    } finally {
      try {
        await FileSystem.deleteAsync(chunkUri, { idempotent: true });
      } catch {
        // Ignore temp chunk cleanup failures.
      }
    }

    start = endExclusive;
    params.onProgress?.(Math.min(100, Math.round((start / params.fileSize) * 100)));
  }

  if (!finalResponse?.secure_url) {
    throw new Error('Chunked upload completed without a final Cloudinary asset response.');
  }

  return finalResponse;
}

async function requestSignedUploadConfig(
  resourceType: ResourceType,
  folder: string
): Promise<SignedUploadConfig | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  const idToken = await user.getIdToken();
  const candidates = getBackendUrlCandidates();

  for (const backendUrl of candidates) {
    try {
      const response = await fetch(`${backendUrl}/api/media/signed-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          resourceType,
          folder,
        }),
      });

      const responseText = await response.text();
      const payload = parseJsonSafely<any>(responseText);

      if (!response.ok) {
        continue;
      }

      const data = payload?.data;
      if (
        data
        && typeof data.uploadUrl === 'string'
        && typeof data.apiKey === 'string'
        && typeof data.signature === 'string'
        && typeof data.timestamp === 'number'
      ) {
        rememberWorkingBackendUrl(backendUrl);
        return {
          uploadUrl: data.uploadUrl,
          cloudName: String(data.cloudName || ''),
          apiKey: data.apiKey,
          timestamp: data.timestamp,
          signature: data.signature,
          folder: String(data.folder || folder),
          resourceType,
        };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

/**
 * Upload media file directly to Cloudinary using unsigned upload preset
 * @param localUri - Local file URI from expo-image-picker
 * @param type - 'image' or 'video'
 * @returns Cloudinary response with metadata
 */
export async function uploadMedia(
  localUri: string,
  type: ResourceType,
  onProgress?: (progress: number) => void
): Promise<CloudinaryResponse> {
  const folder = getEnvVar('EXPO_PUBLIC_CLOUDINARY_FOLDER', 'CLOUDINARY_UPLOAD_FOLDER') || 'forsa/media';
  const signedConfig = await requestSignedUploadConfig(type, folder);
  const FileSystem = await import('expo-file-system/legacy');
  const fileInfo = await FileSystem.getInfoAsync(localUri);
  const fileSize = fileInfo.exists && 'size' in fileInfo && typeof fileInfo.size === 'number'
    ? fileInfo.size
    : null;

  let endpoint = signedConfig?.uploadUrl || '';
  let uploadMode: 'signed' | 'unsigned' = 'signed';
  let fallbackUploadPreset: string | undefined;

  if (!signedConfig) {
    const cloudName = getEnvVar('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_CLOUD_NAME');
    const uploadPreset = getEnvVar('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET');

    if (!cloudName || !cloudName.trim() || !uploadPreset || !uploadPreset.trim()) {
      console.error('Cloudinary credentials not found or empty. Checked:', {
        'process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME': process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
        'process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET': process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
        'getEnvVar result - cloudName': cloudName,
        'getEnvVar result - uploadPreset': uploadPreset,
        'Constants.expoConfig?.extra': Constants.expoConfig?.extra,
      });

      throw new Error(
        'Media upload is not configured correctly. The app could not get a signed upload config from the backend, and unsigned Cloudinary credentials are missing.\n\n' +
        'Fix one of these paths:\n' +
        '1. Start/configure the backend media route with Cloudinary server credentials, or\n' +
        '2. Add valid EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET values to the app config.\n\n' +
        'Then restart Expo with: npm start -- --clear'
      );
    }

    const trimmedCloudName = cloudName.trim();
    const trimmedUploadPreset = uploadPreset.trim();
    fallbackUploadPreset = trimmedUploadPreset;

    if (
      trimmedCloudName.includes('your_cloud_name') ||
      trimmedCloudName.includes('your_actual') ||
      trimmedCloudName.includes('placeholder') ||
      trimmedUploadPreset.includes('your_upload_preset') ||
      trimmedUploadPreset.includes('your_actual') ||
      trimmedUploadPreset.includes('placeholder')
    ) {
      throw new Error(
        'Cloudinary credentials are still using placeholder values.\n\n' +
        'Please replace the placeholder values in your .env file with your actual Cloudinary credentials:\n' +
        `Current cloudName: "${trimmedCloudName}"\n` +
        `Current uploadPreset: "${trimmedUploadPreset}"\n\n` +
        'Steps to fix:\n' +
        '1. Get your Cloudinary cloud name from https://console.cloudinary.com/\n' +
        '2. Create an unsigned upload preset in Cloudinary Settings > Upload\n' +
        '3. Update your .env file with the real values\n' +
        '4. Restart Expo server with: npm start -- --clear'
      );
    }

    endpoint = type === 'video'
      ? `https://api.cloudinary.com/v1_1/${trimmedCloudName}/video/upload`
      : `https://api.cloudinary.com/v1_1/${trimmedCloudName}/image/upload`;
    uploadMode = 'unsigned';
  }

  // Create FormData
  const formData = new FormData();
  
  // Get file name from URI
  const filename = localUri.split('/').pop() || `media.${type === 'video' ? 'mp4' : 'jpg'}`;
  const match = /\.(\w+)$/.exec(filename);
  const extension = match?.[1]?.toLowerCase();
  const mimeType = extension
    ? `${type}/${extension === 'jpg' ? 'jpeg' : extension}`
    : (type === 'video' ? 'video/mp4' : 'image/jpeg');

  // Append file - React Native FormData expects { uri, type, name }
  formData.append('file', {
    uri: localUri,
    type: mimeType,
    name: filename,
  } as any);

  appendCloudinaryUploadParams(formData, signedConfig, folder, fallbackUploadPreset);

  try {
    const shouldUseChunkedUpload = type === 'video'
      && typeof fileSize === 'number'
      && fileSize >= CLOUDINARY_CHUNKED_VIDEO_THRESHOLD_BYTES;

    const data = shouldUseChunkedUpload
      ? await uploadLargeVideoInChunks({
          localUri,
          endpoint,
          filename,
          mimeType,
          fileSize: fileSize as number,
          folder,
          uploadMode,
          signedConfig,
          uploadPreset: fallbackUploadPreset,
          onProgress,
        })
      : await performCloudinaryUploadRequest(
          endpoint,
          formData,
          type === 'video' ? 600000 : 90000,
          uploadMode,
          onProgress
        );

    onProgress?.(100);

    return data;
  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error(
      error.message || 'Failed to upload media to Cloudinary. Please check your connection and try again.'
    );
  }
}

/**
 * Save media metadata to Firestore /media collection
 * @param cloudinaryResponse - Response from Cloudinary upload
 * @param type - 'image' or 'video'
 * @param visibility - Visibility setting (default: 'public')
 * @returns Media document ID
 */
export async function saveMediaToFirestore(
  cloudinaryResponse: CloudinaryResponse,
  type: ResourceType,
  visibility: Visibility = 'public'
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to save media');
  }

  const mediaData: Omit<MediaDoc, 'id'> = {
    ownerId: user.uid,
    resourceType: type,
    visibility,
    cloudinaryPublicId: cloudinaryResponse.public_id,
    cloudinaryAssetId: cloudinaryResponse.asset_id || null,
    secureUrl: cloudinaryResponse.secure_url,
    playbackUrl: cloudinaryResponse.secure_url, // Will be updated with streamable URL if needed
    format: cloudinaryResponse.format || null,
    sizeBytes: cloudinaryResponse.bytes || null,
    durationSec: type === 'video' && cloudinaryResponse.duration ? cloudinaryResponse.duration : null,
    width: cloudinaryResponse.width || null,
    height: cloudinaryResponse.height || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'ready',
    error: null,
  };

  try {
    const docRef = await addDoc(collection(db, 'media'), mediaData);
    return docRef.id;
  } catch (error: any) {
    console.error('Error saving media to Firestore:', error);
    throw new Error(`Failed to save media metadata: ${error.message}`);
  }
}

/**
 * Helper function to get author name based on user role
 */
async function getAuthorName(ownerId: string, ownerRole: Role): Promise<string> {
  try {
    const userDoc = await getDoc(doc(db, 'users', ownerId));
    if (userDoc.exists()) {
      const d = userDoc.data();
      if (ownerRole === 'admin') {
        return d?.name || d?.adminName || 'Admin';
      }
      return d?.academyName || d?.agentName || d?.clinicName || d?.parentName || d?.name ||
        (d?.firstName && d?.lastName ? `${d.firstName} ${d.lastName}`.trim() : 'User');
    }
  } catch {
    // use default
  }
  return ownerRole === 'admin' ? 'Admin' : 'User';
}

/**
 * Create a feed item in /posts collection if feed uses posts
 * This links the media to the existing feed structure
 * @param mediaDoc - The media document data
 * @param content - Optional text/caption for the post (default: empty string)
 * @returns Post document ID if created, null otherwise
 */
export async function createFeedItemIfNeeded(
  mediaDoc: MediaDoc,
  content: string = '',
  taggedUsers: TaggedUserMeta[] = []
): Promise<string | null> {
  // Since feed reads from /posts, we'll create a post entry
  // that references the media
  try {
    // Check if user is suspended
    const { isUserSuspended } = await import('./ModerationService');
    const suspended = await isUserSuspended();
    if (suspended) {
      throw new Error('Your account has been suspended. You cannot create new posts.');
    }

    // Get the current user's role
    const ownerRole = await getCurrentUserRole();
    const visibleToRoles = getVisibleToRoles(ownerRole);

    const sanitizedTaggedUsers = taggedUsers
      .map((entry) => ({
        id: String(entry?.id || '').trim(),
        name: String(entry?.name || '').trim(),
        role: entry?.role ? String(entry.role).trim() : undefined,
      }))
      .filter((entry) => entry.id && entry.name)
      .slice(0, 5);

    const postData = {
      mediaId: mediaDoc.id,
      mediaUrl: mediaDoc.secureUrl,
      mediaType: mediaDoc.resourceType,
      ownerId: mediaDoc.ownerId,
      ownerRole: ownerRole,
      visibleToRoles: visibleToRoles,
      visibilityScope: 'role_based',
      status: 'active',
      visibility: mediaDoc.visibility || 'public',
      author: await getAuthorName(mediaDoc.ownerId, ownerRole), // Fetch user name based on role
      content: content || '', // Caption/text content for the post
      contentText: content || '',
      taggedUsers: sanitizedTaggedUsers,
      taggedUserIds: sanitizedTaggedUsers.map((entry) => entry.id),
      taggedUserNames: sanitizedTaggedUsers.map((entry) => entry.name),
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    const postRef = await addDoc(collection(db, 'posts'), postData);
    return postRef.id;
  } catch (error: any) {
    console.error('Error creating feed item:', error);
    // Re-throw suspension errors
    if (error.message && error.message.includes('suspended')) {
      throw error;
    }
    // Don't throw other errors - feed might work without this
    return null;
  }
}

/**
 * Subscribe to user's media uploads
 * @param uid - User ID
 * @param callback - Callback function that receives media documents array
 * @returns Unsubscribe function
 */
export function subscribeMyMedia(
  uid: string,
  callback: (media: MediaDoc[]) => void
): Unsubscribe {
  const mediaRef = collection(db, 'media');
  const q = query(
    mediaRef,
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const media: MediaDoc[] = [];
      snapshot.forEach((doc) => {
        media.push({
          id: doc.id,
          ...doc.data(),
        } as MediaDoc);
      });
      callback(media);
    },
    (error) => {
      console.error('Error subscribing to media:', error);
      callback([]);
    }
  );
}

/**
 * Complete upload flow: upload to Cloudinary -> save to Firestore -> create feed item
 * @param localUri - Local file URI
 * @param type - 'image' or 'video'
 * @param visibility - Visibility setting (default: 'public')
 * @param content - Optional text/caption for the post (default: empty string)
 * @returns Object with mediaId and postId (if created)
 */
export async function uploadAndSaveMedia(
  localUri: string,
  type: ResourceType,
  visibility: Visibility = 'public',
  content: string = '',
  onProgress?: (progress: number) => void,
  taggedUsers: TaggedUserMeta[] = []
): Promise<{ mediaId: string; postId: string | null }> {
  try {
    const normalizedContent = String(content || '').trim().slice(0, 500);

    // Step 0: Validate file size before upload
    await validateFileSizeBeforeUpload(localUri, type);
    
    // Step 1: Upload to Cloudinary
    const cloudinaryResponse = await uploadMedia(localUri, type, onProgress);

    // Step 2: Save to Firestore
    const mediaId = await saveMediaToFirestore(cloudinaryResponse, type, visibility);

    // Step 3: Get the media doc to create feed item
    // We'll construct the media doc from what we saved
    const mediaDoc: MediaDoc = {
      id: mediaId,
      ownerId: auth.currentUser!.uid,
      resourceType: type,
      visibility,
      cloudinaryPublicId: cloudinaryResponse.public_id,
      cloudinaryAssetId: cloudinaryResponse.asset_id || null,
      secureUrl: cloudinaryResponse.secure_url,
      playbackUrl: cloudinaryResponse.secure_url, // Can be enhanced with getStreamablePlaybackUrl if needed
      format: cloudinaryResponse.format || null,
      sizeBytes: cloudinaryResponse.bytes || null,
      durationSec: type === 'video' && cloudinaryResponse.duration ? cloudinaryResponse.duration : null,
      width: cloudinaryResponse.width || null,
      height: cloudinaryResponse.height || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'ready',
      error: null,
    };

    // Step 4: Create feed item if needed (pass content/caption + tagged users)
    const postId = await createFeedItemIfNeeded(mediaDoc, normalizedContent, taggedUsers);

    return { mediaId, postId };
  } catch (error: any) {
    console.error('Complete upload flow error:', error);
    throw error;
  }
}

/**
 * Cleanup media from Cloudinary when a post is removed (e.g. by moderation).
 * Called from ModerationService.removePost. If mediaId is missing or cleanup
 * is not configured, this no-ops so the rest of the flow is not broken.
 */
export async function cleanupMediaForPost(mediaId: string | undefined): Promise<void> {
  if (!mediaId) return;
  
  try {
    // Fetch media document
    const mediaRef = doc(db, 'media', mediaId);
    const mediaSnap = await getDoc(mediaRef);
    
    if (!mediaSnap.exists()) {
      console.warn(`[MediaService] Media ${mediaId} not found for cleanup`);
      return;
    }
    
    const mediaData = mediaSnap.data() as MediaDoc;
    const publicId = mediaData.cloudinaryPublicId;
    const resourceType = mediaData.resourceType;
    
    if (!publicId) {
      console.warn(`[MediaService] No cloudinaryPublicId found for media ${mediaId}`);
      // Still delete from Firestore
      await deleteDoc(mediaRef);
      return;
    }
    
    // Try to call backend API to delete from Cloudinary (optional - graceful failure)
    // If backend is not available, we still clean up Firestore
    const user = auth.currentUser;
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;
    
    // Only attempt API call if backend URL is configured and user is authenticated
    if (user && apiBaseUrl && apiBaseUrl !== 'http://localhost:3000') {
      try {
        const idToken = await user.getIdToken();
        
        // Use a timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${apiBaseUrl}/api/media/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            publicId,
            resourceType,
            mediaId,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Log but don't throw - continue with Firestore cleanup
          console.warn(`[MediaService] Backend cleanup returned ${response.status}, continuing with Firestore cleanup`);
        }
      } catch (apiError: any) {
        // Silently handle network errors - backend may not be available
        // This is expected in development or when backend is not deployed
        if (apiError.name !== 'AbortError') {
          // Only log non-timeout errors at debug level
          console.debug('[MediaService] Backend cleanup unavailable, using Firestore-only cleanup');
        }
        // Continue to delete from Firestore regardless
      }
    } else {
      // Backend not configured or not available - use Firestore-only cleanup
      console.debug('[MediaService] Backend not configured, using Firestore-only cleanup');
    }
    
    // Delete from Firestore
    await deleteDoc(mediaRef);
  } catch (error: any) {
    console.error(`[MediaService] Error cleaning up media ${mediaId}:`, error);
    // Don't throw - cleanup failures shouldn't break the moderation flow
  }
}

/**
 * Get streamable playback URL with Cloudinary transformations
 * @param publicId - Cloudinary public ID
 * @param resourceType - 'image' or 'video'
 * @param transformations - Optional Cloudinary transformation parameters
 * @returns Streamable playback URL
 */
export async function getStreamablePlaybackUrl(
  publicId: string,
  resourceType: ResourceType,
  transformations?: Record<string, any>
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to get playback URL');
  }
  
  try {
    const idToken = await user.getIdToken();
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    
    const response = await fetch(`${apiBaseUrl}/api/media/playback-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        publicId,
        resourceType,
        transformations,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to get playback URL');
    }
    
    const data = await response.json();
    return data.data.playbackUrl;
  } catch (error: any) {
    console.error('Error getting playback URL:', error);
    // Fallback to secure URL if API fails
    const cloudName = getEnvVar('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_CLOUD_NAME');
    if (cloudName && publicId) {
      return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicId}`;
    }
    throw error;
  }
}

/**
 * Validate file size before upload
 * @param fileUri - Local file URI
 * @param resourceType - 'image' or 'video'
 * @returns true if valid, throws error if invalid
 */
export async function validateFileSizeBeforeUpload(
  fileUri: string,
  resourceType: ResourceType
): Promise<boolean> {
  try {
    // Get file info using FileSystem
    const FileSystem = await import('expo-file-system/legacy');
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    
    if (!fileInfo.exists || !('size' in fileInfo)) {
      throw new Error('File not found or size unavailable');
    }
    
    const fileSize = fileInfo.size;
    const maxSize = resourceType === 'video' ? 500 * 1024 * 1024 : 10 * 1024 * 1024; // 500MB or 10MB
    const maxSizeMB = resourceType === 'video' ? 500 : 10;
    
    if (fileSize > maxSize) {
      throw new Error(
        `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${maxSizeMB}MB`
      );
    }
    
    return true;
  } catch (error: any) {
    if (error.message.includes('exceeds maximum')) {
      throw error;
    }
    // If validation fails for other reasons, log but allow upload to proceed
    // (backend will also validate)
    console.warn('[MediaService] File size validation warning:', error.message);
    return true;
  }
}

/**
 * Update media caption/content for admin's uploaded media
 * Updates the associated post's content field
 * @param mediaId - Media document ID
 * @param postId - Post document ID (optional, will be looked up if not provided)
 * @param newContent - New caption/content text
 */
export async function updateMediaCaption(
  mediaId: string,
  postId: string | null,
  newContent: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to update media');
  }

  try {
    let targetPostId = postId;

    // If postId not provided, find the associated post
    if (!targetPostId) {
      const postsRef = collection(db, 'posts');
      const postQuery = query(
        postsRef,
        where('mediaId', '==', mediaId),
        where('ownerId', '==', user.uid)
      );
      const postSnap = await getDocs(postQuery);
      const postDoc = postSnap.docs[0];
      
      if (!postDoc) {
        throw new Error('Associated post not found');
      }
      
      targetPostId = postDoc.id;
    }

    // Verify ownership and update the post caption fields consistently
    const postRef = doc(db, 'posts', targetPostId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error('Associated post not found');
    }

    const postData = postSnap.data();
    if (postData.ownerId !== user.uid) {
      throw new Error('You can only update your own caption');
    }

    await updateDoc(postRef, {
      content: newContent,
      contentText: newContent,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating media caption:', error);
    throw new Error(`Failed to update caption: ${error.message}`);
  }
}

/**
 * Delete admin's uploaded media and associated post
 * @param mediaId - Media document ID
 * @param postId - Post document ID (optional, will be looked up if not provided)
 */
export async function deleteAdminMedia(
  mediaId: string,
  postId: string | null
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to delete media');
  }

  try {
    // Verify ownership
    const mediaRef = doc(db, 'media', mediaId);
    const mediaSnap = await getDoc(mediaRef);
    
    if (!mediaSnap.exists()) {
      throw new Error('Media not found');
    }

    const mediaData = mediaSnap.data();
    if (mediaData.ownerId !== user.uid) {
      throw new Error('You can only delete your own media');
    }

    let targetPostId = postId;

    // If postId not provided, find the associated post
    if (!targetPostId) {
      const postsRef = collection(db, 'posts');
      const postQuery = query(
        postsRef,
        where('mediaId', '==', mediaId),
        where('ownerId', '==', user.uid)
      );
      const postSnap = await getDocs(postQuery);
      const postDoc = postSnap.docs[0];
      
      if (postDoc) {
        targetPostId = postDoc.id;
      }
    }

    // Delete associated post if it exists
    if (targetPostId) {
      const postRef = doc(db, 'posts', targetPostId);
      const postSnap = await getDoc(postRef);

      if (postSnap.exists()) {
        const postData = postSnap.data();
        if (postData.ownerId !== user.uid) {
          throw new Error('You can only delete your own post');
        }

        await deleteDoc(postRef);
      }
    }

    // Delete media and attempt backend/cloud cleanup when available
    await cleanupMediaForPost(mediaId);
  } catch (error: any) {
    console.error('Error deleting admin media:', error);
    throw new Error(`Failed to delete media: ${error.message}`);
  }
}
