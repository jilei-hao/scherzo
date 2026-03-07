# CLAUDE.md — Scherzo

Scherzo is a browser-based **4D medical image model generator and viewer**. It reads NIfTI label maps (`.nii`/`.nii.gz`), generates 3D surface meshes per label per timepoint using C++ algorithms compiled to WebAssembly, and renders them interactively with VTK.js.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18.3 (functional components + hooks) |
| Build Tool | Vite 6.0 (dev server on port 3001) |
| 3D Rendering | @kitware/vtk.js 32.10 |
| Image I/O | @itk-wasm/image-io + itk-wasm |
| WASM Compilation | Emscripten + CMake (source in `src/wasm/`) |
| Linting | ESLint (react, react-hooks, react-refresh plugins) |
| Deployment | GitHub Pages via `gh-pages` (base path `/scherzo/`) |
| License | AGPL-3.0 |

---

## Repository Structure

```
scherzo/
├── index.html                    # HTML entry point
├── vite.config.js                # Vite config (port 3001, path aliases, WASM settings)
├── eslint.config.js              # ESLint config
├── package.json                  # Scripts and dependencies
├── public/
│   └── scherzo_icon.svg          # App favicon
└── src/
    ├── main.jsx                  # React root — renders <App> in StrictMode
    ├── App.jsx                   # Root component — state management, page routing
    ├── App.css / index.css       # Global styles
    ├── app_data_context/
    │   └── index.jsx             # React Context (created, not yet actively used)
    ├── assets/
    │   └── icons/                # SVG icons (idle/active variants per icon)
    ├── generator/
    │   ├── index.js              # Re-exports GenerateLabelModel
    │   ├── label_model_generator/
    │   │   ├── index.js          # Core model generation pipeline
    │   │   └── Generator.js      # Emscripten WASM module loader
    │   └── wasm_helpers/
    │       └── index.js          # WASM heap memory allocation utilities
    ├── io/
    │   └── image_io/
    │       └── image_reader.js   # ITK-WASM NIfTI reader
    ├── viewer_page/
    │   ├── index.jsx             # VTK.js render window, actors, camera
    │   ├── main_control_panel/
    │   │   ├── index.jsx         # TP nav, playback, export controls
    │   │   └── label_color_preset_menu.jsx  # ITK-SNAP label color table
    │   ├── tp_slider/
    │   │   └── index.jsx         # Time point range slider
    │   └── icon_buttons/
    │       ├── index.jsx         # Named icon button exports
    │       └── icon_button.jsx   # Generic icon button component
    ├── welcome_page/
    │   └── index.jsx             # File upload landing page
    └── wasm/
        ├── generator.cxx         # C++ mesh generation algorithm (VTK pipeline)
        ├── CMakeLists.txt        # Emscripten build config
        ├── configure.sh          # WASM build configuration script
        └── copy_wasm.sh          # Copies compiled WASM artifacts into src/
```

---

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Dev server at http://localhost:3001
npm run build      # Production build to /dist
npm run preview    # Preview the production build locally
npm run lint       # Run ESLint
npm run deploy     # Build and push to GitHub Pages
```

### Building the WASM Module

The C++ generator must be compiled separately using Emscripten. Pre-compiled artifacts are committed to the repo.

```bash
cd src/wasm
./configure.sh     # Configure with Emscripten + VTK
# Run cmake --build in your build directory
./copy_wasm.sh     # Copy .js/.wasm output into src/generator/
```

Only modify and rebuild WASM if changing `src/wasm/generator.cxx`.

---

## Application Architecture

### Data Flow

```
Welcome Page (file input)
  → readImageFromFile()         [src/io/image_io/image_reader.js]
  → GenerateLabelModel()        [src/generator/label_model_generator/index.js]
      For each timepoint:
        createNewITKImageFrom4DImage()   → extract 3D slice
        For each unique label:
          GenerateLabelBinaryImage()     → binary mask image
          GenerateModelForOneLabel()     → WASM call → VTK PolyData
  → models[][]: [TP][label] → { labelValue, polyData }
  → Viewer Page renders actors
```

### WASM Integration Pattern

The generator allocates memory directly on the Emscripten heap, passes typed array pointers to C++, then reads back mesh point/cell arrays. Memory is freed immediately after extraction. See `src/generator/wasm_helpers/index.js` for typed array → WASM heap helpers.

### VTK Pipeline (C++ side, `src/wasm/generator.cxx`)

1. Marching Cubes — voxel grid → polygon mesh
2. Windowed Sinc smoothing
3. Quadric decimation (70% target reduction)
4. Normal computation

### State Management

No external state library. `App.jsx` holds all top-level state and passes props down:
- `image` — loaded ITK image
- `models` — `[TP][label]` mesh array
- `appStatus` — `"welcome"` | `"viewing"`
- `loading` — boolean for generation spinner
- `files` — selected files from input

`app_data_context` exists but props are passed directly instead.

---

## Key Conventions

### Naming

- **Components**: PascalCase — `WelcomePage`, `ViewerPage`, `IconButton`
- **Functions/variables**: camelCase — `handleFileChange`, `generateModel`
- **Generator functions**: PascalCase (C++ convention carried over) — `GenerateLabelModel`, `GenerateLabelBinaryImage`
- **Event handler props**: `on`-prefixed camelCase — `onFileChange`, `onGenerateClicked`, `onExit`
- **CSS class names**: kebab-case (via CSS Modules — `styles.control-panel`)
- **Icon assets**: `<name>_Idle.svg` / `<name>_Active.svg`

### File/Module Structure

- Each major UI section lives in its own directory under `src/`
- `index.js` / `index.jsx` as the public entry point per directory
- CSS Modules (`.module.css`) for component-scoped styles; global styles in `src/index.css`
- All JS/JSX files include an AGPL-3.0 license header

### React Patterns

- Functional components only; no class components
- Hooks: `useState`, `useEffect`, `useRef`, `useContext`
- Prop drilling used (no Context in active use); avoid adding Context unless the component tree grows significantly deeper

### Path Aliases (Vite)

```js
"@"       → "/src"
"@assets" → "/src/assets"
```

Use these in imports rather than long relative paths.

---

## Supported File Formats

Input: `.nii`, `.nii.gz` (NIfTI label maps — 3D or 4D)

Export: `.vtp` (VTK PolyData XML) — one file per timepoint, all labels merged

---

## Medical Imaging Context

- Images contain integer-valued **label maps** (segmentation masks), not raw intensity volumes
- Label `0` is background and is always skipped
- Labels 1–15 are colored using the **ITK-SNAP color table** (see `label_color_preset_menu.jsx`)
- 4D images have a temporal dimension; each timepoint generates its own set of meshes

---

## No Tests / No CI

There are currently no automated tests or CI pipelines. All verification is manual via the browser. When adding tests in the future, co-locate them with the source (`*.test.js` / `*.spec.js`) and use Vitest (compatible with Vite).

---

## Deployment

The app is deployed to GitHub Pages at `https://jilei-hao.github.io/scherzo/`.

```bash
npm run deploy   # runs: vite build && gh-pages -d dist
```

The Vite base path is set to `/scherzo/` in `vite.config.js` to match the Pages URL. Do not change this without also updating the homepage in `package.json`.
