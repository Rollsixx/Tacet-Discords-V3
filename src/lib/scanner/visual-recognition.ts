import {
  canvasToPixelImage,
  rankImageCandidates,
  type ImageCandidate,
  type RankedImageMatch,
} from "./image-matcher";

import {
  loadReferenceCandidates,
  type ReferenceImageSource,
} from "./reference-image-loader";

export type RecognitionPolicy = {
  maximumDifference: number;
  minimumMargin: number;
};

export type RecognitionDecision = {
  status: "matched" | "ambiguous" | "unknown";
  key: string | null;
  ranked: RankedImageMatch[];
};

export type VisualRecognitionResult = RecognitionDecision & {
  referenceFailures: Array<{
    key: string;
    reason: string;
  }>;
};

export function validateRecognitionPolicy(
  policy: RecognitionPolicy,
): void {
  if (
    !Number.isFinite(policy.maximumDifference) ||
    !Number.isFinite(policy.minimumMargin) ||
    policy.maximumDifference < 0 ||
    policy.maximumDifference > 1 ||
    policy.minimumMargin < 0 ||
    policy.minimumMargin > 1
  ) {
    throw new Error("Invalid recognition acceptance policy.");
  }
}

export function decideImageMatch(
  ranked: RankedImageMatch[],
  policy: RecognitionPolicy,
): RecognitionDecision {
  validateRecognitionPolicy(policy);

  if (ranked.length === 0) {
    return {
      status: "unknown",
      key: null,
      ranked,
    };
  }

  const best = ranked[0];

  if (
    !Number.isFinite(best.difference) ||
    best.difference > policy.maximumDifference
  ) {
    return {
      status: "unknown",
      key: null,
      ranked,
    };
  }

  if (ranked.length > 1) {
    const second = ranked[1];

    if (
      !Number.isFinite(second.difference) ||
      second.difference - best.difference < policy.minimumMargin
    ) {
      return {
        status: "ambiguous",
        key: null,
        ranked,
      };
    }
  }

  return {
    status: "matched",
    key: best.key,
    ranked,
  };
}

export function recognizeFromCandidates(
  source: ImageCandidate["image"],
  candidates: ImageCandidate[],
  policy: RecognitionPolicy,
): RecognitionDecision {
  return decideImageMatch(
    rankImageCandidates(source, candidates),
    policy,
  );
}

export async function recognizeVisualRegion(
  canvas: HTMLCanvasElement,
  references: ReferenceImageSource[],
  policy: RecognitionPolicy,
): Promise<VisualRecognitionResult> {
  validateRecognitionPolicy(policy);

  const source = canvasToPixelImage(canvas);

  const loaded = await loadReferenceCandidates(
    references,
    source.width,
    source.height,
  );

  const decision = recognizeFromCandidates(
    source,
    loaded.candidates,
    policy,
  );

  return {
    ...decision,
    referenceFailures: loaded.failures,
  };
}