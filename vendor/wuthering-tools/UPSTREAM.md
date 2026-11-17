# Reference scoring source

Upstream: https://github.com/ryanbenson/wuthering-waves-optimizer

Commit: b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5

License: GPL-3.0-or-later. Upstream authors retain copyright. See COPYING.

scoring-source.tar.gz contains the corresponding calculator, character, weapon, Echo, buff, formula and utility source plus the export entry point and upstream Carlotta reference cases. source-manifest.json pins its SHA-256. scripts/build-scoring-engine.mjs verifies and extracts it, generates explicit import maps in place of Vite-only discovery, and bundles for Node with esbuild. Host adapters are src/lib/server/scoring.mjs and source-evidence.mjs; derived tables and fixtures are src/lib/game-data. These integrated scoring components and derived data are GPL-3.0-or-later. Preserve source availability, copyright notices and license terms when distributing this integration. Game artwork is not included.

## Rotation-management integration (2026-10-28)

The server-side adapter now accepts a versioned, server-validated action sequence and, for owner-reviewed benchmarks or verified mechanics adapters, bounded per-action optimizer buff overrides. Draft authoring, mechanics validation, staging and activation source is tracked under `src/lib/server/rotations` with GPL-3.0-or-later notices. The upstream archive remains unchanged. No engine is shipped in browser JavaScript. Existing baseline presets are not represented as complete combat simulations. See `docs/ROTATION_MANAGEMENT.md` for source boundaries and the explicit distinction between owner-reviewed benchmarks and automatic mechanics integration.

## Version 3.8 catalog addition

`catalog-3.8-source.tar.gz` contains Lily's kit and Lullaby's weapon definition from upstream commit `43db5de8b9151f81e64c97e0d7785983ebbafa8e`, plus their upstream registry entries. The source manifest records the overlay checksum. The original calculator archive still supplies existing ranking inputs and the other imported Resonator kits.

All 65 upstream character keys are now included, counting Rover's element and appearance variants as separate keys. New entries use the existing owner-publication workflow before ranking. A kit with a declared signature uses that weapon. For kits without a declared signature, the benchmark editor uses the matching permanent Convene five-star at R1. This benchmark weapon is independent from the weapon recorded on a build profile.

The November 17 upstream registries were also compared against the existing 230 Echo identities and 37 Sonata sets. The newer source contains the same identities and sets. Existing effect keys and fingerprints are retained for compatibility with published benchmarks.
