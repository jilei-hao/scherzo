# Scherzo — Code Review & Improvement Plan

Review of architecture, code structure and engineering practices, with a phased plan.
Line references point at commit `d22cab8` (the reviewed state), so they drift as work lands.

## How this review was done

- Read every source file (JS/JSX, CSS, C++, CMake, scripts, config).
- Ran `npm ci`, `npm run lint`, `npm run build`.
- Ran the real WASM generator in headless Chromium on small synthetic label images to
  reproduce the correctness findings. Findings marked **(verified)** were reproduced, not inferred.
  These probes now live on as the end-to-end tests in `tests/e2e/`.

## Summary

The core idea — VTK's mesh pipeline compiled to WASM, everything client-side — is sound, and
meshes land in the correct ITK/LPS physical space (verified for spacing, origin and the
NIfTI-typical `diag(-1,-1,1)` direction; oblique directions not tested). The code is at
prototype maturity: common inputs crash it, all work runs on the UI thread, the app ships as
one 11.5 MB bundle, and there were no tests, CI, or reproducible WASM build.

### What is already good

- Clear top-level split: `io/` → `generator/` → `viewer_page/`.
- Plain C ABI with direct heap copies (much faster than the earlier embind vector loops, b227b93).
- Sensible mesh recipe: Gaussian → marching cubes → windowed-sinc smoothing → decimation → smoothing.
- Correct physical-space placement; consistent AGPL headers; CSS Modules.

## Findings

### P0 — Correctness

1. **uint8 label maps crash generation (verified).** `label_model_generator/index.js:32-35` built
   the ±1 binary image in the source dtype; in a `Uint8Array`, −1 is stored as 255, so `:73`
   sent 1/255 to WASM. Every voxel is positive and marching cubes at iso 0 finds nothing.
   uint16/uint32 only worked because 65535 wraps back to −1 in Int16.
2. **Any empty surface traps the WASM (verified).** `generator.cxx:326-329` dereferences a null
   `vtkPoints` when a mesh is empty; in WASM address 0 is readable, so it surfaces as
   `RuntimeError: divide by zero`. A single stray voxel of any label (smoothed away by
   σ=0.8) was enough to abort the whole run.
3. **Errors leave the UI stuck (verified by reading).** `App.jsx:39-72` had no try/finally;
   `setLoading(false)` only ran on success, and `:54-56` returned early with the spinner on.
   The Generate button was never disabled.
4. **4D series whose label set changes show wrong/stale meshes or crash (verified).** Labels were
   discovered per time point (`index.js:171-199`) but the viewer mapped meshes to actors by
   array index (`viewer_page/index.jsx:122-126`).
5. **Generator mutated the caller's image (verified).** `index.js:124-125` set
   `imageType.dimension = 3` on the shared object (4 → 3). The 3D cleanup loop (`:215-217`)
   also nulled the caller's `data`.
6. **Latent detached-buffer read.** `index.js:84-91` created a view on WASM memory, then called
   `_getCells` (which allocates) before copying it. With `ALLOW_MEMORY_GROWTH`, growth
   detaches the old buffer and the copy throws. Rare and size-dependent.
7. **Ownership mismatches across the C/JS boundary.** `_free()` on a `new`-allocated generator
   (`index.js:117` vs `generator.cxx:440`) skips the destructor (leaks image + mesh);
   `new[]` outputs (`generator.cxx:520,529`) are released with `free`. Masked today because a
   fresh module is created per label. Dims were sent as `Int16Array` to a `uint16_t*`.
8. **Dead, buggy NIfTI/RAS transform.** `generator.cxx:86` multiplies element-wise instead of a
   matrix product (drops off-diagonal direction terms). Never enabled from JS, but still
   computed and printed for every label (`:199`, `:123-124`).

### P1 — Architecture & performance

- **A. One 11.5 MB (2.8 MB gzip) bundle before first paint.** `Generator.js` (10 MB,
  `SINGLE_FILE` base64 WASM) is statically imported from `App`. Base64 costs +33%, prevents
  streaming compilation and separate caching.
- **B. A new WASM module per label per time point** (`index.js:42`), ~70–120 ms each here —
  roughly 15–25 s of overhead for 20 TPs × 10 labels, plus one heap per instance.
- **C. All heavy work on the main thread.** The UI and spinner freeze. `vite.config.js:15-18`
  configures workers but none are used; the WASM is built with `ENVIRONMENT=web` (no worker).
- **D. ~4 copies and a full-volume pass per label.** JS threshold → Int16 copy → heap copy →
  float conversion (`generator.cxx:178`) → Gaussian + MC over the whole volume. 4D input is
  also copied per time point up front (≈2× memory).
- **E. WASM built like a rendering app.** `CMakeLists.txt:8-19` links rendering/interaction/UI
  modules (pulled in by `vtk_module_autoinit`); `:42` ASYNCIFY and `:41` embind are unused.
- **F. Export and shading.** Normals computed mid-pipeline (`generator.cxx:230`) are discarded,
  so vtk.js falls back to per-fragment face normals (faceted look). The VTP download merges
  all labels without a label array; the object URL is never revoked.
