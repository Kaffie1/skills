import fs from "fs/promises";
import path from "path";
import {
  ARTIFACT_IDS,
  assertChangeName,
  ensureDir,
  getProjectPaths,
  listCapabilitySpecFiles,
  pathExists,
  readJson,
  writeFile
} from "./utils.mjs";

const SKILL_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const SCHEMA_PATH = path.join(SKILL_ROOT, "assets", "spec-driven", "schema.json");
const TEMPLATES_DIR = path.join(SKILL_ROOT, "assets", "spec-driven", "templates");

function artifactOutputPath(changeDir, artifact) {
  if (artifact.id === "specs") {
    return path.join(changeDir, "specs");
  }
  return path.join(changeDir, artifact.outputPath);
}

async function isArtifactDone(changeDir, artifact) {
  if (artifact.id === "specs") {
    const specFiles = await listCapabilitySpecFiles(path.join(changeDir, "specs"));
    return specFiles.length > 0;
  }
  return pathExists(artifactOutputPath(changeDir, artifact));
}

async function loadSchema() {
  return readJson(SCHEMA_PATH);
}

export async function ensureInitialized(projectRoot) {
  const paths = getProjectPaths(projectRoot);
  const createdPaths = [];
  for (const target of [paths.openspecDir, paths.changesDir, path.join(paths.changesDir, "archive"), paths.specsDir]) {
    if (!(await pathExists(target))) {
      createdPaths.push(target);
    }
    await ensureDir(target);
  }
  const schema = await loadSchema();
  return {
    created: createdPaths.length > 0,
    createdPaths,
    schemaName: schema.name
  };
}

export async function createChange({ projectRoot, changeName }) {
  assertChangeName(changeName);
  const schema = await loadSchema();
  const paths = getProjectPaths(projectRoot);
  await ensureInitialized(projectRoot);
  const changeDir = path.join(paths.changesDir, changeName);
  if (await pathExists(changeDir)) {
    return {
      changeName,
      changeDir,
      created: false,
      schemaName: schema.name,
      artifacts: schema.artifacts.map(({ id, generates, requires }) => ({
        id,
        outputPath: generates,
        dependsOn: requires
      }))
    };
  }

  await ensureDir(path.join(changeDir, "specs"));
  await writeFile(
    path.join(changeDir, ".openspec.yaml"),
    `schema: ${schema.name}\ncreated_at: ${new Date().toISOString()}\n`
  );

  return {
    changeName,
    changeDir,
    created: true,
    schemaName: schema.name,
    artifacts: schema.artifacts.map(({ id, generates, requires }) => ({
      id,
      outputPath: generates,
      dependsOn: requires
    }))
  };
}

export async function loadChangeContext({ projectRoot, changeName }) {
  const schema = await loadSchema();
  const paths = getProjectPaths(projectRoot);
  const changeDir = path.join(paths.changesDir, changeName);
  if (!(await pathExists(changeDir))) {
    throw new Error(`Change '${changeName}' not found.`);
  }
  return {
    changeName,
    changeDir,
    schemaName: schema.name,
    artifacts: schema.artifacts.map(({ id, generates, requires, description, instruction, template }) => ({
      id,
      outputPath: generates,
      dependsOn: requires,
      description,
      instruction,
      template
    })),
    applyRequires: schema.apply.requires
  };
}

export async function getStatus({ projectRoot, changeName }) {
  const context = await loadChangeContext({ projectRoot, changeName });
  const artifacts = [];
  for (const artifact of context.artifacts) {
    const done = await isArtifactDone(context.changeDir, artifact);
    if (done) {
      artifacts.push({
        id: artifact.id,
        outputPath: artifact.outputPath,
        status: "done"
      });
      continue;
    }
    const missingDeps = [];
    for (const depId of artifact.dependsOn) {
      const depArtifact = context.artifacts.find((item) => item.id === depId);
      if (!depArtifact) {
        continue;
      }
      if (!(await isArtifactDone(context.changeDir, depArtifact))) {
        missingDeps.push(depId);
      }
    }
    artifacts.push({
      id: artifact.id,
      outputPath: artifact.outputPath,
      status: missingDeps.length > 0 ? "blocked" : "ready",
      missingDeps: missingDeps.length > 0 ? missingDeps : undefined
    });
  }
  return {
    changeName: context.changeName,
    schemaName: context.schemaName,
    isComplete: artifacts.every((artifact) => artifact.status === "done"),
    applyRequires: context.applyRequires,
    artifacts
  };
}

export async function getInstructions({ projectRoot, changeName, artifactId }) {
  if (!ARTIFACT_IDS.includes(artifactId)) {
    throw new Error(`Unknown artifact '${artifactId}'.`);
  }
  const context = await loadChangeContext({ projectRoot, changeName });
  const artifact = context.artifacts.find((item) => item.id === artifactId);
  if (!artifact) {
    throw new Error(`Artifact '${artifactId}' not found.`);
  }
  const template = await fs.readFile(path.join(TEMPLATES_DIR, artifact.template), "utf8");
  const status = await getStatus({ projectRoot, changeName });
  const dependencies = artifact.dependsOn.map((depId) => {
    const depArtifact = context.artifacts.find((item) => item.id === depId);
    const depStatus = status.artifacts.find((item) => item.id === depId);
    return {
      id: depId,
      done: depStatus?.status === "done",
      path: depArtifact?.outputPath ?? "",
      description: depArtifact?.description ?? ""
    };
  });
  const unlocks = context.artifacts.filter((item) => item.dependsOn.includes(artifactId)).map((item) => item.id);
  return {
    changeName,
    artifactId,
    schemaName: context.schemaName,
    outputPath: artifact.outputPath,
    description: artifact.description,
    instruction: artifact.instruction,
    template,
    dependencies,
    unlocks
  };
}
