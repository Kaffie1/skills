import fs from "fs/promises";

const REQUIREMENT_HEADER = /^###\s*Requirement:\s*(.+)\s*$/i;
const SCENARIO_HEADER = /^####\s*Scenario:\s*(.+)\s*$/im;
const DELTA_SECTION_HEADER = /^##\s*(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/im;

function issue(level, filePath, message) {
  return { level, path: filePath, message };
}

function normalize(content) {
  return content.replace(/\r\n?/g, "\n");
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
    const name = match ? match[1].trim() : "";
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

function findRequirementIssues(block, filePath) {
  const issues = [];
  if (!/(SHALL|MUST)/.test(block.raw)) {
    issues.push(issue("WARNING", filePath, `Requirement '${block.name}' should contain SHALL or MUST.`));
  }
  if (!SCENARIO_HEADER.test(block.raw)) {
    issues.push(issue("ERROR", filePath, `Requirement '${block.name}' must have at least one #### Scenario.`));
  }
  return issues;
}

export async function validateMainSpec({ specName, filePath, content }) {
  const source = typeof content === "string" ? content : await fs.readFile(filePath, "utf8");
  const normalized = normalize(source);
  const issues = [];
  if (!/^##\s+Purpose\s*$/im.test(normalized) || !/^##\s+Requirements\s*$/im.test(normalized)) {
    issues.push(
      issue(
        "ERROR",
        filePath || specName,
        'Spec must have a Purpose section and a Requirements section.'
      )
    );
  }
  const requirementsSection = normalized.split(/^##\s+Requirements\s*$/im)[1] || "";
  const blocks = parseRequirementBlocks(requirementsSection);
  if (blocks.length === 0) {
    issues.push(issue("ERROR", filePath || specName, "Spec must have at least one requirement."));
  }
  for (const block of blocks) {
    issues.push(...findRequirementIssues(block, filePath || specName));
  }
  return { valid: !issues.some((entry) => entry.level === "ERROR"), issues };
}

async function validateDeltaFile(specPath) {
  const content = normalize(await fs.readFile(specPath, "utf8"));
  const issues = [];
  if (!DELTA_SECTION_HEADER.test(content)) {
    issues.push(issue("ERROR", specPath, "Delta spec must contain ADDED/MODIFIED/REMOVED/RENAMED sections."));
    return { valid: false, issues };
  }
  const sections = content.split(/^##\s+/m).slice(1);
  for (const section of sections) {
    const [titleLine, ...bodyLines] = section.split("\n");
    if (!/^(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i.test(titleLine.trim())) {
      continue;
    }
    const blocks = parseRequirementBlocks(bodyLines.join("\n"));
    if (/^(ADDED|MODIFIED)\s+Requirements/i.test(titleLine.trim()) && blocks.length === 0) {
      issues.push(issue("ERROR", specPath, `${titleLine.trim()} must contain at least one requirement.`));
    }
    for (const block of blocks) {
      issues.push(...findRequirementIssues(block, specPath));
    }
  }
  return { valid: !issues.some((entry) => entry.level === "ERROR"), issues };
}

export async function validateDeltaSpecs({ changeDir }) {
  const specsDir = new URL(`file://${changeDir}/specs/`);
  let entries = [];
  try {
    entries = await fs.readdir(specsDir, { withFileTypes: true });
  } catch {
    return {
      valid: false,
      issues: [issue("ERROR", changeDir, "Change must contain a specs directory with at least one capability spec.")]
    };
  }
  const issues = [];
  let validatedCount = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const specPath = new URL(`file://${changeDir}/specs/${entry.name}/spec.md`).pathname;
    try {
      const result = await validateDeltaFile(specPath);
      validatedCount += 1;
      issues.push(...result.issues);
    } catch {
      issues.push(issue("ERROR", specPath, "Failed to read delta spec file."));
    }
  }
  if (validatedCount === 0) {
    issues.push(issue("ERROR", changeDir, "Change must contain at least one delta spec file."));
  }
  return { valid: !issues.some((entry) => entry.level === "ERROR"), issues };
}

export async function validateRebuiltSpec({ specName, rebuiltContent }) {
  return validateMainSpec({ specName, content: rebuiltContent });
}
