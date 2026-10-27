import { afterEach, describe, expect, it, vi } from "vitest";

import { PoseWorkerClient } from "./pose-worker-client";

class FakeWorker {
  static latest: FakeWorker | undefined;
  readonly listeners = new Map<string, Set<EventListener>>();
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  constructor() {
    FakeWorker.latest = this;
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe("PoseWorkerClient cleanup", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("terminates the worker and rejects pending requests on disposal", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    const client = new PoseWorkerClient();
    const worker = FakeWorker.latest;
    const initialising = client.initialise({
      wasmBaseUrl: "/wasm",
      modelAssetUrl: "/model.task",
    });
    client.dispose();

    await expect(initialising).rejects.toThrow("Pose worker was stopped");
    expect(worker?.terminate).toHaveBeenCalledOnce();
    client.dispose();
    expect(worker?.terminate).toHaveBeenCalledOnce();
  });

  it("rejects all pending requests when the worker crashes", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    const client = new PoseWorkerClient();
    const worker = FakeWorker.latest;
    const initialising = client.initialise({
      wasmBaseUrl: "/wasm",
      modelAssetUrl: "/model.task",
    });
    worker?.emit("error", new ErrorEvent("error", { message: "worker boom" }));

    await expect(initialising).rejects.toThrow("worker boom");
    client.dispose();
  });
});
