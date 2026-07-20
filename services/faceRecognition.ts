import * as faceapi from 'face-api.js';
import { FaceEmployeeProfile } from './faceAttendance';

export type FaceDescriptor = number[];

export interface FaceMatchResult {
  profile: FaceEmployeeProfile;
  distance: number;
}

export interface FaceDetectionResult {
  success: boolean;
  descriptor?: FaceDescriptor;
  box?: { x: number; y: number; width: number; height: number };
  score?: number;
  error?: string;
}

const MODEL_URL = import.meta.env.VITE_FACE_MODEL_URL || 'https://justadudewhohacks.github.io/face-api.js/models';
const DEFAULT_THRESHOLD = 0.48;

let modelLoadPromise: Promise<void> | null = null;

export const loadFaceModels = async (): Promise<void> => {
  if (!modelLoadPromise) {
    modelLoadPromise = (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
    })();
  }

  return modelLoadPromise;
};

export const detectFaceDescriptor = async (
  video: HTMLVideoElement
): Promise<FaceDetectionResult> => {
  try {
    await loadFaceModels();

    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.5,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return {
        success: false,
        error: '未偵測到清楚的人臉，請正對鏡頭再試一次。',
      };
    }

    return {
      success: true,
      descriptor: Array.from(detection.descriptor),
      box: {
        x: detection.detection.box.x,
        y: detection.detection.box.y,
        width: detection.detection.box.width,
        height: detection.detection.box.height,
      },
      score: detection.detection.score,
    };
  } catch (error) {
    console.error('detectFaceDescriptor error:', error);
    return {
      success: false,
      error: '人臉辨識模組啟動失敗，請稍後再試。',
    };
  }
};

export const euclideanDistance = (a: FaceDescriptor, b: FaceDescriptor): number => {
  const len = Math.min(a.length, b.length);
  let sum = 0;

  for (let i = 0; i < len; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
};

export const findBestMatch = (
  candidate: FaceDescriptor,
  profiles: FaceEmployeeProfile[],
  threshold: number = DEFAULT_THRESHOLD
): FaceMatchResult | null => {
  let best: FaceMatchResult | null = null;

  for (const profile of profiles) {
    const descriptor = profile.descriptor;
    if (!descriptor || descriptor.length === 0) continue;

    const distance = euclideanDistance(candidate, descriptor);
    if (distance > threshold) continue;

    if (!best || distance < best.distance) {
      best = { profile, distance };
    }
  }

  return best;
};

export const getRecommendedThreshold = (): number => DEFAULT_THRESHOLD;
