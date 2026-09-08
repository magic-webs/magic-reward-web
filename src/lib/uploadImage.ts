import type { NextRequest } from "next/server";
import { api, convex, type Id } from "@/lib/convex";

// Convex uploads are two steps rather than Instant's single
// `storage.uploadFile`: mint a short-lived signed URL, POST the bytes
// straight to it, and get back a storage id to attach. That keeps file
// bytes off the function transport, at the cost of the route doing the POST.
//
// Instant overwrote by a fixed path, so re-uploading replaced the old blob
// implicitly. Convex creates a new object every time, so the mutations that
// attach these (companies.setImage, offers.setImage, prizes.setIcon) delete
// the one they replace.
export async function uploadToStorage(file: File): Promise<Id<"_storage">> {
  const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`Storage upload failed with status ${res.status}.`);
  }

  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
  return storageId;
}

// An attach route accepts the image one of two ways. Multipart relays the
// bytes through the route, which is fine for the artwork the web admin
// picks. A `storageId` in a JSON body is for bytes the client already
// PUT straight to Convex storage: the serverless request body is capped at
// 4.5MB, which a phone's full-resolution photo clears easily, so mobile
// never sends the file through here at all.
export async function resolveStorageId(req: NextRequest): Promise<Id<"_storage"> | null> {
  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { storageId?: unknown } | null;
    const storageId = body?.storageId;
    return typeof storageId === "string" && storageId ? (storageId as Id<"_storage">) : null;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return null;
  return uploadToStorage(file);
}
