export type PixelImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type ImageCandidate = {
  key: string;
  image: PixelImage;
};

export type RankedImageMatch = {
  key: string;
  difference: number;
};

function validateImage(image: PixelImage): void {
  if (
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.data.length !== image.width * image.height * 4
  ) {
    throw new Error("Invalid RGBA image dimensions or pixel data.");
  }
}

function luminance(data: Uint8ClampedArray, offset: number): number {
  return (
    data[offset] * 0.2126 +
    data[offset + 1] * 0.7152 +
    data[offset + 2] * 0.0722
  ) / 255;
}

export function comparePixelImages(
  source: PixelImage,
  reference: PixelImage,
): number {
  validateImage(source);
  validateImage(reference);

  if (
    source.width !== reference.width ||
    source.height !== reference.height
  ) {
    throw new Error("Images must have matching dimensions.");
  }

  let colorDifference = 0;
  let edgeDifference = 0;
  let edgeSamples = 0;
  const pixels = source.width * source.height;

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const offset = (y * source.width + x) * 4;

      for (let channel = 0; channel < 3; channel++) {
        const delta =
          (source.data[offset + channel] -
            reference.data[offset + channel]) / 255;

        colorDifference += delta * delta;
      }

      const alphaDelta =
        (source.data[offset + 3] - reference.data[offset + 3]) / 255;

      colorDifference += alphaDelta * alphaDelta;

      if (x > 0) {
        const previous = offset - 4;

        const sourceEdge =
          luminance(source.data, offset) -
          luminance(source.data, previous);

        const referenceEdge =
          luminance(reference.data, offset) -
          luminance(reference.data, previous);

        edgeDifference += Math.abs(sourceEdge - referenceEdge);
        edgeSamples++;
      }

      if (y > 0) {
        const above = offset - source.width * 4;

        const sourceEdge =
          luminance(source.data, offset) -
          luminance(source.data, above);

        const referenceEdge =
          luminance(reference.data, offset) -
          luminance(reference.data, above);

        edgeDifference += Math.abs(sourceEdge - referenceEdge);
        edgeSamples++;
      }
    }
  }

  const normalizedColor = colorDifference / (pixels * 4);
  const normalizedEdges =
    edgeSamples > 0 ? edgeDifference / edgeSamples : 0;

  return normalizedColor * 0.5 + normalizedEdges * 0.5;
}

export function rankImageCandidates(
  source: PixelImage,
  candidates: ImageCandidate[],
): RankedImageMatch[] {
  validateImage(source);

  const seen = new Set<string>();

  return candidates.map(candidate => {
    if (!candidate.key.trim() || seen.has(candidate.key)) {
      throw new Error("Candidate keys must be unique and nonempty.");
    }

    seen.add(candidate.key);

    return {
      key: candidate.key,
      difference: comparePixelImages(source, candidate.image),
    };
  }).sort((a, b) =>
    a.difference - b.difference ||
    a.key.localeCompare(b.key),
  );
}

export function canvasToPixelImage(
  canvas: HTMLCanvasElement,
): PixelImage {
  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("Unable to read canvas pixels.");
  }

  const image = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return {
    width: image.width,
    height: image.height,
    data: image.data,
  };
}