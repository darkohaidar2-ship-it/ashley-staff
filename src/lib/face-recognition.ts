// AI Face Recognition Engine for Ashley ERP (Client-Side Neural Network)
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let modelsLoaded = false;
let modelLoadPromise: Promise<boolean> | null = null;

// 1. Load Neural Network Models
export async function loadFaceModels(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (modelsLoaded) return true;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      // Load SSD MobileNet or TinyFaceDetector for high precision
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error('Error loading face models from CDN, retrying with fallback:', err);
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
        return true;
      } catch (fallbackErr) {
        console.error('Fatal error loading face recognition models:', fallbackErr);
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
// Distance < 0.45 means identical person with > 95% confidence
export function matchFaceDescriptors(
  descriptor1: number[] | Float32Array,
  descriptor2: number[] | Float32Array,
  threshold = 0.48
): { isMatch: boolean; distance: number; similarityPercent: number } {
  const d1 = descriptor1 instanceof Float32Array ? descriptor1 : new Float32Array(descriptor1);
  const d2 = descriptor2 instanceof Float32Array ? descriptor2 : new Float32Array(descriptor2);

  const distance = faceapi.euclideanDistance(d1, d2);
  const isMatch = distance <= threshold;

  // Convert Euclidean distance to confidence percentage (0 distance = 100%, 0.6 = 0%)
  const similarityPercent = Math.max(0, Math.min(100, Math.round((1 - distance / 0.6) * 100)));

  return {
    isMatch,
    distance: Number(distance.toFixed(4)),
    similarityPercent,
  };
}
