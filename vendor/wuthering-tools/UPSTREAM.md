# Reference scoring source

Upstream: https://github.com/ryanbenson/wuthering-waves-optimizer

Commit: b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5

License: GPL-3.0-or-later. Upstream authors retain copyright. See COPYING.

scoring-source.tar.gz contains the corresponding calculator, character, weapon, Echo, buff, formula and utility source plus the export entry point and upstream Carlotta reference cases. source-manifest.json pins its SHA-256. scripts/build-scoring-engine.mjs verifies and extracts it, generates explicit import maps in place of Vite-only discovery, and bundles for Node with esbuild. Host adapters are src/lib/server/scoring.mjs and source-evidence.mjs; derived tables and fixtures are src/lib/game-data. These integrated scoring components and derived data are GPL-3.0-or-later. Preserve source availability, copyright notices and license terms when distributing this integration. Game artwork is not included.

## Rotation-management integration (2026-10-28)

The server-side adapter now accepts a versioned, server-validated action sequence and, only for verified mechanics adapters, per-action optimizer buff overrides. Draft authoring, mechanics validation, staging and activation source is tracked under `src/lib/server/rotations` with GPL-3.0-or-later notices. The upstream archive remains unchanged. No engine is shipped in browser JavaScript. Existing baseline presets are not represented as complete combat simulations. See `docs/ROTATION_MANAGEMENT.md` for source boundaries and outstanding verified mechanics integrations.
