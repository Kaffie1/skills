export function slugifyChangeName(input) {
  const normalized = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  if (!normalized) {
    return "new-change";
  }

  const asciiOnly = normalized
    .replace(/[\u4e00-\u9fff]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const base = asciiOnly || "feature";
  return base.startsWith("add-") || base.startsWith("update-") || base.startsWith("modify-")
    ? base.slice(0, 63)
    : `add-${base}`.slice(0, 63);
}
