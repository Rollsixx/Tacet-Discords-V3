export type VisualRegionKind = "echo" | "sonata";

export type PreprocessingConfig = {
  width: number;
  height: number;
  background: [number, number, number];
};

export const ECHO_PREPROCESSING: PreprocessingConfig = {
  width: 80,
  height: 80,
  background: [0, 0, 0],
};

export const SONATA_PREPROCESSING: PreprocessingConfig = {
  width: 32,
  height: 32,
  background: [40, 40, 40],
};

export function getPreprocessingConfig(
  kind: VisualRegionKind,
): PreprocessingConfig {
  return kind === "echo"
    ? ECHO_PREPROCESSING
    : SONATA_PREPROCESSING;
}

export function validatePreprocessingConfig(
  config: PreprocessingConfig,
): void {
  if (
    !Number.isSafeInteger(config.width) ||
    !Number.isSafeInteger(config.height) ||
    config.width < 1 ||
    config.height < 1 ||
    config.width > 4096 ||
    config.height > 4096
  ) {
    throw new Error("Invalid preprocessing dimensions.");
  }

  if (
    config.background.length !== 3 ||
    config.background.some(
      (channel) =>
        !Number.isInteger(channel) ||
        channel < 0 ||
        channel > 255,
    )
  ) {
    throw new Error("Invalid preprocessing background.");
  }
}

export function preprocessVisualCanvas(
  source: HTMLCanvasElement,
  kind: VisualRegionKind,
): HTMLCanvasElement {
  const config = getPreprocessingConfig(kind);

  validatePreprocessingConfig(config);

  if (source.width < 1 || source.height < 1) {
    throw new Error("Source canvas is empty.");
  }

  const result = document.createElement("canvas");

  result.width = config.width;
  result.height = config.height;

  const context = result.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("Unable to create preprocessing context.");
  }

  const [r, g, b] = config.background;

  context.fillStyle = `rgb(${r}, ${g}, ${b})`;
  context.fillRect(0, 0, config.width, config.height);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(
    source,
    0,
    0,
    source.width,
    source.height,
    0,
    0,
    config.width,
    config.height,
  );

  return result;
}