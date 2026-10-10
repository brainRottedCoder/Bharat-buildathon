# AgniGuard: Project Documentation

**Autonomous Stubble and Biomass Fire Early-Warning Radar**

| | |
|---|---|
| Event | Build with AI: Code for Communities, Track 2 (Clean Air and Climate Resilience) |
| Team | Vibers |
| Contact | vaibhav20y@gmail.com |
| Repository | https://github.com/brainRottedCoder/Bharat-buildathon |
| Submission date | October 2026 |

---

## 1. Summary

AgniGuard is a public web application that shows active fires across India and estimates
where their smoke is going. Visitors pick North, South, West or East India, or all of it.
When a visitor opens the site, AgniGuard fetches the latest satellite fire detections and the
current wind at each fire. It then estimates the direction and reach of each smoke plume
and where the fire itself may spread, labels each fire as likely crop-residue burning or
likely wildfire, and draws the result on a map of India drawn with its official boundary.
Each fire comes with a plain-language alert in Hindi, Kannada, Telugu or English that can
be read aloud, and a large compass badge showing where the smoke is heading.

It is meant for farmers, hikers and residents who want to know about fire and smoke near
them before they can see it or smell it. It is an on-demand lookup tool. It does not run
in the background, and it does not send alerts to officials.

## 2. Background and Motivation

Every dry season and autumn, stubble and biomass burning combined with forest fires cause catastrophic air pollution and direct danger across India. While satellite systems like NASA FIRMS observe thermal anomalies reliably from space, that data rarely reaches local communities in time or in a format they can immediately act on.

National systems like the Forest Survey of India's Van Agni provide SMS notifications specifically for forest fires. However, significant operational gaps exist:
1. Distinguishing crop residue burning (e.g. paddy stubble in Punjab/Haryana) from forest wildfires.
2. Estimating wind-driven smoke dispersion plumes so downwind communities know their exposure risk.
3. Accessible, multilingual interfaces with local Indic speech synthesis and clear visual boundaries.

AgniGuard was architected and built to solve these exact problems.

## 3. Engineering & Architecture Breakdown

Our team organized AgniGuard into cleanly separated, high-performance modular layers:

### Core Science & Processing Layer (`logic/`)
The computational core turns raw satellite and meteorological observations into actionable insights:
- **Smoke Dispersion Modeling (`logic/src/dispersion.ts`)**: A simplified Gaussian-puff approximation driven by real-time wind vectors, gracefully degrading when wind data is calm or unavailable.
- **Fire Classification (`logic/src/classify.ts`)**: Classifies detections as likely crop-residue burning versus wildfires using land-cover grids, season, location, and Fire Radiative Power (FRP).
- **Spatial Lookups (`logic/src/geo.ts`)**: Fast O(1) binary spatial index lookup against state boundaries and land cover masks.
- **Speech Synthesis (`logic/src/tts.ts`)**: Pure-function wrapper supporting Indic text-to-speech for local dialects.

### Edge Worker Backend (`worker/`)
- Cloudflare Workers edge endpoint (`/api/radar`) designed to execute within a strict 10ms CPU budget on the free tier.
- Batched Open-Meteo wind queries (100 locations per subrequest) to eliminate redundant external calls.
- Integrated Cloudflare Turnstile token validation and cryptographic session management (`worker/src/turnstile.ts`) to prevent bot exhaustion.

### High-Performance Frontend (`frontend/`)
- Interactive MapLibre GL visualization displaying official Survey of India territorial boundaries.
- Directional plume overlays with dynamic compass badges and fire spread estimations.
- Multi-lingual detail panels with native audio alerts (Hindi, Telugu, Kannada, English) using browser-based Piper voices.
- Accessible, responsive UI optimized for low-bandwidth and mobile screens.

## 4. How it works

```
Visitor opens the site
        |
        v
Cloudflare Worker  GET /api/radar?region=north|south|west|east|india
  1. NASA FIRMS        active fire detections in the region's box
  2. State grid        keep fires in the region's states (drops Pakistan, Nepal, sea)
  3. Open-Meteo        wind, batched: 100 locations per request, 0.5 degree cells
  4. Dispersion        simplified Gaussian-puff plume: bearing, reach, spread, wind speed
  5. Classification    ESA WorldCover land cover + season + state + fire power
        |
        v
Browser (React + MapLibre GL)
  markers, fire footprint and possible-spread haze, dotted smoke plume,
  detail panel with compass badge, alert text and voice in four languages
```

**Heavy work runs offline.** Geographic processing runs once, offline, and publishes static
files: India's state and country boundaries, a grid saying which state every point is in
(about 110 m), a national land-cover grid (about 550 m) and a farmland image. Looking a
fire up in either grid is a single array read. Training the
fire-risk model is also offline. Neither of them runs while a visitor is waiting.

**Light work runs per request.** The Worker does only network fetches and cheap
arithmetic. Everything a region needs has to fit in the free tier's 10 ms CPU budget;
3000 fires across all of India measured about 4 ms.

**Voice runs on the phone.** The device's own voice is used when it has the language.
Otherwise a Piper voice model runs in the browser, downloaded once. No server and no paid
service is involved.