- **G. Image reading depends on a CDN at runtime.** `@itk-wasm/image-io` downloads its WASM
  pipelines from `cdn.jsdelivr.net` by default. Image data never leaves the browser, but the
  app breaks offline or if the CDN is unreachable. (Found while writing the e2e tests.)

### P2 — Code structure & React

- App state: dead `"loading"` status, unused `count`; `image` kept in state but unused
  (half-destroyed for 3D, pins the whole volume for 4D). Use a `useReducer` state machine.
- Stale closures: `MainControlPanel`'s `activeTPRef` is only updated by the timer, so Play
  after stepping/dragging jumps back. One source of truth + functional updates.
- Proposed layout: `core/` (pure logic), `generator/` (WASM wrapper with `dispose()`, worker,
  client), `viewer/` (`useVtkRenderWindow`, `useLabelActors`), C++ sources out of `src/`.
- Dead code: `app_data_context/`, empty `io/index.js`, `label_color_preset_menu.jsx`,
  `BtnPalette`, `ViewCtrlBtnFullScreen`, Vite template leftovers, `patch-package`,
  unused `config` argument (parameters are hard-coded in `index.js:46-49`).
- Misleading `async` on synchronous functions; logging large typed arrays (retained by
  DevTools); unconditional C++ stdout.
- Accessibility: clickable `<div>`s with `<img>` lacking alt text; unassociated `<label>`.
- Dark mode: the Generate button is white text on `#eee` (verified by screenshot).
- Naming: PascalCase functions, mixed snake/camel case in folders and CSS classes.

### P3 — Engineering practices

- Lint was red: 181 problems — 102 from linting generated `Generator.js`, 58 `react/prop-types`,
  21 real ones hidden in the noise.
- No tests; no CI (Pages workflow removed in ec977a1); deploys run from a laptop.
- Non-reproducible WASM build: `configure.sh:5` hard-codes a local VTK path; emsdk/VTK versions
  unrecorded; the AGPL header on `Generator.js` is hand-added.
- Generated 10 MB binary committed (10 revisions; pack is 30.8 MB).
- No types where they matter most (pointers, dtypes, nested model shapes).
- README doesn't document inputs, build, or the "data stays in the browser" property.

## Plan

Why this order: tests first, because later phases rewrite the most fragile code. Phase 0 needs
no WASM rebuild, so it ships immediately. Phase 1 precedes Phase 2 because reusing one module
turns the masked leak (P0-7) into a real one, and a worker needs a rebuild with worker support.

### Phase 0 — Stop the crashes, add a safety net (no WASM rebuild)

- [ ] Lint signal: ignore generated files, disable `react/prop-types`, fix real errors.
- [ ] Vitest + unit tests for the pure image/label helpers.
- [ ] Fix P0 #1 (dtype-independent binarization), #2 (JS-side empty-mesh guard), #3 (error
      handling + disabled button), #4 (label union + actors keyed by label), #5 (no input
      mutation), #6 (copy WASM output immediately).
- [ ] Playwright e2e smoke tests running the real WASM (hermetic: no CDN).
- [ ] Minimal CI: lint, unit tests, build, e2e.

### Phase 1 — WASM build and boundary (needs emsdk + VTK toolchain)

- [ ] Reproducible build: `VTK_DIR` from env, pinned emsdk/VTK, Dockerfile or CI job,
      license header added by script.
- [ ] Trim VTK modules; drop ASYNCIFY, embind, `SINGLE_FILE`; build `ENVIRONMENT=web,worker`;
      measure size before/after.
- [ ] Fix ownership (P0-7) in C++, null-safe getters, gate debug output, fix or delete the
      NIfTI path (P0-8), compute normals last and export them.
- [ ] One typed JS wrapper with `dispose()`; decide where the built artifact lives (LFS / CI).

### Phase 2 — Off the main thread, better data flow

- [ ] Web Worker with progress + cancel; lazy-load the generator; reuse one module.
- [ ] `subarray()` time points; one heap copy per TP with thresholding in C++; bounding-box
      cropping; histogram label discovery.
- [ ] Self-host the itk-wasm image-io pipelines (P1-G).
- [ ] Honour `config` and expose parameters in the UI; optionally evaluate `vtkSurfaceNets3D`.

### Phase 3 — Structure, viewer, UX

- [ ] Folder restructure, reducer state machine, vtk lifecycle hooks, dead-code removal.
- [ ] Single source of truth for the active time point; `requestAnimationFrame` playback.
- [ ] Export with a label array (or per-label files); revoke object URLs.
- [ ] Accessible buttons, theme tokens / dark-mode fix, incremental TypeScript.

### Phase 4 — Process

- [ ] Deploy to Pages from CI, README + developer docs, PR-based workflow.

## Open questions

1. Typical inputs — dtypes and sizes (e.g. uint8, 512³ × 20 TPs)? Decides how far Phase 2 goes.
2. Export target (ITK-SNAP, Slicer, ParaView) and convention — LPS as today, or RAS?
3. `AutoOrientNormalsOn` + `FlipNormalsOn` gives inward-facing orientation — intentional?
4. OK to move the WASM artifact to Git LFS or a CI-built artifact? Is the VTK-wasm build
   reproducible anywhere other than one machine?
5. Appetite for TypeScript, or JSDoc + `checkJs`?
