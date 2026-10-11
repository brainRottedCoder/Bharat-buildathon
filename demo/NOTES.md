# Demo standalone UI — forks and re-sync risks

- **No MapLibre.** WebGL tiles are not deterministic under the seek contract
  (tiles race, labels jitter). The film map is the product farmland raster
  (`frontend/public/landcover/farmland.png`, bbox 68/6/98/38, Web Mercator)
  with the same North-India fixtures as `frontend/src/demoHotspots.ts`.
- **No Turnstile / Worker.** The demo never hits `/api/radar`. Classification
  and panel copy come from the real helpers in `HotspotDetailPanel.ts`.
- **No TtsButton network.** The speaker control is the same CSS class, idle.
- **Tokens** are a copy of `frontend/src/index.css` → `demo/ds/app.css`.
  Re-copy after palette changes.
- **Art:** `demo/ds/farmland.png` is the product land-cover image, used as the
  film map and as the blurred under-layer so no frame sits on flat black.
- **Fonts:** IBM Plex Sans + JetBrains Mono from Google Fonts, same as
  `frontend/index.html`. Recorder waits on `document.fonts.ready`.
