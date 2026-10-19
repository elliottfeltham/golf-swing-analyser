import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceDirectory = path.join(
  projectRoot,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm",
);
const targetDirectory = path.join(projectRoot, "public", "mediapipe", "wasm");

await mkdir(targetDirectory, { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });

console.log("MediaPipe WebAssembly assets are ready.");
