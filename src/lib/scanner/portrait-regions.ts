export const BUILD_CARD_SIZE = {
  width: 1920,
  height: 1080,
} as const;

export const ECHO_SLOT_COUNT = 5;

export type ImageRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EchoVisualRegions = {
  slot: number;
  portrait: ImageRegion;
  sonata: ImageRegion;
};

export function getEchoVisualRegions(): EchoVisualRegions[] {
  return Array.from({ length: ECHO_SLOT_COUNT }, (_, index) => {
    const offset = index * 374;

    return {
      slot: index + 1,
      portrait: {
        x: 22 + offset,
        y: 650,
        width: 192,
        height: 182,
      },
      sonata: {
        x: 264 + offset,
        y: 660,
        width: 56,
        height: 56,
      },
    };
  });
}

export function isSupportedBuildCard(
  width: number,
  height: number,
): boolean {
  return (
    width === BUILD_CARD_SIZE.width &&
    height === BUILD_CARD_SIZE.height
  );
}

export function isRegionInsideCard(region: ImageRegion): boolean {
  return (
    Number.isInteger(region.x) &&
    Number.isInteger(region.y) &&
    Number.isInteger(region.width) &&
    Number.isInteger(region.height) &&
    region.x >= 0 &&
    region.y >= 0 &&
    region.width > 0 &&
    region.height > 0 &&
    region.x + region.width <= BUILD_CARD_SIZE.width &&
    region.y + region.height <= BUILD_CARD_SIZE.height
  );
}

export function extractImageRegion(
  source: CanvasImageSource,
  region: ImageRegion,
): HTMLCanvasElement {
  if (!isRegionInsideCard(region)) {
    throw new Error("Image region is outside the build card.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = region.width;
  canvas.height = region.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create image extraction context.");
  }

  context.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  );

  return canvas;
}

export function extractEchoVisuals(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  if (!isSupportedBuildCard(width, height)) {
    throw new Error("Expected a 1920 x 1080 build card.");
  }

  return getEchoVisualRegions().map(({ slot, portrait, sonata }) => ({
    slot,
    portrait: extractImageRegion(source, portrait),
    sonata: extractImageRegion(source, sonata),
  }));
}