export function extFromFileName(name, fallback = "jpg") {
  const match = String(name || "").trim().match(/\.([a-zA-Z0-9]{2,8})$/);
  return match?.[1] ? match[1].toLowerCase() : fallback;
}

export function inferImageMimeType(file) {
  const declared = String(file?.type || "").trim().toLowerCase();
  if (declared) return declared;
  const ext = extFromFileName(file?.name, "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "";
}

export function preferredImageExtensionForMimeType(mimeType, fallback = "jpg") {
  const normalized = String(mimeType || "").trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/heic") return "heic";
  if (normalized === "image/heif") return "heif";
  return fallback;
}

export async function buildNativeSafeImageUploadPayload(file) {
  const normalizedFile = file instanceof File ? file : null;
  if (!normalizedFile) return null;
  const contentType = inferImageMimeType(normalizedFile) || undefined;
  const fallbackPayload = async () => {
    try {
      const bytes = await normalizedFile.arrayBuffer();
      return {
        body: new Blob([bytes], { type: contentType || "application/octet-stream" }),
        contentType,
        ext: preferredImageExtensionForMimeType(contentType, extFromFileName(normalizedFile.name, "jpg")),
      };
    } catch {
      return {
        body: normalizedFile,
        contentType,
        ext: preferredImageExtensionForMimeType(contentType, extFromFileName(normalizedFile.name, "jpg")),
      };
    }
  };

  if (
    typeof window !== "undefined"
    && typeof document !== "undefined"
    && typeof URL !== "undefined"
    && String(contentType || "").startsWith("image/")
  ) {
    let objectUrl = "";
    try {
      objectUrl = URL.createObjectURL(normalizedFile);
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("image_load_failed"));
        element.src = objectUrl;
      });
      const naturalWidth = Number(image?.naturalWidth || 0);
      const naturalHeight = Number(image?.naturalHeight || 0);
      if (naturalWidth > 0 && naturalHeight > 0) {
        const maxDimension = 2048;
        const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
        const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
        const targetHeight = Math.max(1, Math.round(naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
          const jpegBlob = await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.86);
          });
          if (jpegBlob) {
            return {
              body: jpegBlob,
              contentType: "image/jpeg",
              ext: "jpg",
            };
          }
        }
      }
    } catch {
      // Fall back to raw file bytes when image normalization is unavailable.
    } finally {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // Ignore object URL cleanup failures.
        }
      }
    }
  }

  return fallbackPayload();
}

export function validateStrongPassword(password) {
  const value = String(password || "");
  if (value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!/[^A-Za-z0-9]/.test(value)) return false;
  return true;
}
