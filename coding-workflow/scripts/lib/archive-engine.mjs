import fs from "fs/promises";
import path from "path";
import { getProgress } from "./task-tracker.mjs";
import { validateDeltaSpecs, validateMainSpec, validateRebuiltSpec } from "./spec-validator.mjs";
import { ensureDir, moveDir, pathExists, todayStamp, uniqueBy } from "./utils.mjs";

const REQUIREMENT_HEADER = /^###\s*Requirement:\s*(.+)\s*$/i;

function normalize(content) {
  return content.replace(/\r\n?/g, "\n");
}

function normalizeName(name) {
  return name.trim();
}

function parseRequirementBlocks(sectionBody) {
  const lines = normalize(sectionBody).split("\n");
  const blocks = [];
  let cursor = 0;
  while (cursor < lines.length) {
    while (cursor < lines.length && !REQUIREMENT_HEADER.test(lines[cursor])) {
      cursor += 1;
    }
    if (cursor >= lines.length) {
      break;
    }
    const header = lines[cursor];
    const match = header.match(REQUIREMENT_HEADER);
    const name = match ? normalizeName(match[1]) : "";
    const buffer = [header];
    cursor += 1;
    while (cursor < lines.length && !REQUIREMENT_HEADER.test(lines[cursor]) && !/^##\s+/.test(lines[cursor])) {
      buffer.push(lines[cursor]);
      cursor += 1;
    }
    blocks.push({ name, raw: buffer.join("\n").trimEnd() });
  }
  return blocks;
}

