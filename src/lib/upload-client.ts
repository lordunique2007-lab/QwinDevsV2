import { upload } from "@vercel/blob/client";

export type UploadKind = "project" | "voice" | "story" | "avatar" | "banner" | "chat";

export async function uploadFile(file: File, kind: UploadKind, onProgress?: (pct: number) => void) {
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    clientPayload: JSON.stringify({ kind }),
    onUploadProgress: (event) => onProgress?.(event.percentage)
  });

  return { url: blob.url, fileName: file.name, fileSize: file.size };
}
