/*
 * Generic Base64 RGB image decoder.
 * No third-party image data or game artwork is included.
 */

export type DecodedRgbImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export function validateRgbDimensions(
  width: number,
  height: number,
): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096 ||
    width * height > 16777216
  ) {
    throw new Error("Invalid RGB image dimensions.");
  }
}

export function decodeBase64Rgb(
  encoded: string,
  width: number,
  height: number,
): DecodedRgbImage {
  validateRgbDimensions(width, height);

  const expectedBytes = width * height * 3;
  const expectedCharacters =
    Math.ceil(expectedBytes / 3) * 4;

  if (
    encoded.length !== expectedCharacters ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  ) {
    throw new Error("Invalid Base64 RGB payload.");
  }

  const binary = atob(encoded);

  if (binary.length !== expectedBytes) {
    throw new Error("Unexpected decoded RGB byte count.");
  }

  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let pixel = 0; pixel < width * height; pixel++) {
    const rgbOffset = pixel * 3;
    const rgbaOffset = pixel * 4;

    rgba[rgbaOffset] = binary.charCodeAt(rgbOffset);
    rgba[rgbaOffset + 1] = binary.charCodeAt(rgbOffset + 1);
    rgba[rgbaOffset + 2] = binary.charCodeAt(rgbOffset + 2);
    rgba[rgbaOffset + 3] = 255;
  }

  return {
    width,
    height,
    data: rgba,
  };
}

export function decodeSonataReference(
  encoded: string,
): DecodedRgbImage {
  return decodeBase64Rgb(encoded, 32, 32);
}