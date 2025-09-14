import { open, save } from "@tauri-apps/plugin-dialog";

export async function openProjectPicker(): Promise<string | null> { // Returns path or null
  return open({
    multiple: false,
    filters: [{ name: "Gebo Project", extensions: ["gebo"] }]
  }) as Promise<string | null>; // null or string, cannot be string[] as multiple == false
}

export async function saveProjectPicker(): Promise<string | null> {
  return save({
    filters: [{ name: "Gebo Project", extensions: ["gebo"] }]
  }) as Promise<string | null>; // null or string, cannot be string[] as multiple == false
}
