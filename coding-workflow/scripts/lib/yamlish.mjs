function quoteIfNeeded(value) {
  const text = String(value ?? "");
  if (text === "" || /[:#[\]{}>|&*!%@`]/.test(text) || /^\s|\s$/.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}

function renderScalar(value, indent) {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return renderYaml(value, indent);
  }
  return quoteIfNeeded(value);
}

export function renderYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    return value
      .map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const body = renderYaml(item, indent + 2);
          return `${pad}- ${body.startsWith("\n") ? body.slice(1) : body}`.replace(/\n/g, `\n${" ".repeat(indent + 2)}`);
        }
        return `${pad}- ${renderScalar(item, indent + 2)}`;
      })
      .join("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }
    return entries
      .map(([key, item]) => {
        if (Array.isArray(item)) {
          if (item.length === 0) {
            return `${pad}${key}: []`;
          }
          return `${pad}${key}:\n${renderYaml(item, indent + 2)}`;
        }
        if (item && typeof item === "object") {
          return `${pad}${key}:\n${renderYaml(item, indent + 2)}`;
        }
        return `${pad}${key}: ${quoteIfNeeded(item)}`;
      })
      .join("\n");
  }

  return `${pad}${quoteIfNeeded(value)}`;
}
