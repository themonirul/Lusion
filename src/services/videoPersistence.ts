/**
 * Simple Video Caching and Persistence Service
 * Resolves network URLs to local Blob URLs for gapless seeking.
 */

export const videoPersistence = {
  async resolve(url: string, onUpdate?: (localUrl: string) => void): Promise<string> {
    try {
      // Basic fetch to blob resolution for immediate usage.
      // In a real environment, we'd use the Cache API more robustly.
      const response = await fetch(url);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      
      if (onUpdate) onUpdate(localUrl);
      return localUrl;
    } catch (e) {
      console.warn('⚡ [Persistence] Service failure. Falling back to Network source.', e);
      return url;
    }
  }
};
