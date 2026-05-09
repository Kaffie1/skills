#!/usr/bin/env node
import { inspectCapabilities } from "./lib/capability-inspector.mjs";
import { classifyRequest } from "./lib/request-classifier.mjs";
import { buildExecutionBrief, buildRequirementTemplateFromBrief } from "./lib/requirement-normalizer.mjs";

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

async function main() {
  const { command, options, positionals } = parseArgs(process.argv.slice(2));
  const projectRoot = options.projectRoot || process.cwd();
  const requestText = options.request || positionals.join(" ").trim();

  if (!requestText && command !== "inspect") {
    throw new Error("Missing request text. Pass --request '<text>' or provide trailing text.");
  }

  if (command === "inspect") {
    print(await inspectCapabilities({ projectRoot, requestText }));
    return;
  }

  if (command === "classify") {
    const inspected = await inspectCapabilities({ projectRoot, requestText });
    print({
      inspected,
      classification: classifyRequest({ requestText, inspectedCapabilities: inspected })
    });
    return;
  }

  if (command === "brief") {
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
      assumptions: options.assumptions ? String(options.assumptions).split("|").map((item) => item.trim()).filter(Boolean) : []
    });
    print({
      inspected,
      classification,
      brief,
      requirementTemplate: buildRequirementTemplateFromBrief(brief)
    });
    return;
  }

  throw new Error("Unknown command. Supported commands: inspect, classify, brief");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