**The dispersion model is an approximation.** It is a simplified Gaussian-puff
calculation, not NOAA HYSPLIT. It estimates which direction smoke travels and roughly how
far. It does not forecast concentrations.

## 5. Data sources

| Purpose | Source | Terms |
|---|---|---|
| Active fire detections | NASA FIRMS (VIIRS and MODIS) | Free, API key required |
| Wind | Open-Meteo (GFS) | Free, no key |
| Land cover | ESA WorldCover 2021, 10 m | CC-BY 4.0, attribution shown in the app |
| Country borders | Natural Earth 1:10m, India point of view | Public domain |
| State boundaries | DataMeet States/Admin2 (Survey of India outline) | Attribution shown in the app |
| Places | Natural Earth 1:10m populated places | Public domain |
| Alert voices | Piper voices (rhasspy/piper-voices), onnxruntime-web | Open source, loaded on first use |
| Basemap | CARTO Positron, OpenStreetMap data | Attribution shown on the map |

## 6. Design principles

The team agreed on these rules early, and they apply to every change:

1. **No false all-clear.** "No fires detected" appears only after NASA FIRMS actually
   returned zero results. A missing key, a failed request or a timeout is shown as an
   error.
2. **Crop burning is tagged, never hidden.** Every detected fire is shown on the map.
3. **Approximations are labelled.** The dispersion model is described as "simplified
   Gaussian-puff, not HYSPLIT" in the interface, the documentation and the pitch.
4. **Ambiguity leans towards safety.** Grassland and scrub fires are never presumed to be
   crop burning. The fire that inspired the project was one of these.
5. **Secrets stay on the server.** The FIRMS key is a Worker secret and never reaches the
   browser.
6. **Built for low-end phones.** No model runs on the device, and the page does as little
   work as it can.
7. **Accessible language.** Alerts are written for non-specialists, in the language of
   the fire's state, with compass directions translated too.
8. **India as it is.** The map shows India's official boundary, and fires in
   Gilgit-Baltistan and Aksai Chin are Indian fires.

## 7. Repository layout

| Path | Contents |
|---|---|
| `frontend/` | Vite, React and MapLibre GL web application |
| `logic/` | Framework-free TypeScript: fetchers, dispersion, classification, TTS |
| `worker/` | Cloudflare Worker that serves the site and `/api/radar` |
| `pipeline/` | Offline boundary and land-cover processing (Node, Python) |
| `ml/` | Offline fire-risk model (Python, NumPy, scikit-learn) |
| `docs/` | Decision record, roadmap, coding standards, and each member's work log |
| `delegation/` | Each member's work brief |

## 8. Running and testing

```bash
npm install
npm run dev                          # frontend at http://localhost:5173
npm run typecheck                    # type checks across all workspaces
npm run build                        # production build
npm test --workspaces --if-present   # unit tests (Node's built-in test runner)
```

Adding `?demo` to the development URL loads clearly labelled demo hotspots, so the
interface can be tried without a FIRMS key. Production builds cannot load demo data.

Continuous integration runs the same type check, build and tests on every pull request.
It also runs a check that keeps emoji out of the code, and a guard that blocks unannounced
changes to the shared data types in `logic/src/types.ts`.

## 9. Development workflow and tooling

The team worked in parallel against a shared type contract (`logic/src/types.ts`), with
a written brief for each member and a dated log of what they had verified. Work was
tracked in GitHub issues, and every change went through a pull request that had to pass CI.
Before any work counted as done, it needed a check that someone else could re-run, logged
with its real output.

AI-assisted development tools were leveraged responsibly alongside rigorous engineering standards:

- **Google Antigravity & AI Assistants.** Used for accelerating scaffolding, typing, and test cases under strict verification.
- **Automated Verification.** Every component, science formula, and edge handler includes comprehensive regression test suites running natively in Node.js.
- **Specification-Driven Development.** Architecture contracts, schemas, and performance budgets ensured rapid, stable delivery across the team.

These tools sped up implementation. The product decisions, the architecture, the
safety rules and the final review of every change stayed with the team.

## 10. Known limitations

- The dispersion model estimates direction and reach, not smoke concentration.
- Land cover is resolved at about 550 m. Grassland, scrub and mangrove are grouped as
  "other".
- Satellites can miss small, short-lived or cloud-covered fires.
- "Possible spread" is a rule of thumb (10% of wind speed over three hours), not a
  fire-spread model.
- On a phone without its own voice for the language, the first alert read aloud downloads
  about 80 MB. Kannada is read by the Telugu voice, so it has a Telugu accent.
- Alerts exist in four languages only; fires in other states default to English.
- The fire-risk layer is experimental, covers Telangana and Andhra Pradesh only, and a
  low value is never an all-clear.

## 11. Attribution

Contains modified Copernicus Sentinel data, © ESA WorldCover project 2021 (CC-BY 4.0).
Fire data from NASA FIRMS. Wind data from Open-Meteo. Map data © OpenStreetMap
contributors, basemap by CARTO. Border and place data from Natural Earth. State boundaries
from DataMeet. Voices from the Piper project.

The source code is open. Every dependency and external service the project uses,
including the closed-source ones, is listed in `README.md`.
