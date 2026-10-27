# Reference scoring source

Upstream: https://github.com/ryanbenson/wuthering-waves-optimizer

Commit: b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5

License: GPL-3.0-or-later. Upstream authors retain copyright. See COPYING.

scoring-source.tar.gz contains the corresponding calculator, character, weapon, Echo, buff, formula and utility source plus the export entry point and upstream Carlotta reference cases. source-manifest.json pins its SHA-256. scripts/build-scoring-engine.mjs verifies and extracts it, generates explicit import maps in place of Vite-only discovery, and bundles for Node with esbuild. Host adapters are src/lib/server/scoring.mjs and source-evidence.mjs; derived tables and fixtures are src/lib/game-data. These integrated scoring components and derived data are GPL-3.0-or-later. Preserve source availability, copyright notices and license terms when distributing this integration. Game artwork is not included.
