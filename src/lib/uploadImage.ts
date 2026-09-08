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
