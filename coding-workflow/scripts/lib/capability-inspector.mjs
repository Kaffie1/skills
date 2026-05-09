import fs from "fs/promises";
import path from "path";
import { pathExists } from "./utils.mjs";

function toTitleCaseFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scoreTextMatch(requestText, haystack) {
  const requestTokens = requestText
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter((token) => token.length >= 2);
  if (requestTokens.length === 0) {
    return 0;
  }
  let hits = 0;
  for (const token of requestTokens) {
    if (haystack.includes(token)) {
      hits += 1;
    }
  }
  return hits / requestTokens.length;
}

async function readFileSafe(targetPath) {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return "";
  }
}

export async function inspectCapabilities({ projectRoot, requestText = "" }) {
  const openspecDir = path.join(projectRoot, "openspec");
  const specsDir = path.join(openspecDir, "specs");
  const archiveDir = path.join(openspecDir, "changes", "archive");
  const capabilities = [];

  if (await pathExists(specsDir)) {
    const entries = await fs.readdir(specsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const specPath = path.join(specsDir, entry.name, "spec.md");
      if (!(await pathExists(specPath))) {
        continue;
      }
      const content = await readFileSafe(specPath);
      const haystack = `${entry.name} ${content}`.toLowerCase();
      capabilities.push({
        id: entry.name,
        title: toTitleCaseFromSlug(entry.name),
        source: "spec",
        specPath,
        score: scoreTextMatch(requestText, haystack),
        summary: extractPurpose(content)
      });
    }
  }

  const archiveMatches = [];
  if (await pathExists(archiveDir)) {
    const archivedChanges = await fs.readdir(archiveDir, { withFileTypes: true });
    for (const entry of archivedChanges) {
      if (!entry.isDirectory()) {
        continue;
      }
      const proposalPath = path.join(archiveDir, entry.name, "proposal.md");
      const designPath = path.join(archiveDir, entry.name, "design.md");
      const tasksPath = path.join(archiveDir, entry.name, "tasks.md");
      const combined = [
        await readFileSafe(proposalPath),
        await readFileSafe(designPath),
        await readFileSafe(tasksPath)
      ].join("\n");
      const score = scoreTextMatch(requestText, `${entry.name} ${combined}`.toLowerCase());
      if (score > 0) {
        archiveMatches.push({
          id: entry.name,
          source: "archive",
          proposalPath,
          score
        });
      }
    }
  }

  capabilities.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  archiveMatches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return {
    capabilities,
    archiveMatches
  };
}

function extractPurpose(content) {
  const match = content.match(/^##\s+Purpose\s*$([\s\S]*?)(^##\s+Requirements\s*$)/im);
  if (!match) {
    return "";
  }
  return match[1].trim().replace(/\s+/g, " ").slice(0, 220);
}