function extractRequirementsSection(content) {
  const normalized = normalize(content);
  const lines = normalized.split("\n");
  const index = lines.findIndex((line) => /^##\s+Requirements\s*$/i.test(line));
  if (index === -1) {
    return {
      before: normalized.trimEnd(),
      preamble: "",
      blocks: [],
      after: ""
    };
  }
  let endIndex = lines.length;
  for (let i = index + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  const before = lines.slice(0, index).join("\n");
  const sectionBody = lines.slice(index + 1, endIndex).join("\n");
  const blocks = parseRequirementBlocks(sectionBody);
  const firstRequirementIndex = sectionBody.search(/^###\s*Requirement:/m);
  const preamble = firstRequirementIndex >= 0 ? sectionBody.slice(0, firstRequirementIndex).trimEnd() : sectionBody.trimEnd();
  const after = lines.slice(endIndex).join("\n");
  return { before, preamble, blocks, after };
}

function splitDeltaSections(content) {
  const lines = normalize(content).split("\n");
  const sections = {};
  const headers = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^##\s+(.+)$/);
    if (match) {
      headers.push({ title: match[1].trim(), index: i });
    }
  }
  for (let i = 0; i < headers.length; i += 1) {
    const current = headers[i];
    const next = headers[i + 1];
    sections[current.title] = lines.slice(current.index + 1, next ? next.index : lines.length).join("\n");
  }
  return sections;
}

function parseRemovedNames(sectionBody) {
  const names = [];
  for (const line of normalize(sectionBody).split("\n")) {
    const match = line.match(REQUIREMENT_HEADER);
    if (match) {
      names.push(normalizeName(match[1]));
    }
  }
  return uniqueBy(names, (name) => name);
}

function parseRenamed(sectionBody) {
  const pairs = [];
  let currentFrom = "";
  for (const line of normalize(sectionBody).split("\n")) {
    const fromMatch = line.match(/^\s*-?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/i);
    const toMatch = line.match(/^\s*-?\s*TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/i);
    if (fromMatch) {
      currentFrom = normalizeName(fromMatch[1]);
    } else if (toMatch && currentFrom) {
      pairs.push({ from: currentFrom, to: normalizeName(toMatch[1]) });
      currentFrom = "";
    }
  }
  return pairs;
}

function parseDelta(content) {
  const sections = splitDeltaSections(content);
  return {
    added: parseRequirementBlocks(sections["ADDED Requirements"] || ""),
    modified: parseRequirementBlocks(sections["MODIFIED Requirements"] || ""),
    removed: parseRemovedNames(sections["REMOVED Requirements"] || ""),
    renamed: parseRenamed(sections["RENAMED Requirements"] || "")
  };
}

function serializeMainSpec(before, preamble, blocks, after) {
  const pieces = [];
  if (before.trim()) {
    pieces.push(before.trimEnd());
  }
  pieces.push("## Requirements");
  if (preamble.trim()) {
    pieces.push(preamble.trim());
  }
  for (const block of blocks) {
    pieces.push(block.raw.trimEnd());
  }
  if (after.trim()) {
    pieces.push(after.trim());
  }
  return pieces.join("\n\n").trimEnd() + "\n";
}

function createEmptyMainSpec(capability) {
  return `# ${capability}\n\n## Purpose\n\nDefine the baseline behavior for ${capability}.\n\n## Requirements\n`;
}

export async function planArchive({ projectRoot, changeName }) {
  const changeDir = path.join(projectRoot, "openspec", "changes", changeName);
  const specsDir = path.join(changeDir, "specs");
  const mainSpecsDir = path.join(projectRoot, "openspec", "specs");
  const entries = await fs.readdir(specsDir, { withFileTypes: true });
  const specUpdates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const source = path.join(specsDir, entry.name, "spec.md");
    if (!(await pathExists(source))) {
      continue;
    }
    const target = path.join(mainSpecsDir, entry.name, "spec.md");
    specUpdates.push({
      capability: entry.name,
      source,
      target,
      exists: await pathExists(target)
    });
  }
  return {
    changeName,
    changeDir,
    specUpdates,
    taskProgress: await getProgress({ tasksPath: path.join(changeDir, "tasks.md") })
  };
}

async function applySpecUpdate(update) {
  const deltaContent = await fs.readFile(update.source, "utf8");
  const delta = parseDelta(deltaContent);
  let baseContent = update.exists ? await fs.readFile(update.target, "utf8") : createEmptyMainSpec(update.capability);
  const base = extractRequirementsSection(baseContent);
  let blocks = [...base.blocks];

  for (const renamed of delta.renamed) {
    const index = blocks.findIndex((block) => block.name === renamed.from);
    if (index === -1) {
      throw new Error(`Cannot rename missing requirement '${renamed.from}' in ${update.capability}.`);
    }
    blocks[index] = {
      name: renamed.to,
      raw: blocks[index].raw.replace(
        /^###\s*Requirement:\s*.+$/m,
        `### Requirement: ${renamed.to}`
      )
    };
  }

  for (const removedName of delta.removed) {
    blocks = blocks.filter((block) => block.name !== removedName);
  }

  for (const modifiedBlock of delta.modified) {
    const index = blocks.findIndex((block) => block.name === modifiedBlock.name);
    if (index === -1) {
      throw new Error(`Cannot modify missing requirement '${modifiedBlock.name}' in ${update.capability}.`);
    }
    blocks[index] = modifiedBlock;
  }

  for (const addedBlock of delta.added) {
    const exists = blocks.some((block) => block.name === addedBlock.name);
    if (exists) {
      throw new Error(`Cannot add duplicate requirement '${addedBlock.name}' in ${update.capability}.`);
    }
    blocks.push(addedBlock);
  }

  const rebuilt = serializeMainSpec(base.before, base.preamble, blocks, base.after);
  const validation = await validateRebuiltSpec({ specName: update.capability, rebuiltContent: rebuilt });
  if (!validation.valid) {
    const firstError = validation.issues.find((entry) => entry.level === "ERROR");
    throw new Error(firstError ? firstError.message : `Rebuilt spec '${update.capability}' is invalid.`);
  }

  return {
    capability: update.capability,
    target: update.target,
    rebuilt,
    added: delta.added.length,
    modified: delta.modified.length,
    removed: delta.removed.length,
    renamed: delta.renamed.length
  };
}

export async function executeArchive({
  projectRoot,
  changeName,
  skipValidation = false,
  skipSpecUpdates = false,
  allowIncompleteTasks = false
}) {
  const plan = await planArchive({ projectRoot, changeName });
  if (!allowIncompleteTasks && plan.taskProgress.total > 0 && plan.taskProgress.total !== plan.taskProgress.completed) {
    throw new Error("Cannot archive change with incomplete tasks.");
  }

  if (!skipValidation) {
    const deltaValidation = await validateDeltaSpecs({ changeDir: plan.changeDir });
    if (!deltaValidation.valid) {
      const firstError = deltaValidation.issues.find((entry) => entry.level === "ERROR");
      throw new Error(firstError ? firstError.message : "Delta specs are invalid.");
    }
  }

  const specResults = [];
  if (!skipSpecUpdates) {
    for (const update of plan.specUpdates) {
      const result = await applySpecUpdate(update);
      if (!skipValidation) {
        const mainValidation = await validateMainSpec({
          specName: result.capability,
          content: result.rebuilt
        });
        if (!mainValidation.valid) {
          const firstError = mainValidation.issues.find((entry) => entry.level === "ERROR");
          throw new Error(firstError ? firstError.message : `Spec '${result.capability}' failed validation.`);
        }
      }
      await ensureDir(path.dirname(result.target));
      await fs.writeFile(result.target, result.rebuilt, "utf8");
      specResults.push(result);
    }
  }

  const archiveDir = path.join(projectRoot, "openspec", "changes", "archive", `${todayStamp()}-${changeName}`);
  await moveDir(plan.changeDir, archiveDir);
  return {
    archived: true,
    archiveDir,
    specResults,
    taskProgress: plan.taskProgress,
    warnings: []
  };
}
