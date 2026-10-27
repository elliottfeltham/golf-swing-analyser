import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const clientDirectory = path.resolve(".next/static");
const forbiddenNames = [
  "OPENROUTER_API_KEY",
  "QUOTA_HMAC_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
];
const configuredSecrets = forbiddenNames.flatMap((name) => {
  const value = process.env[name];
  return value && value.length >= 8 ? [{ name, value }] : [];
});

const files = await listFiles(clientDirectory);
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const name of forbiddenNames) {
    if (content.includes(name)) fail(name, file);
  }
  for (const secret of configuredSecrets) {
    if (content.includes(secret.value)) fail(secret.name, file);
  }
}

console.log(`Checked ${files.length} client assets; no server secrets found.`);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(target) : [target];
    }),
  );
  return nested.flat();
}

function fail(name, file) {
  console.error(`Server secret ${name} was found in client asset ${file}.`);
  process.exit(1);
}
