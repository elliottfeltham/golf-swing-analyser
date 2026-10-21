/// <reference lib="webworker" />

import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import type { PoseLandmark } from "@/pose/types";
import type {
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "@/pose/worker-protocol";

let poseLandmarker: PoseLandmarker | undefined;

function postResponse(response: PoseWorkerResponse) {
  self.postMessage(response);
}

function serialiseLandmarks(landmarks: NormalizedLandmark[]): PoseLandmark[] {
  return landmarks.map(({ x, y, z, visibility, presence }) => ({
    x,
    y,
    z,
    ...(visibility === undefined ? {} : { visibility }),
    ...(presence === undefined ? {} : { presence }),
  }));
}

self.onmessage = async (event: MessageEvent<PoseWorkerRequest>) => {
  const request = event.data;

  try {
    if (request.type === "INITIALISE") {
      poseLandmarker?.close();

      const fileset = await FilesetResolver.forVisionTasks(
        request.options.wasmBaseUrl,
      );

      const createLandmarker = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: request.options.modelAssetUrl,
            delegate,
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence:
            request.options.minPoseDetectionConfidence ?? 0.5,
          minPosePresenceConfidence:
            request.options.minPosePresenceConfidence ?? 0.5,
          minTrackingConfidence: request.options.minTrackingConfidence ?? 0.5,
          outputSegmentationMasks: false,
        });

      try {
        poseLandmarker = await createLandmarker("GPU");
      } catch {
        poseLandmarker = await createLandmarker("CPU");
      }

      postResponse({ type: "READY", requestId: request.requestId });
      return;
    }

    if (!poseLandmarker) {
      throw new Error("The pose model has not been initialised.");
    }

    try {
      const result = poseLandmarker.detectForVideo(
        request.frame,
        request.timestampMs,
      );
      const landmarks = result.landmarks[0];
      const worldLandmarks = result.worldLandmarks[0];

      postResponse({
        type: "FRAME_RESULT",
        requestId: request.requestId,
        result:
          landmarks && worldLandmarks
            ? {
                timestampMs: request.timestampMs,
                landmarks: serialiseLandmarks(landmarks),
                worldLandmarks: serialiseLandmarks(worldLandmarks),
              }
            : null,
      });
    } finally {
      request.frame.close();
    }
  } catch (error) {
    postResponse({
      type: "ERROR",
      requestId: request.requestId,
      message:
        error instanceof Error ? error.message : "Pose processing failed.",
    });
  }
};
