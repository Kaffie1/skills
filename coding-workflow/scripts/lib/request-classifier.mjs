function normalize(text) {
  return text.toLowerCase();
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

export function classifyRequest({ requestText, inspectedCapabilities }) {
  const text = normalize(requestText || "");
  const topCapability = inspectedCapabilities.capabilities[0];
  const topScore = topCapability?.score ?? 0;
  const effectiveMatch = topScore >= 0.2 ? topCapability : null;

  const explicitModify = hasAny(text, [
    "修改",
    "改成",
    "变成",
    "调整",
    "修正",
    "replace",
    "change existing",
    "modify"
  ]);

  const explicitExtend = hasAny(text, [
    "增加",
    "新增",
    "支持",
    "扩展",
    "add",
    "extend",
    "support"
  ]);

  let classification = "new";
  if (topScore >= 0.2 && explicitModify) {
    classification = "modify";
  } else if (topScore >= 0.2 && explicitExtend) {
    classification = "extend";
  } else if (topScore >= 0.35) {
    classification = "modify";
  }

  return {
    classification,
    matchedCapability: effectiveMatch
      ? {
          id: effectiveMatch.id,
          title: effectiveMatch.title,
          score: effectiveMatch.score,
          specPath: effectiveMatch.specPath,
          summary: effectiveMatch.summary
        }
      : null
  };
}
