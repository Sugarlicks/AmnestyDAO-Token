/**
 * Simplified Image Utility - Modern approach for image handling
 * 
 * Assumptions:
 * - Images are stored as base64 strings in the database
 * - Standardized on base64 for storage, Blob URLs for display
 * - Falls back to placeholder logo on any errors
 */

export interface ImageUrlResult {
  url: string | null;
  mimeType: string | null;
  error?: string;
}

// Import placeholder logo - Vite will handle the path resolution
import placeholderLogo from '../assets/icon-logo.svg';

/**
 * Gets the placeholder logo URL
 */
function getPlaceholderUrl(): string {
  return placeholderLogo;
}

/**
 * Detects MIME type from image binary data
 */
function detectMimeType(bytes: Uint8Array): string {
  if (bytes.length < 4) return 'image/jpeg';
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  
  // WebP: RIFF...WEBP pattern
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  
  // SVG: Check for XML declaration or <svg tag
  if (bytes.length >= 5) {
    const start = String.fromCharCode(...Array.from(bytes.slice(0, Math.min(100, bytes.length))));
    if (start.trim().startsWith('<?xml') || start.trim().startsWith('<svg')) {
      return 'image/svg+xml';
    }
  }
  
  return 'image/jpeg';
}

/**
 * Converts base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(`Invalid base64 string: ${error}`);
  }
}

/**
 * Converts Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binaryString = '';
  const chunkSize = 32768; // 32KB chunks to avoid stack overflow
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    const chunkArray = Array.from(chunk);
    binaryString += String.fromCharCode.apply(null, chunkArray);
  }
  
  return btoa(binaryString);
}

/**
 * Creates a Blob URL from binary data (better for mobile performance)
 */
function createBlobUrl(bytes: Uint8Array, mimeType: string): string {
  try {
    // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
    const buffer = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(buffer);
    view.set(bytes);
    const blob = new Blob([buffer], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (error) {
    throw new Error(`Failed to create Blob URL: ${error}`);
  }
}

/**
 * Converts base64 image data to a usable image URL
 * 
 * Supports:
 * - HTTP/HTTPS URLs (returns as-is)
 * - Data URLs (converts to Blob URL for better performance)
 * - Base64 strings (creates Blob URL with proper MIME type)
 * 
 * Always uses Blob URLs for better mobile performance (especially Android)
 * Falls back to placeholder logo on any errors
 */
export function getImageUrl(
  imageData: string | null | undefined
): ImageUrlResult {
  // Return placeholder if no image data
  if (!imageData) {
    return { url: getPlaceholderUrl(), mimeType: 'image/svg+xml' };
  }
  
  // Ensure imageData is a string before processing
  if (typeof imageData !== 'string') {
    console.warn('getImageUrl received non-string imageData:', typeof imageData, imageData);
    return { url: getPlaceholderUrl(), mimeType: 'image/svg+xml' };
  }
  
  // HTTP/HTTPS URLs - return as-is
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return { url: imageData, mimeType: null };
  }
  
  // Extract base64 and MIME type from data URL
  let base64: string;
  let mimeType: string;
  
  try {
    if (imageData.startsWith('data:')) {
      const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        console.warn('Invalid data URL format, using placeholder');
        return { url: getPlaceholderUrl(), mimeType: 'image/svg+xml' };
      }
      mimeType = match[1];
      base64 = match[2];
    } else {
      // Assume it's a plain base64 string
      // Detect MIME type from the binary data
      try {
        const bytes = base64ToUint8Array(imageData);
        mimeType = detectMimeType(bytes);
        base64 = imageData;
      } catch (error) {
        console.warn('Invalid base64 string, using placeholder:', error);
        return { url: getPlaceholderUrl(), mimeType: 'image/svg+xml' };
      }
    }
    
    // Convert to binary and create Blob URL
    try {
      const bytes = base64ToUint8Array(base64);
      const blobUrl = createBlobUrl(bytes, mimeType);
      return { url: blobUrl, mimeType };
    } catch (error) {
      console.warn('Error creating Blob URL, falling back to data URL:', error);
      // Fallback to data URL if Blob creation fails
      try {
        return { 
          url: `data:${mimeType};base64,${base64}`, 
          mimeType 
        };
      } catch (fallbackError) {
        console.warn('Fallback to data URL failed, using placeholder:', fallbackError);
        return { url: getPlaceholderUrl(), mimeType: 'image/svg+xml' };
      }
    }
  } catch (error) {
    console.warn('Error processing image data, using placeholder:', error);
    return { url: getPlaceholderUrl(), mimeType: 'image/svg+xml' };
  }
}

/**
 * Converts image data to base64 string for storage/upload
 * 
 * Input can be:
 * - Base64 string (returns as-is)
 * - Data URL (extracts base64 part)
 * - Object format {data: number[], type?: string} (legacy support)
 * 
 * Note: For File objects, use imageDataToBase64Async() instead
 */
export function imageDataToBase64(imageData: string | { data: number[], type?: string } | null | undefined): string | null {
  if (!imageData) return null;
  
  if (typeof imageData === 'string') {
    // Data URL - extract base64 part
    if (imageData.startsWith('data:')) {
      const base64Part = imageData.split(',')[1];
      return base64Part || null;
    }
    
    // Already base64 string
    if (/^[A-Za-z0-9+/=]+$/.test(imageData)) {
      return imageData;
    }
  }
  
  // Handle object format (legacy support)
  if (typeof imageData === 'object' && imageData !== null && 'data' in imageData && Array.isArray(imageData.data)) {
    try {
      const uint8Array = new Uint8Array(imageData.data);
      return uint8ArrayToBase64(uint8Array);
    } catch (error) {
      console.error('Error converting object imageData to base64:', error);
      return null;
    }
  }
  
  return null;
}

/**
 * Async version for File conversion
 */
export async function imageDataToBase64Async(
  imageData: string | File | null | undefined
): Promise<string | null> {
  if (!imageData) return null;
  
  // File object - convert to base64
  if (imageData instanceof File) {
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => {
        console.error('Error reading file');
        resolve(null);
      };
      reader.readAsDataURL(imageData);
    });
  }
  
  // String input
  if (typeof imageData === 'string') {
    // Data URL - extract base64 part
    if (imageData.startsWith('data:')) {
      const base64Part = imageData.split(',')[1];
      return base64Part || null;
    }
    
    // Already base64 string
    if (/^[A-Za-z0-9+/=]+$/.test(imageData)) {
      return imageData;
    }
  }
  
  return null;
}

/**
 * Revokes a Blob URL to free memory
 */
export function revokeImageUrl(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Error revoking blob URL:', error);
    }
  }
}

/**
 * Cleans up multiple image URLs
 */
export function cleanupImageUrls(urls: (string | null)[]): void {
  urls.forEach(url => revokeImageUrl(url));
}
