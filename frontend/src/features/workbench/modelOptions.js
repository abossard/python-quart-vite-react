export function buildModelOptions(modelOptions, currentModel) {
  const seen = new Set();
  const normalized = [];
  for (const modelName of [...modelOptions, currentModel]) {
    if (typeof modelName !== "string") continue;
    const value = modelName.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}
