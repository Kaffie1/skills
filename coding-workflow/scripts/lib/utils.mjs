import fs from "fs/promises";
import path from "path";

export const ARTIFACT_IDS = ["proposal", "specs", "design", "tasks"];

export function getProjectPaths(projectRoot) {
  const openspecDir = path.join(projectRoot, "openspec");
  return {
    projectRoot,
    openspecDir,
    changesDir: path.join(openspecDir, "changes"),
    specsDir: path.join(openspecDir, "specs")
  };
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

export function assertChangeName(changeName) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(changeName)) {
    throw new Error(
      "Change name must use lowercase letters, digits, and hyphens only, and be under 64 characters."
    );
  }
}

export async function readJson(targetPath) {
  return JSON.parse(await fs.readFile(targetPath, "utf8"));
}

export async function writeFile(targetPath, content) {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, "utf8");
}

export async function listCapabilitySpecFiles(specsDir) {
  const results = [];
  if (!(await pathExists(specsDir))) {
    return results;
  }
  const entries = await fs.readdir(specsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const specPath = path.join(specsDir, entry.name, "spec.md");
    if (await pathExists(specPath)) {
      results.push(specPath);
    }
  }
  return results;
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function moveDir(source, target) {
  await ensureDir(path.dirname(target));
  await fs.rename(source, target);
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}
