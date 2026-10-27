import { createWorker, PSM } from "tesseract.js";
import { recoverEchoCost } from "./cost-recovery";
import { hasEchoText } from "./slot-presence";

export const CARD_WIDTH = 1920;
export const CARD_HEIGHT = 1080;
export const SLOT_COUNT = 5;

type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RecognizedField = {
  raw: string;
  value: string;
  autoRecovered?: boolean;
};

export type RecognizedSlot = {
  slot: number;
  presence?: "detected" | "empty";
  cost: RecognizedField;
  mainStat: RecognizedField;
  substats: RecognizedField[];
};

export type RecognitionResult = {
  width: number;
  height: number;
  slots: RecognizedSlot[];
  warnings: string[];
};

export type RecognitionProgress = {
  completed: number;
  total: number;
  label: string;
};

const SLOT_DISTANCE = 374;

function regionsForSlot(index: number) {
  const offset = index * SLOT_DISTANCE;

  return {
    cost: {
      x: 336 + offset,
      y: 674,
      width: 18,
      height: 24,
    },
    mainStat: {
      x: 215 + offset,
      y: 720,
      width: 173,
      height: 28,
    },
    substats: [
      { x: 64 + offset, y: 880, width: 320, height: 28 },
      { x: 64 + offset, y: 918, width: 320, height: 28 },
      { x: 64 + offset, y: 950, width: 320, height: 28 },
      { x: 64 + offset, y: 984, width: 320, height: 28 },
      { x: 64 + offset, y: 1019, width: 320, height: 28 },
    ],
  };
}

function cropRegion(
  source: HTMLCanvasElement,
  region: Rectangle,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  // Upscaling small regions can improve OCR legibility.
  const scale = 3;
  canvas.width = region.width * scale;
  canvas.height = region.height * scale;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("Unable to create image processing context.");
  }

  context.imageSmoothingEnabled = true;
  context.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const pixels = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];

    const gray = Math.round(
      0.299 * red + 0.587 * green + 0.114 * blue,
    );

    const adjusted = Math.max(
      0,
      Math.min(255, (gray - 128) * 1.5 + 128),
    );

    pixels.data[index] = adjusted;
    pixels.data[index + 1] = adjusted;
    pixels.data[index + 2] = adjusted;
  }

  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function decodeImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);

  try {
    if (
      bitmap.width !== CARD_WIDTH ||
      bitmap.height !== CARD_HEIGHT
    ) {
      throw new Error(
        `Unsupported image dimensions: ${bitmap.width} x ${bitmap.height}. ` +
        `This scanner requires ${CARD_WIDTH} x ${CARD_HEIGHT} build cards.`,
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to initialize image canvas.");
    }

    context.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

export async function recognizeBuildCard(
  file: File,
  onProgress?: (progress: RecognitionProgress) => void,
): Promise<RecognitionResult> {
  const image = await decodeImage(file);
  const total = SLOT_COUNT * 7;
  let completed = 0;

  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    workerBlobURL: false,
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ ",
    });

    async function read(
      region: Rectangle,
      label: string,
    ): Promise<RecognizedField> {
      const cropped = cropRegion(image, region);
      const output = await worker.recognize(cropped);
      const raw = output.data.text.trim();

      completed += 1;

      onProgress?.({
        completed,
        total,
        label,
      });

      return {
        raw,
        value: raw.replace(/\s+/g, " ").trim(),
      };
    }

    const slots: RecognizedSlot[] = [];
    const warnings: string[] = [];

    for (let index = 0; index < SLOT_COUNT; index += 1) {
      const regions = regionsForSlot(index);
      const slotNumber = index + 1;

      let cost = await read(
        regions.cost,
        `Echo ${slotNumber}: cost`,
      );

      const mainStat = await read(
        regions.mainStat,
        `Echo ${slotNumber}: main stat`,
      );

      const substats: RecognizedField[] = [];

      for (let line = 0; line < regions.substats.length; line += 1) {
        substats.push(
          await read(
            regions.substats[line],
            `Echo ${slotNumber}: substat ${line + 1}`,
          ),
        );
      }

      if (!/^[134]$/.test(cost.value) && hasEchoText("", mainStat.value, substats.map(stat => stat.value))) {
        onProgress?.({ completed, total, label: `Echo ${slotNumber}: retrying cost from image` });
        try {
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SINGLE_CHAR,
            tessedit_char_whitelist: "134",
            user_defined_dpi: "300",
          });
          cost = await recoverEchoCost(cost, async variant => {
            const region = variant === 0
              ? { x: regions.cost.x - 3, y: regions.cost.y - 3, width: 24, height: 30 }
              : regions.cost;
            const cropped = cropRegion(image, region);
            // A white border and inverted foreground avoid treating the tiny
            // digit as a complete line or clipping it against the crop edge.
            const padded = document.createElement("canvas");
            padded.width = cropped.width + 32;
            padded.height = cropped.height + 32;
            const context = padded.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error("Unable to retry cost recognition.");
            context.fillStyle = "white";
            context.fillRect(0, 0, padded.width, padded.height);
            context.filter = "invert(1)";
            context.drawImage(cropped, 16, 16);
            const output = await worker.recognize(padded);
            return { text: output.data.text, confidence: output.data.confidence };
          });
        } finally {
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SINGLE_LINE,
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ ",
          });
        }
      }

      if (!mainStat.value) {
        warnings.push(
          `Echo ${slotNumber}: main-stat label was not recognized.`,
        );
      }

      if (!["1", "3", "4"].includes(cost.value)) {
        warnings.push(
          `Echo ${slotNumber}: cost requires manual verification.`,
        );
      }

      const present = hasEchoText(cost.value, mainStat.value, substats.map(stat => stat.value));
      if (!present) warnings.push(`Echo ${slotNumber}: no equipped Echo text detected. A complete five-Echo card is required for submission.`);
      slots.push({
        slot: slotNumber,
        presence: present ? "detected" : "empty",
        cost,
        mainStat,
        substats,
      });
    }

    return {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      slots,
      warnings,
    };
  } finally {
    await worker.terminate();
  }
}
