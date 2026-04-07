/**
 * Normalize model options list, deduplicating and preserving order.
 *
 * @param {string[]} modelOptions - Available model names
 * @param {string} currentModel - Currently selected model (appended if not present)
 * @returns {string[]} Deduplicated model name list
 */
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
