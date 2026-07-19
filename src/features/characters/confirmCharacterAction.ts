import { confirm } from "@tauri-apps/plugin-dialog";

export async function confirmCharacterAction(message: string, title = "确认操作"): Promise<boolean> {
  return confirm(message, { kind: "warning", title });
}
