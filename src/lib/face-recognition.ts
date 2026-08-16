// AI Face Recognition Engine for Ashley ERP (Pure Client-Side Dynamic Import)

let faceapiModule: any = null;
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let modelsLoaded = false;
let modelLoadPromise: Promise<boolean> | null = null;

// Dynamically load faceapi only in browser
async function getFaceApi() {
  if (typeof window === 'undefined') return null;
  if (!faceapiModule) {
    faceapiModule = await import('@vladmandic/face-api');
  }
  return faceapiModule;
}

// 1. Load Neural Network Models
export async function loadFaceModels(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (modelsLoaded) return true;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      const faceapi = await getFaceApi();
      if (!faceapi) return false;

      // Load TinyFaceDetector, Landmarks and FaceRecognition models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.warn('Face-api models primary CDN warning, trying fallback:', err);
      try {
        const faceapi = await getFaceApi();
        if (!faceapi) return false;
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
        return true;
      } catch (fallbackErr) {
        console.error('Fatal error loading face models:', fallbackErr);
        return false;
      }
    }
  })();

  return modelLoadPromise;
}

// 2. Extract 128-D Face Descriptor from Video / Image / Canvas
export async function extractFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ descriptor: number[]; detection: any } | null> {
  if (typeof window === 'undefined') return null;
  const faceapi = await getFaceApi();
  if (!faceapi) return null;

  await loadFaceModels();

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  
  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result || !result.descriptor) {
    return null;
  }

  return {
    descriptor: Array.from(result.descriptor),
    detection: result.detection,
  };
}

// 3. Match Two Face Descriptors (Euclidean Distance)
// Distance < 0.56 is matching the same person reliably across different lighting & angles
export function matchFaceDescriptors(
  descriptor1: number[] | Float32Array,
  descriptor2: number[] | Float32Array,
  threshold = 0.56
): { isMatch: boolean; distance: number; similarityPercent: number } {
  const d1 = Array.from(descriptor1);
  const d2 = Array.from(descriptor2);

  // Pure Euclidean Distance calculation (works identically on client and server without dependencies)
  let sum = 0;
  for (let i = 0; i < Math.min(d1.length, d2.length); i++) {
    const diff = d1[i] - d2[i];
    sum += diff * diff;
  }
  const distance = Math.sqrt(sum);
  const isMatch = distance <= threshold;

  // Convert Euclidean distance to confidence percentage (0 distance = 100%, 0.65 = 0%)
  const similarityPercent = Math.max(0, Math.min(100, Math.round((1 - distance / 0.65) * 100)));

  return {
    isMatch,
    distance: Number(distance.toFixed(4)),
    similarityPercent,
  };
}
