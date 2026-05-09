#!/usr/bin/env node
import path from "path";
import { executeArchive, planArchive } from "./lib/archive-engine.mjs";
import { validateDeltaSpecs, validateMainSpec } from "./lib/spec-validator.mjs";
import { createChange, ensureInitialized, getInstructions, getStatus } from "./lib/workflow-engine.mjs";

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  const positionals = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith("--")) {
        options[key] = true;
      } else {
        options[key] = next;
        i += 1;
      }
    } else {
      positionals.push(token);
    }
  }
  return { command, options, positionals };
}

async function main() {
  const { command, options, positionals } = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(options.projectRoot || process.cwd());

  if (command === "init") {
    print(await ensureInitialized(projectRoot));
    return;
  }

  if (command === "new-change") {
    const [changeName] = positionals;
    if (!changeName) {
      throw new Error("Missing change name.");
    }
    print(await createChange({ projectRoot, changeName }));
    return;
  }

  if (command === "status") {
    const [changeName] = positionals;
    if (!changeName) {
      throw new Error("Missing change name.");
    }
    print(await getStatus({ projectRoot, changeName }));
    return;
  }

  if (command === "instructions") {
    const [changeName, artifactId] = positionals;
    if (!changeName || !artifactId) {
      throw new Error("Usage: instructions <changeName> <artifactId>");
    }
    print(await getInstructions({ projectRoot, changeName, artifactId }));
    return;
  }

  if (command === "validate-main") {
    const [specPath] = positionals;
    if (!specPath) {
      throw new Error("Missing spec path.");
    }
    print(await validateMainSpec({ specName: path.basename(path.dirname(specPath)), filePath: path.resolve(specPath) }));
    return;
  }

  if (command === "validate-delta") {
    const [changeDir] = positionals;
    if (!changeDir) {
      throw new Error("Missing change directory.");
    }
    print(await validateDeltaSpecs({ changeDir: path.resolve(changeDir) }));
    return;
  }

  if (command === "plan-archive") {
    const [changeName] = positionals;
    if (!changeName) {
      throw new Error("Missing change name.");
    }
    print(await planArchive({ projectRoot, changeName }));
    return;
  }

  if (command === "archive") {
    const [changeName] = positionals;
    if (!changeName) {
      throw new Error("Missing change name.");
    }
    print(
      await executeArchive({
        projectRoot,
        changeName,
        skipValidation: Boolean(options.skipValidation),
        skipSpecUpdates: Boolean(options.skipSpecUpdates),
        allowIncompleteTasks: Boolean(options.allowIncompleteTasks)
      })
    );
    return;
  }

  throw new Error(
    "Unknown command. Supported commands: init, new-change, status, instructions, validate-main, validate-delta, plan-archive, archive"
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
