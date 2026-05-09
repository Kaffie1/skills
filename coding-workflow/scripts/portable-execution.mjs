#!/usr/bin/env node
import path from "path";
import { inspectCapabilities } from "./lib/capability-inspector.mjs";
import { slugifyChangeName } from "./lib/change-name.mjs";
import { classifyRequest } from "./lib/request-classifier.mjs";
import { buildExecutionBrief, buildRequirementTemplateFromBrief } from "./lib/requirement-normalizer.mjs";
import { ensureDir, writeFile } from "./lib/utils.mjs";
import { createChange, ensureInitialized, getInstructions, getStatus } from "./lib/workflow-engine.mjs";
import { renderYaml } from "./lib/yamlish.mjs";

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

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function buildBundle({ projectRoot, requestText, options }) {
  const inspected = await inspectCapabilities({ projectRoot, requestText });
  const classification = classifyRequest({ requestText, inspectedCapabilities: inspected });
  const brief = buildExecutionBrief({
    requestText,
    classification: classification.classification,
    matchedCapability: classification.matchedCapability,
    environment: {
      development: options.development || "",
      runtime: options.runtime || "",
      verification: options.verification || ""
    },
    assumptions: options.assumptions
      ? String(options.assumptions)
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean)
      : []
  });
  const requirementTemplate = buildRequirementTemplateFromBrief(brief);
  const suggestedChangeName =
    options.changeName ||
    (classification.matchedCapability
      ? `${classification.classification}-${classification.matchedCapability.id}`
      : slugifyChangeName(requestText));

  return {
    inspected,
    classification,
    brief,
    requirementTemplate,
    suggestedChangeName
  };
}

async function bootstrapChange({ projectRoot, bundle }) {
  const initResult = await ensureInitialized(projectRoot);
  const createResult = await createChange({
    projectRoot,
    changeName: bundle.suggestedChangeName
  });
  const requirementPath = path.join(projectRoot, "requirement-template.yaml");
  await ensureDir(path.dirname(requirementPath));
  await writeFile(requirementPath, `${renderYaml(bundle.requirementTemplate)}\n`);
  const status = await getStatus({
    projectRoot,
    changeName: bundle.suggestedChangeName
  });
  const readyArtifacts = status.artifacts.filter((artifact) => artifact.status === "ready");
  const instructions = [];
  for (const artifact of readyArtifacts) {
    instructions.push(
      await getInstructions({
        projectRoot,
        changeName: bundle.suggestedChangeName,
        artifactId: artifact.id
      })
    );
  }
  return {
    initResult,
    createResult,
    requirementPath,
    status,
    instructions
  };
}

async function main() {
  const { command, options, positionals } = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const requestText = options.request || positionals.join(" ").trim();

  if (!requestText) {
    throw new Error("Missing request text. Pass --request '<text>' or provide trailing text.");
  }

  if (command === "plan") {
    print(await buildBundle({ projectRoot, requestText, options }));
    return;
  }

  if (command === "bootstrap-change") {
    const bundle = await buildBundle({ projectRoot, requestText, options });
    const bootstrap = await bootstrapChange({ projectRoot, bundle });
    print({
      bundle,
      bootstrap
    });
    return;
  }

  throw new Error("Unknown command. Supported commands: plan, bootstrap-change");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
