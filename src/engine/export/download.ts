import { isTauri } from "../../platform";

function browserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function tauriSave(blob: Blob, filename: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const fs = await import("@tauri-apps/plugin-fs");
    const path = await dialog.save({
      defaultPath: filename,
      filters: [{ name: "檔案", extensions: [filename.split(".").pop() ?? "*"] }],
    });
    if (!path) return true; // 使用者取消，視為已處理
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await fs.writeFile(path, bytes);
    return true;
  } catch {
    return false;
  }
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const handled = await tauriSave(blob, filename);
  if (!handled) browserDownload(blob, filename);
}

export async function downloadText(text: string, filename: string, mime = "text/plain"): Promise<void> {
  await downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}
