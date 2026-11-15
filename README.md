# 🌒 Lunar Landing Navigator — Mission Control

*NASA Space Apps Challenge prototype*

An interactive tool for comparing lunar landing sites and dates. It shows where the Sun and Earth sit
relative to the **real terrain horizon**, so you can judge solar power potential and direct-to-Earth
(DTE) communication windows at a glance. It is built for mission planners, educators and the public.

It answers six questions:

* **Where** should we land?
* **When** should we land?
* **How long** will sunlight last?
* **When** is Earth visible for DTE communication?
* **What changes** if the landing slips?
* **Which site**, or which spot nearby, offers the best combination of illumination and communication?

**NASA data used:**
* **JPL Horizons** ephemeris (live mode, and to validate the offline model).
* **LRO LOLA** topography (terrain horizons, live shadow map, best-lit-spot search).
* **LRO imagery** via the NASA SVS CGI Moon Kit (3D globe).

---

## Quick start

```bash
# Node.js 18+ (tested with Node 24)
npm install
npm run dev          # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview      # serves dist/ AND the /api/horizons proxy, http://localhost:4173
```

Validate the offline ephemeris against JPL Horizons (needs internet):

```bash
npm run validate
```

> **Live site:** every push to `main` is built and published to GitHub Pages by
> `.github/workflows/deploy.yml` (repo Settings → Pages → Source: "GitHub Actions").
> GitHub Pages is static, so on the live site the app runs on the built-in ephemeris
> (validated against JPL Horizons, see below) and live Horizons mode reports a fallback.

> **Live JPL Horizons mode** needs the `/api/horizons` proxy, because Horizons sends no CORS
> headers. `npm run dev` and `npm run preview` provide the proxy. For a static host, add a rewrite
> `/api/horizons` → `https://ssd.jpl.nasa.gov/api/horizons.api` (e.g. Netlify `_redirects` with
> status 200, or a Vercel rewrite). Without the proxy, the app stays fully functional on the
> offline model and shows a fallback notice.

## Features

