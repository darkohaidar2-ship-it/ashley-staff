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
): Promise<{ descriptor: number[]; detection: any; landmarks?: any; yaw?: number; headPose?: 'CENTER' | 'RIGHT' | 'LEFT' | 'UNKNOWN' } | null> {
  if (typeof window === 'undefined') return null;
  const faceapi = await getFaceApi();
  if (!faceapi) return null;

  await loadFaceModels();

  // Optimized detector settings for iPhone / Mobile Cameras
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.38 });
  
  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result || !result.descriptor) {
    return null;
  }

  let yaw = 0;
  let headPose: 'CENTER' | 'RIGHT' | 'LEFT' | 'UNKNOWN' = 'CENTER';

  if (result.landmarks && result.landmarks.positions) {
    const pts = result.landmarks.positions;
    const nose = pts[30];
    const eyeL = pts[36];
    const eyeR = pts[45];
    if (nose && eyeL && eyeR) {
      const eyeMidX = (eyeL.x + eyeR.x) / 2;
      const eyeDist = Math.abs(eyeR.x - eyeL.x) || 1;
      yaw = (nose.x - eyeMidX) / eyeDist;
      if (Math.abs(yaw) < 0.14) {
        headPose = 'CENTER';
      } else if (yaw > 0.14) {
        headPose = 'RIGHT';
      } else {
        headPose = 'LEFT';
      }
    }
  }

  return {
    descriptor: Array.from(result.descriptor),
    detection: result.detection,
    landmarks: result.landmarks,
    yaw,
    headPose,
  };
}

// 3. Match Two Face Descriptors (Euclidean Distance)
// Strict High-Precision threshold for reliable multi-person biometric facial recognition (0.48)
export function matchFaceDescriptors(
  descriptor1: number[] | Float32Array,
  descriptor2: number[] | Float32Array,
  threshold = 0.48
): { isMatch: boolean; distance: number; similarityPercent: number } {
  const d1 = Array.from(descriptor1);
  const d2 = Array.from(descriptor2);

  let sum = 0;
  for (let i = 0; i < Math.min(d1.length, d2.length); i++) {
    const diff = d1[i] - d2[i];
    sum += diff * diff;
  }
  const distance = Math.sqrt(sum);
  const similarityPercent = Math.max(0, Math.min(100, Math.round((1 - distance / 0.9) * 100)));

  return {
    isMatch: distance <= threshold,
    distance,
    similarityPercent,
  };
}

