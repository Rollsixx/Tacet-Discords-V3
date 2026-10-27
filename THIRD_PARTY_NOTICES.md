# Third-party notices

- Tesseract.js 7.0.0 and Tesseract.js-core: Apache-2.0. Runtime assets are copied from installed packages during build; license texts are retained in public/ocr/TESSERACT_LICENSE.txt and public/ocr/core/LICENSE.
- @tesseract.js-data/eng 1.0.0: package declares MIT; English traineddata originates in the Tesseract/naptha tessdata ecosystem. Installed package metadata and source are available at https://github.com/naptha/tessdata.
- Playwright 1.51.1: Apache-2.0, development/browser verification only.
- Reference scoring engine and numeric game data: https://github.com/ryanbenson/wuthering-waves-optimizer at b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5, GPL-3.0-or-later. Copyright remains with upstream authors. Corresponding source, upstream license, hash manifest and modification notes are distributed under vendor/wuthering-tools. The build adapts Vite module discovery to Node through generated import maps. This integrated scoring component and its derived data are GPL-3.0-or-later; redistribution must preserve corresponding-source and license obligations. No Kuro game artwork is bundled with the engine. Visual recognition uses numerical fingerprints generated from the separately obtained asset checkout at e69260313edc04ca9b8ca1d52fec1bb485c6c1b1.

- The reference's real four-Echo screenshot is an external developer test fixture. Its immutable URL and SHA-256 are recorded in scripts/fetch-reference-fixture.mjs; it is downloaded only into ignored .cache and is not distributed in this repository, ZIP or public website. Character artwork/trademarks belong to their respective rights holders, including Kuro Games. The derived five-slot image exists only inside the browser test session.

The application is not affiliated with or endorsed by Kuro Games or the reference project's maintainers. Numeric fixtures and independently observed image facts are used to verify interoperability; they do not certify every game mechanic or image layout.
