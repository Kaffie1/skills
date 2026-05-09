export function buildExecutionBrief({
  requestText,
  classification,
  matchedCapability,
  environment = {},
  assumptions = []
}) {
  return {
    objective: requestText.trim(),
    classification,
    relatedCapability: matchedCapability
      ? {
          id: matchedCapability.id,
          title: matchedCapability.title,
          currentLogicSummary: matchedCapability.summary,
          specPath: matchedCapability.specPath
        }
      : null,
    constraints: [],
    successCriteria: [],
    environment: {
      development: environment.development || "",
      runtime: environment.runtime || "",
      verification: environment.verification || ""
    },
    assumptions
  };
}

export function buildRequirementTemplateFromBrief(brief) {
  return {
    title: brief.relatedCapability?.title || "<short feature title>",
    goal: brief.objective || "<one-paragraph summary of the user outcome this change should achieve>",
    scope: [],
    constraints: brief.constraints || [],
    acceptance_criteria: brief.successCriteria || [],
    assumptions: brief.assumptions || [],
    environment: brief.environment || {
      development: "",
      runtime: "",
      verification: ""
    },
    interfaces: {
      inputs: [],
      outputs: []
    },
    notes: []
  };
}
