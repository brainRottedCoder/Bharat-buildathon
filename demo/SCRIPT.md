# AgniGuard launch demo — script

Total: **54.0s** · 6 scenes · 100 BPM (0.6s grid)

## Honesty fixtures (from the app, not invented)

North India demo set in `frontend/src/demoHotspots.ts` — four real-shaped detections the UI already uses in `?demo`:

| # | Lat, lon | FRP | Land | Kind the classifier actually returns in Oct/Nov |
| --- | --- | --- | --- | --- |
| 1 | 30.90, 75.70 | 45 MW | Punjab cropland | Likely Crop Stubble Burning |
| 2 | 30.35, 76.30 | 12 MW | Haryana cropland | Likely Crop Stubble Burning |
| 3 | 29.40, 76.40 | 28 MW | Haryana cropland | Likely Crop Stubble Burning |
| 4 | 30.10, 78.90 | 160 MW | Uttarakhand forest | Likely Wildfire / Forest Fire |

Nearest town for fire 1: **about 15 km west of Ludhiana** (`TOWNS`: Ludhiana 30.901, 75.857).

Reconcile on screen in the proof beat: **4 fires · 3 stubble · 1 wildfire**. Never show a different total.

Languages the panel actually ships: English, Hindi, Kannada, Telugu. TTS languages the code supports: `hi`, `pa`, `te`, `en`. The film uses Hindi then English — those two exist in both.

Product accent from `frontend/src/index.css`: Palm Leaf `#5D6E48`. Stubble = orange. Wildfire = red. Paper `#fdfffc`.

---

## Scene table

| # | Name | Duration | Clock | Single claim |
| --- | --- | --- | --- | --- |
| 1 | SmokeHasASource | 7.2s | 0:00.0–0:07.2 | The city is choking and the village never gets the alert. |
| 2 | OpenTheRadar | 6.0s | 0:07.2–0:13.2 | AgniGuard is a page. You pick North India. |
| 3 | TheScan | 9.0s | 0:13.2–0:22.2 | NASA FIRMS + wind land as four fires on India's own boundary. |
| 4 | TapLudhiana | 11.4s | 0:22.2–0:33.6 | One tap: stubble tag, smoke plume, Hindi alert. |
| 5 | ItAddsUp | 10.8s | 0:33.6–0:44.4 | 4 / 3 / 1. Crop vs forest. The numbers match the map. |
| 6 | TheStamp | 9.6s | 0:44.4–0:54.0 | On demand. No account. AgniGuard. |

---

## Speaker brief

```
Speaker: the person who built this (not a narrator, not a explainer)
Talking to: a judge / civic builder who already watched Delhi go grey every November
Want: make them feel the old alert never reached the people downwind, then hand them a phone page that does
Arc: contempt → dare → secret → challenge → pride → thesis
```

---

## Voiceover (performance table)

| Start | Line | Emotion | Energy | Context / subtext |
| --- | --- | --- | --- | --- |
| 0:00.0 | Every November the sky goes grey. | contempt | 0.72 | Tired of the same season. Not sad. |
| 0:03.6 | The village downwind never gets the alert. | urgent | 0.80 | Name the person who loses. |
| 0:07.8 | So open a page. | dare | 0.86 | Hand them the phone. |
| 0:10.2 | North India. | excited | 0.90 | The win of picking a place. Do not swallow it. |
| 0:14.4 | NASA sees the heat. | secret | 0.78 | Lean in. Satellite, not a dashboard. |
| 0:17.4 | Wind tells you where the smoke goes. | secret | 0.82 | The half nobody ships. |
| 0:23.4 | Tap it. | challenge | 0.88 | Make them do the thing. |
| 0:26.4 | Stubble. Not forest. | pride | 0.84 | The tag the old systems refuse. |
| 0:29.4 | Fifteen kilometres west of Ludhiana. | wonder | 0.70 | Intimate. The one 0.4–0.55-adjacent line — stay at 0.70 so it still lives. |
| 0:34.2 | Four fires. | pride | 0.86 | Hammer 1. |
| 0:36.0 | Three stubble. | pride | 0.88 | Hammer 2. |
| 0:37.8 | One wildfire. | pride | 0.90 | Hammer 3. They add up. |
| 0:40.2 | Hindi. Kannada. Telugu. English. | grin | 0.80 | Proof you built it for the phone they carry. |
| 0:45.0 | Nothing runs when you close the tab. | warm | 0.74 | Thesis setup. |
| 0:48.0 | AgniGuard. | thesis | 0.92 | The company lives or dies on this name. |

**Air pockets:** 0:20.4–0:23.4 (fires already on the map, no VO — let them stamp); 0:48.6–0:54.0 (brand stamp, music resolve).

---

## Rhythm grid

100 BPM. Hits land on 0.6s ticks.

- Region tab squash: 0:10.2
- Four fire stamps: 0:15.6, 0:16.8, 0:18.0, 0:19.2
- Tap marker: 0:23.4
- Panel slam: 0:24.0
- Count stamps: 0:34.2, 0:36.0, 0:37.8
- Language chips: 0:40.2, 0:40.8, 0:41.4, 0:42.0
- Wordmark stamp: 0:48.0

---

## Sync notes

- `'North India.'` lands on the active-tab squash (~0:10.2).
- `'NASA sees the heat.'` starts as the first marker stamps (~0:15.6).
- `'Tap it.'` lands on the squash-on-impact frame of the Ludhiana marker (~0:23.4).
- `'Four fires.'` / `'Three stubble.'` / `'One wildfire.'` lock to the count stamps; the map already shows 4 / 3 / 1 — never a different number.
- Silence from 0:48.6 to 0:54.0 for the outro and music resolve.

---

## Picture (what we will film — not yet built)

1. **SmokeHasASource** — product paper `#fdfffc` under a blurred India land-cover wash. Grey haze. No UI chrome yet. Type slams: the two opening lines.
2. **OpenTheRadar** — real header + region tabs from the app. Cursor/finger hits **North India / उत्तर भारत**.
3. **TheScan** — MapLibre India, official boundary. Four markers stamp (orange / orange / orange / red). Dotted plumes draw downwind.
4. **TapLudhiana** — real `HotspotDetailPanel`: "Likely Crop Stubble Burning", compass, "About 15 km west of Ludhiana", Hindi alert, speaker control.
5. **ItAddsUp** — split: the Uttarakhand 160 MW fire tagged wildfire; count row 4 / 3 / 1; language chips flip.
6. **TheStamp** — mosaic marks + **AGNIGUARD** wordmark on Palm Leaf. No URL, no "meet X".
