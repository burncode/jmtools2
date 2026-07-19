export function parsePaletteColorsParam(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      return [];
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  return [];
}

export function parseArtReferences(params: Record<string, unknown>): string[] {
  const raw = params.artReferences;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  const legacy = params.artReference;
  if (typeof legacy === "string" && legacy.trim()) {
    return [legacy.trim()];
  }

  return [];
}

export function resolveProjectImagePath(projectRoot: string, path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }

  if (/^[a-zA-Z]:[/\\]/.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed.replace(/\\/g, "/");
  }

  if (!projectRoot.trim()) {
    return trimmed;
  }

  const normalizedRoot = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedPath = trimmed.replace(/^[/\\]+/, "");
  return `${normalizedRoot}/${normalizedPath}`.replace(/\\/g, "/");
}

export function toProjectRelativePath(projectRoot: string, absolutePath: string): string {
  const normalizedRoot = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedPath = absolutePath.replace(/\\/g, "/");

  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }

  return absolutePath;
}
