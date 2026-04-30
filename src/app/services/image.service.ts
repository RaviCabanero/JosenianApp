import { Injectable } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  constructor(private sanitizer: DomSanitizer) { }

  /**
   * Convert base64 string to safe URL for use in img src binding
   * @param base64String - The base64 string (without data URI prefix)
   * @param mimeType - The MIME type (default: 'image/jpeg')
   * @returns SafeUrl that can be used in [src] binding
   */
  base64ToSafeUrl(base64String: string, mimeType: string = 'image/jpeg'): SafeUrl {
    if (!base64String) {
      return this.sanitizer.bypassSecurityTrustUrl('');
    }

    // Add data URI prefix if not present
    const dataUrl = base64String.startsWith('data:') 
      ? base64String 
      : `data:${mimeType};base64,${base64String}`;

    return this.sanitizer.bypassSecurityTrustUrl(dataUrl);
  }

  /**
   * Download base64 file
   * @param base64String - The base64 string
   * @param fileName - The file name for download
   * @param mimeType - The MIME type
   */
  downloadBase64File(base64String: string, fileName: string, mimeType: string = 'image/jpeg'): void {
    // Decode base64 to binary
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob and download
    const blob = new Blob([bytes], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Get file size in MB from base64 string
   * @param base64String - The base64 string
   * @returns Size in MB
   */
  getFileSizeInMB(base64String: string): number {
    const bytes = base64String.length * 0.75; // Approximate size
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }
}
