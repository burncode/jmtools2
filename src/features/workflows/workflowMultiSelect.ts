/**
 * Multi-select 参数值以逗号分隔字符串存储，便于复用现有 string 参数管线。
 */

export function parseMultiSelectValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

export function serializeMultiSelectValue(values: string[]): string {
  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length > 0 && !unique.includes(trimmed)) {
      unique.push(trimmed);
    }
  }
  return unique.join(",");
}

export function toggleMultiSelectValue(values: string[], target: string): string[] {
  return values.includes(target) ? values.filter((item) => item !== target) : [...values, target];
}
