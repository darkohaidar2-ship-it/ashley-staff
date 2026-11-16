/**
 * Ultra-lightweight client-side image compression utility.
 * Compresses large smartphone photos (often 3MB - 10MB) into super-light ~20KB-40KB JPEGs.
 * Prevents localStorage quota errors (5MB limit) and ensures permanent, instant cloud persistence.
 */

export async function compressEmployeeAvatar(
  input: File | Blob | string,
  maxWidth = 360,
  maxHeight = 360,
  quality = 0.75
): Promise<string> {
  if (typeof window === 'undefined') {
    return typeof input === 'string' ? input : '';
  }

  // If input is an SVG, leave it untouched
  if (typeof input !== 'string' && 'type' in input && input.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  }

  // Load into HTMLImageElement
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Failed to load image for compression'));
      img.src = src;
    });
  };

  let srcUrl = '';
  let needRevoke = false;

  if (typeof input === 'string') {
    srcUrl = input;
  } else {
    srcUrl = URL.createObjectURL(input);
    needRevoke = true;
  }

  try {
    const img = await loadImage(srcUrl);

    let { width, height } = img;

    // Rescale proportionally
    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return srcUrl;
    }

    // High quality bicubic resampling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Fill white background in case of transparent PNGs so they don't produce black background on JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
    return compressedDataUrl;
  } finally {
    if (needRevoke && srcUrl) {
      try {
        URL.revokeObjectURL(srcUrl);
      } catch (err) {
        // ignore
      }
    }
  }
}