| Feature | Details |
|---|---|
| **Curated + custom sites** | 16 sites in 4 groups: CLPS & commercial (IM-2 Athena/Mons Mouton, IM-1, Blue Ghost M1), south-polar features (Shackleton, de Gerlache, Shoemaker, Cabeus/LCROSS, Malapert), international (Chandrayaan-3, Chang'e 6) and Apollo 11–17. Each coordinate shows its source. You can also enter lat/lon, double-click the globe, or click the map. |
| **Real terrain (LOLA)** | Horizons traced over NASA LRO LOLA topography out to 200 km, with lunar curvature. On by default for sites south of 76°S. |
| **Live shadow map** | South-polar map ray-traced over LOLA for the selected moment. Animate the timeline and watch the shadows sweep around the pole. |
| **Best-lit spot nearby** | Scans ~110 points within 5/10/20 km and ranks them by sunlight or Sun+Earth over your mission. Example: from Shackleton's dark floor (0%) it finds a rim point with 86% sunlight. |
| **3D globe** | NASA LRO imagery + LOLA relief, lit by the computed Sun direction at the time cursor, with earthshine. |
| **Horizon panorama** | Sun and Earth plotted against the actual terrain silhouette, with ±36 h trails. |
| **Dashboard** | Solar and Earth elevation, time until sunset / Earthset (or next rise), % sunlit, % Earth visible, % both, longest darkness, longest comm blackout, mean solar-disk visibility. |
| **Timeline** | 24 h / 7 d / 30 d views, time slider, animation (1 h/s – 1 d/s), visibility bands, upcoming rise/set events. |
| **What If? simulator** | Delay +1/7/14/30 d, switch site, extend mission. Shows an instant metric diff, a plain-language impact summary, and overlaid windows on a mission-elapsed-time axis. |
| **Site comparison** | Up to 3 sites side by side, with transparent, user-weighted criteria. |
| **Landing-window scan** | Scores every candidate landing time over 30 d – **1 year** (lunar days *and* seasons). Click to adopt it or pin it as an alternative date. |
| **Learn mode** | ⓘ explanations, a Moon-vs-Earth comparison card, and notes on terrain, libration, the missing atmosphere (no refraction), power and communication. |
| **Exports** | CSV time series, JSON mission report, shareable scenario URL, print/PDF. |

## Data accuracy (summary — full details in `docs/DATA_ACCURACY.md`)

* **Ephemeris:** the offline model (Meeus + IAU 2009 lunar rotation) agrees with JPL Horizons DE441 to
  **< 0.01°** at Shackleton, Malapert and Apollo 11.
* **Terrain:** with LOLA, every documented permanently shadowed site tested (Shackleton, de Gerlache
  and Shoemaker floors, Cabeus/LCROSS) gets **0.0% sunlight over a full year**. A smooth sphere
  wrongly gives ~51%.
* **Badges:** every number carries one — **SOURCED**, **LOLA-DERIVED**, **COMPUTED** or **ILLUSTRATIVE**.
* **Power:** illumination is a **power-availability proxy**, not a power forecast.
* **Communication:** Earth visibility is necessary but not sufficient (DSN is not modelled).
* **Planning index:** a transparent heuristic, **not an official NASA feasibility determination**.

## Architecture

```
src/
  lib/
    astro/            ephemeris.ts (Meeus Sun/Moon + IAU 2009 rotation), topocentric.ts, vec.ts
    providers/        types.ts       ← EphemerisProvider + HorizonMask contracts
                      analytic.ts    ← offline ephemeris (shared geometry cache)
                      horizons.ts    ← NASA/JPL Horizons (queued, cached, retried)
                      lola.ts        ← LOLA terrain horizons (bundled 240 m + in-browser 480 m)
                      terrain.ts     ← geometric / demo / uploaded horizons
    analysis.ts       visibility flags, window metrics, next transitions
    bestLit.ts        regional best-lit-spot search
    scoring.ts, sites.ts, export.ts, format.ts, education.ts, colors.ts
  data/lola-masks.json             precomputed LOLA horizons for curated polar sites
  workers/shadow.worker.ts         LOLA shadow-map ray tracer (Web Worker)
  state/                           store (URL-synced), analysis + horizon-mask hooks
  components/                      Header, Sidebar, MoonGlobe (R3F), PolarMap, SkyView,
                                   StatusPanel, Timeline, WhatIf, Comparison, WindowFinder, MethodsPanel
public/terrain/ldem_75s_480m.bin   LOLA DEM, 480 m (7.3 MB, loaded on demand)
public/textures/                   NASA SVS CGI Moon Kit (LROC colour, LOLA elevation)
tools/
  validate-against-horizons.ts     ephemeris accuracy check vs DE441
  lola_masks.py                    LOLA PDS IMG → horizon masks + browser DEM
```

Ephemeris and terrain are independent and replaceable. Any `EphemerisProvider` combines with any
`HorizonMask`, and both feed one pipeline: `SkySeries + HorizonMask → Visibility → WindowMetrics`.

## Regenerating the LOLA terrain data

```bash
# 1. Download the LOLA south-polar GDR (29 MB) from the PDS Geosciences Node:
#    https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img
# 2. Build masks for every curated site south of 76°S, plus the 480 m browser DEM (needs numpy):
python tools/lola_masks.py ldem_75s_240m.img
# Single site → CSV you can upload in the app:
python tools/lola_masks.py ldem_75s_240m.img --site -89.45 -137.0 -o ridge.csv
```

## Demo script for judges (3 minutes)

1. **The default scenario:** IM-2 Athena at Mons Mouton, landing 15 Dec 2026 06:00 UTC, 14-day
   mission. It gets 100% sunlight and 100% Earth visibility, the panorama shows the real LOLA
   terrain silhouette, and the globe's terminator is the computed one.
2. **What If? → +7 d:** sunlight drops 43.6 points, and a 6-day darkness plus a 5-day comm
   blackout appear, with a plain-language warning.
3. **South-Polar Map → LOLA shadows:** press **Animate** and watch real terrain shadows sweep
   around the pole. Shackleton stays a black bowl.
4. **Comparison:** IM-2 (100) vs IM-1 (74) vs Shackleton's floor (0, permanently dark).
5. **Select Shackleton → "Best-lit spot nearby":** in a few seconds it finds a rim point 10 km away with
   full sunlight for this window. This is the "alternative sites in the same region" use case.
6. **Landing-window scan → 1 year:** answers *when should we land?* across lunar days and seasons.
7. Select Shackleton and switch **Terrain → Geometric:** sunlight jumps from 0% to 100% for this window. A smooth-sphere model would send a lander into a crater that never sees the Sun.
8. Running locally (`npm run dev`), switch the **ephemeris → JPL Horizons:** the header shows "JPL HORIZONS DE441" and the numbers agree. On the GitHub Pages site this mode shows a fallback notice, because static hosting can't relay requests to Horizons.

## How this was built: AI assistance

This project was developed with the help of an AI coding assistant, **Claude (Anthropic)**, used through Claude Code.

* **What the AI assistant did:** improved the source code (the ephemeris and terrain calculations, the user interface, the LOLA processing tool and the build setup), drafted this README, `docs/DATA_ACCURACY.md` and the demo slides, and ran the tests described below.
* **How the results were checked, not just generated:**
  * Sun and Earth positions were compared with NASA/JPL Horizons (DE441) and agree to better than 0.01° (`npm run validate`).
  * LOLA terrain horizons were tested on four documented permanently shadowed craters, which correctly get 0% sunlight over a full year.
  * The map orientation of the LOLA data was settled empirically: known crater centres had to land in crater floors.
  * Site coordinates were taken from cited public sources (NASA NSSDC, LROC, IAU/USGS Gazetteer, ISRO, Firefly), not generated.
* **No AI inside the app:** the tool contains no AI model. Every result comes from published physical models and NASA data, labelled in the app as SOURCED, LOLA-DERIVED, COMPUTED or ILLUSTRATIVE.

## Credits

* Topography: NASA LRO Lunar Orbiter Laser Altimeter (LOLA) GDR, via the PDS Geosciences Node.
* Imagery: NASA Scientific Visualization Studio, *CGI Moon Kit* (LRO LROC WAC, LOLA).
* Ephemeris: NASA/JPL Horizons (DE441). Algorithms: J. Meeus, *Astronomical Algorithms*; IAU WGCCRE (Archinal et al. 2011).
* Site coordinates: IAU/USGS Gazetteer of Planetary Nomenclature; NASA NSSDC; LROC (ASU); NASA LCROSS; Firefly Aerospace; ISRO.

*A planning and education aid. Not an official NASA product.*
