import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const MAX_SIZES: Record<string, number> = {
  project: 200 * 1024 * 1024, // 200MB
  voice: 10 * 1024 * 1024, // 10MB
  story: 25 * 1024 * 1024, // 25MB
  avatar: 5 * 1024 * 1024, // 5MB
  banner: 8 * 1024 * 1024, // 8MB
  chat: 25 * 1024 * 1024 // 25MB — images/videos shared in DMs, groups, and channel posts
};

const CONTENT_TYPES: Record<string, string[]> = {
  project: ["application/zip", "application/x-zip-compressed", "application/vnd.android.package-archive", "application/octet-stream", "application/pdf"],
  voice: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"],
  story: ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm"],
  avatar: ["image/png", "image/jpeg", "image/webp"],
  banner: ["image/png", "image/jpeg", "image/webp"],
  chat: ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm"]
};

/**
 * This route does NOT receive the file itself — it's called by the browser
 * (via @vercel/blob/client's `upload()`) before and after a direct-to-Blob
 * upload. That avoids the ~4.5MB body limit on Vercel serverless functions,
 * which matters for project files that can be well over that.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to upload." }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "File uploads aren't configured yet. Add a Vercel Blob store and set BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    );
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const kind = (clientPayload ? JSON.parse(clientPayload).kind : "project") as string;
        const allowed = CONTENT_TYPES[kind] ?? CONTENT_TYPES.project;
        return {
          allowedContentTypes: allowed,
          maximumSizeInBytes: MAX_SIZES[kind] ?? MAX_SIZES.project,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id, kind })
        };
      },
      onUploadCompleted: async () => {
        // Nothing to persist server-side here — the caller saves the
        // returned blob URL onto the relevant record (Project, Message, Story).
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("Upload token generation failed:", err);
    return NextResponse.json({ error: "Could not start upload." }, { status: 400 });
  }
}
