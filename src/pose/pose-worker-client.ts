import type { PoseFrame, PoseModelOptions } from "./types";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./worker-protocol";

interface PendingRequest {
  resolve: (value: PoseFrame | null | undefined) => void;
  reject: (reason: Error) => void;
}

export class PoseWorkerClient {
  private readonly worker: Worker;
  private readonly pendingRequests = new Map<string, PendingRequest>();

  constructor() {
    this.worker = new Worker(
      new URL("../workers/pose.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    this.worker.addEventListener("message", this.handleMessage);
    this.worker.addEventListener("error", this.handleWorkerError);
  }

  initialise(options: PoseModelOptions): Promise<void> {
    return this.request({
      type: "INITIALISE",
      requestId: crypto.randomUUID(),
      options,
    }).then(() => undefined);
  }

  analyseFrame(
    frame: ImageBitmap,
    timestampMs: number,
  ): Promise<PoseFrame | null> {
    return this.request(
      {
        type: "ANALYSE_FRAME",
        requestId: crypto.randomUUID(),
        frame,
        timestampMs,
      },
      [frame],
    ) as Promise<PoseFrame | null>;
  }

  dispose() {
    this.worker.removeEventListener("message", this.handleMessage);
    this.worker.removeEventListener("error", this.handleWorkerError);
    this.worker.terminate();

    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error("Pose worker was stopped."));
    }
    this.pendingRequests.clear();
  }

  private request(
    message: PoseWorkerRequest,
    transfer: Transferable[] = [],
  ): Promise<PoseFrame | null | undefined> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.requestId, { resolve, reject });
      this.worker.postMessage(message, transfer);
    });
  }

  private readonly handleMessage = (
    event: MessageEvent<PoseWorkerResponse>,
  ) => {
    const response = event.data;
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) return;

    this.pendingRequests.delete(response.requestId);

    if (response.type === "ERROR") {
      pending.reject(new Error(response.message));
      return;
    }

    pending.resolve(
      response.type === "FRAME_RESULT" ? response.result : undefined,
    );
  };

  private readonly handleWorkerError = (event: ErrorEvent) => {
    const error = new Error(event.message || "Pose worker crashed.");
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  };
}
