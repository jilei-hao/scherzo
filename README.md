
# Scherzo

## A lightweight 4D Model Generator and Viewer

Scherzo turns 3D or 4D label maps (e.g. NIfTI segmentations) into surface meshes in the
browser and plays them back over time. Images are processed locally and never uploaded;
the itk-wasm image reader does download its WASM pipelines from jsDelivr at runtime.

### Run the application on localhost

- Clone/download project to a local folder
- Run `npm install`
- Run `npm run dev`

### Development

- `npm run lint` — ESLint
- `npm test` — unit tests (Vitest)
- `npm run test:e2e` — end-to-end tests that run the real WASM generator in Chromium
  (Playwright; run `npx playwright install chromium` once first)
- `npm run build` — production build

See [docs/improvement-plan.md](docs/improvement-plan.md) for the code review and roadmap.
