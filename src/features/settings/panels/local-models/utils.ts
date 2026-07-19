export function formatBytesLabel(bytes?: number | null) {
  if (bytes == null || bytes <= 0) {
    return "";
  }

  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatSpeedLabel(bytesPerSec?: number | null) {
  if (bytesPerSec == null || bytesPerSec <= 0) {
    return "";
  }

  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  }

  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }

  return `${bytesPerSec} B/s`;
}

export function truncatePath(path: string, max = 48) {
  if (path.length <= max) {
    return path;
  }

  return `…${path.slice(-max + 1)}`;
}

export function stageLabel(stage?: string | null) {
  switch (stage) {
    case "downloading":
      return "下载中";
    case "extracting":
      return "解压中";
    case "verifying":
      return "校验中";
    case "copying":
      return "复制中";
    case "paused":
      return "已暂停";
    default:
      return stage ?? "";
  }
}
