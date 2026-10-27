import type {
  ImageCandidate,
  PixelImage,
} from "./image-matcher";

export type ReferenceImageSource = {
  key: string;
  url: string;
};

export type ReferenceLoadResult = {
  candidates: ImageCandidate[];
  failures: Array<{
    key: string;
    reason: string;
  }>;
};

export function validateReferenceDimensions(
  width: number,
  height: number,
): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 4096 ||
    height > 4096
  ) {
    throw new Error("Invalid reference image dimensions.");
  }
}

export function validateReferenceSources(
  sources: ReferenceImageSource[],
): void {
  const keys = new Set<string>();

  for (const source of sources) {
    if (!source.key.trim()) {
      throw new Error("Reference image key cannot be empty.");
    }

    if (keys.has(source.key)) {
      throw new Error("Duplicate reference image key.");
    }

    keys.add(source.key);

    if (
      !source.url.startsWith("/") &&
      !source.url.startsWith("data:image/")
    ) {
      throw new Error(
        "Reference images must use a local path or image data URL.",
      );
    }

    if (source.url.startsWith("//")) {
      throw new Error("Protocol-relative image URLs are not supported.");
    }
  }
}

export async function decodeReferenceImage(
  source: ReferenceImageSource,
  width: number,
  height: number,
): Promise<PixelImage> {
  validateReferenceDimensions(width, height);
  validateReferenceSources([source]);

  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Reference image request failed: ${response.status}`);
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      throw new Error("Unable to create reference image canvas.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(bitmap, 0, 0, width, height);

    const image = context.getImageData(0, 0, width, height);

    return {
      width,
      height,
      data: image.data,
    };
  } finally {
    bitmap.close();
  }
}

export async function loadReferenceCandidates(
  sources: ReferenceImageSource[],
  width: number,
  height: number,
): Promise<ReferenceLoadResult> {
  validateReferenceDimensions(width, height);
  validateReferenceSources(sources);

  const candidates: ImageCandidate[] = [];
  const failures: ReferenceLoadResult["failures"] = [];

  for (const source of sources) {
    try {
      const image = await decodeReferenceImage(
        source,
        width,
        height,
      );

      candidates.push({
        key: source.key,
        image,
      });
    } catch (cause) {
      failures.push({
        key: source.key,
        reason:
          cause instanceof Error
            ? cause.message
            : "Unknown reference image error.",
      });
    }
  }

  return {
    candidates,
    failures,
  };
}