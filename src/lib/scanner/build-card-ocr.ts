import {CARD_HEADERS,recoverCardUid,playerTextWidth,uidTextWidth} from "./card-layout";
import {legalSubstatKey,mainStatKey,normalizeSubstatReading,parseSubstatBlock,recoverStatReading} from "./ocr-readings";
import { createWorker, PSM } from "tesseract.js";
import { recoverEchoCost } from "./cost-recovery";
import { parseCardIdentity, type CardIdentity } from "./card-identity";
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
  identity: CardIdentity;
};

export type RecognitionProgress = {
  completed: number;
  total: number;
  label: string;
  identity?: CardIdentity;
  slots?: RecognizedSlot[];
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
    substatBlock: { x: 56 + offset, y: 872, width: 334, height: 194 },
  };
}

function cropRegion(
  source: HTMLCanvasElement,
  region: Rectangle,
  scale = 3,
  threshold = false,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  // Upscaling small regions can improve OCR legibility.
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

    const adjusted = threshold ? (gray >= 158 ? 255 : 0) : Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));

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
  const total = SLOT_COUNT * 7 + 3;
  let identity: CardIdentity | undefined;
  const slots: RecognizedSlot[] = [];
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
        identity,
        slots: [...slots],
      });

      return {
        raw,
        value: raw.replace(/\s+/g, " ").trim(),
      };
    }

    await worker.setParameters({ tessedit_char_whitelist: "" });
    const characterHeader = await read(CARD_HEADERS.character, "Character");
    const playerPixels=image.getContext("2d",{willReadFrequently:true})!.getImageData(CARD_HEADERS.player.x,CARD_HEADERS.player.y,CARD_HEADERS.player.width,CARD_HEADERS.player.height);
    const playerRegion={...CARD_HEADERS.player,width:playerTextWidth(playerPixels.data,playerPixels.width,playerPixels.height)};
    const playerHeader = await read(playerRegion, "In-game name");
    const uidHeader = await read(CARD_HEADERS.uid, "UID");
    const uidPixels=image.getContext("2d",{willReadFrequently:true})!.getImageData(CARD_HEADERS.uidDigits.x,CARD_HEADERS.uidDigits.y,CARD_HEADERS.uidDigits.width,CARD_HEADERS.uidDigits.height);
    const uidRegion={...CARD_HEADERS.uidDigits,width:uidTextWidth(uidPixels.data,uidPixels.width,uidPixels.height)};
    const uid=await recoverCardUid(uidHeader.value,async variant=>{
      onProgress?.({completed,total,label:"Retrying UID from the screenshot"});
      await worker.setParameters({tessedit_char_whitelist:"0123456789",tessedit_pageseg_mode:PSM.SINGLE_LINE});
      const result=(await worker.recognize(cropRegion(image,uidRegion,variant===0?3:4))).data;
      return {text:result.text,confidence:result.confidence};
    });
    identity = {...parseCardIdentity(characterHeader.value, playerHeader.value, uidHeader.value),uid};
    onProgress?.({ completed, total, label: "Player details scanned", identity, slots: [] });
    await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ " });
    const warnings: string[] = [];
    let statRetries=0;
    async function retryField(field:RecognizedField,region:Rectangle,key:(raw:string)=>string|null,label:string){
      // Retry every unreadable field: the prior global cap stopped after only
      // six failed fields, leaving later Echoes unparsed on difficult cards.
      if(key(field.value)||statRetries>=60)return field;
      statRetries+=2;onProgress?.({completed,total,label:"Retrying "+label,identity,slots:[...slots]});
      return recoverStatReading(field,async variant=>(await worker.recognize(cropRegion(image,region,variant===0?4:5,variant===1))).data.text,key);
    }

    async function recoverWrappedSubstats(fields:RecognizedField[],region:Rectangle,slotNumber:number){
      if(fields.every(field=>normalizeSubstatReading(field.value)))return fields;
      onProgress?.({completed,total,label:"Echo "+slotNumber+": checking wrapped substat lines",identity,slots:[...slots]});
      const readings=[];
      try{
        for(let variant=0;variant<2;variant+=1){
          await worker.setParameters({
            tessedit_pageseg_mode:PSM.SINGLE_BLOCK,
            tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ ",
          });
          const result=await worker.recognize(cropRegion(image,region,variant===0?4:5,variant===1));
          readings.push(parseSubstatBlock(result.data.text));
        }
      }finally{
        await worker.setParameters({
          tessedit_pageseg_mode:PSM.SINGLE_LINE,
          tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%+ ",
        });
      }
      const [first,second]=readings;
      if(!first||!second||first.length!==5||second.length!==5)return fields;
      const signature=(value:{name:string;amount:number;percent:boolean})=>value.name+":"+(value.percent?"percent":"flat")+":"+value.amount;
      if(first.some((value,index)=>signature(value.stat)!==signature(second[index].stat)))return fields;
      const keys=first.map(value=>value.stat.name+(value.stat.percent?":percent":":flat"));
      if(new Set(keys).size!==5)return fields;

      // Keep every trustworthy narrow-crop reading as an anchor. Wrapped rows
      // may shift later lines down, so anchors must match in order, not at the
      // same crop index. The two complete block reads must agree on all five.
      let cursor=0;
      for(const field of fields){
        const original=normalizeSubstatReading(field.value);
        if(!original)continue;
        const found=first.findIndex((candidate,index)=>index>=cursor&&signature(candidate.stat)===signature(original.stat));
        if(found<0)return fields;
        cursor=found+1;
      }
      return first.map((candidate,index)=>{
        const field=fields[index];
        const original=normalizeSubstatReading(field.value);
        if(original&&signature(original.stat)===signature(candidate.stat))return field;
        const raw=field.raw?field.raw+" | block OCR: "+candidate.raw:candidate.raw;
        return {raw,value:candidate.value,autoRecovered:true};
      });
    }

    for (let index = 0; index < SLOT_COUNT; index += 1) {
      const regions = regionsForSlot(index);
      const slotNumber = index + 1;

      let cost = await read(
        regions.cost,
        `Echo ${slotNumber}: cost`,
      );

      const mainStat = await retryField(await read(regions.mainStat,`Echo ${slotNumber}: main stat`),regions.mainStat,mainStatKey,`Echo ${slotNumber} main stat`);

      let substats: RecognizedField[] = [];

      for (let line = 0; line < regions.substats.length; line += 1) {
        substats.push(
          await retryField(await read(regions.substats[line],`Echo ${slotNumber}: substat ${line + 1}`),regions.substats[line],legalSubstatKey,`Echo ${slotNumber} substat ${line + 1}`),
        );
      }

      substats=await recoverWrappedSubstats(substats,regions.substatBlock,slotNumber);

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
      onProgress?.({ completed, total, label: `Echo ${slotNumber} scanned`, identity, slots: [...slots] });
    }

    return {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      slots,
      warnings,
      identity,
    };
  } finally {
    await worker.terminate();
  }
}
