import {
  canvasToPixelImage,
  type ImageCandidate,
} from "./image-matcher";

import {
  loadReferenceCandidates,
  type ReferenceImageSource,
  type ReferenceLoadResult,
} from "./reference-image-loader";

import {
  recognizeFromCandidates,
  validateRecognitionPolicy,
  type RecognitionDecision,
  type RecognitionPolicy,
} from "./visual-recognition";

import {
  extractEchoVisuals,
} from "./portrait-regions";

import {
  preprocessVisualCanvas,
} from "./visual-image-preprocessing";

import {
  ECHO_REFERENCES,
  SONATA_REFERENCES,
} from "./visual-reference-catalog";

export type EchoSonataRecognitionPolicies = {
  echo: RecognitionPolicy;
  sonata: RecognitionPolicy;
};

export type EchoSonataReferenceCatalogs = {
  echo: ReferenceImageSource[];
  sonata: ReferenceImageSource[];
};

export type EchoSonataSlotResult = {
  slot: number;
  echo: RecognitionDecision;
  sonata: RecognitionDecision;
};

export type EchoSonataRecognitionResult = {
  slots: EchoSonataSlotResult[];
  referenceFailures: {
    echo: ReferenceLoadResult["failures"];
    sonata: ReferenceLoadResult["failures"];
  };
};

export async function recognizeEchoSonataBuildCard(
  source: CanvasImageSource,
  width: number,
  height: number,
  policies: EchoSonataRecognitionPolicies,
  references: EchoSonataReferenceCatalogs = {
    echo: ECHO_REFERENCES,
    sonata: SONATA_REFERENCES,
  },
): Promise<EchoSonataRecognitionResult> {
  validateRecognitionPolicy(policies.echo);
  validateRecognitionPolicy(policies.sonata);

  const regions = extractEchoVisuals(
    source,
    width,
    height,
  );

  const prepared = regions.map((region) => ({
    slot: region.slot,
    echo: canvasToPixelImage(
      preprocessVisualCanvas(
        region.portrait,
        "echo",
      ),
    ),
    sonata: canvasToPixelImage(
      preprocessVisualCanvas(
        region.sonata,
        "sonata",
      ),
    ),
  }));

  const [echoLoaded, sonataLoaded] = await Promise.all([
    loadReferenceCandidates(
      references.echo,
      80,
      80,
    ),
    loadReferenceCandidates(
      references.sonata,
      32,
      32,
    ),
  ]);

  const recognize = (
    image: ImageCandidate["image"],
    candidates: ImageCandidate[],
    policy: RecognitionPolicy,
  ): RecognitionDecision =>
    recognizeFromCandidates(
      image,
      candidates,
      policy,
    );

  return {
    slots: prepared.map((region) => ({
      slot: region.slot,
      echo: recognize(
        region.echo,
        echoLoaded.candidates,
        policies.echo,
      ),
      sonata: recognize(
        region.sonata,
        sonataLoaded.candidates,
        policies.sonata,
      ),
    })),
    referenceFailures: {
      echo: echoLoaded.failures,
      sonata: sonataLoaded.failures,
    },
  };
}