# Data Accuracy & Scientific Integrity

This document explains where every number in Lunar Landing Navigator comes from, how accurate
it is, and what it does **not** account for.

## 1. Provenance classes

Every result panel carries one of four badges:

| Badge | Meaning | Examples |
|---|---|---|
| **SOURCED** | Provided by an external authoritative source | JPL Horizons ephemeris; a horizon mask the user uploads; published site coordinates |
| **LOLA-DERIVED** | Computed in the app from NASA source data | Terrain horizons, shadow map and best-lit search, all from LRO LOLA topography |
| **COMPUTED** | Calculated in the app from published physical models | Analytic ephemeris; geometric horizon; coverage map; all derived metrics |
| **ILLUSTRATIVE** | Synthetic demonstration data, not a measurement | "Illustrative terrain" horizon; any uploaded file that declares itself synthetic |

The app does not invent any NASA measurement. When a sourced dataset is unavailable, the
app falls back to a computed model and says so in the header status pill.

## 2. Ephemeris (Sun and Earth directions)

Two interchangeable providers implement `EphemerisProvider` (`src/lib/providers/types.ts`):

### a) Built-in analytic model (default, offline) — COMPUTED

* **Sun:** Meeus, *Astronomical Algorithms* (2nd ed.), ch. 25.
* **Moon:** Meeus ch. 47 (truncated ELP-2000/82: 60 longitude/distance terms + 60 latitude terms).
* **Precession** from the ecliptic of date to J2000: general precession in longitude (Lieske 1977).
* **Lunar orientation:** IAU WGCCRE 2009 rotation model (Archinal et al., 2011), which
  approximates the Mean-Earth/polar-axis (ME) frame used by LOLA.
* **Topocentric:** observer on a 1737.4 km sphere. Az/el come from the local East-North-Up frame.
  Parallax is included, so Earth's direction differs between sites by up to ~0.26°.
* **Time scale:** TT − UTC = 69.184 s.
* **Libration** in longitude and latitude is included implicitly through the Moon's actual orbit and orientation.

### b) NASA/JPL Horizons — SOURCED

* `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `QUANTITIES='4'` (apparent az/el), DE441,
  `MEAN_ME` frame. Requests go through the same-origin proxy `/api/horizons`.
* Horizons rejects parallel requests from one client (HTTP 503), so the app queues requests
  one at a time and retries with backoff.

### Validation (`npm run validate`)

The analytic model was compared with JPL Horizons DE441 for 1 Dec 2026 – 1 Jan 2027 at 3-h steps
(249 epochs per site):

| Site | Sun elevation RMS / max | Earth elevation RMS / max | Max on-sky azimuth error (Sun / Earth) |
|---|---|---|---|
| Shackleton (89.67°S, 129.78°E) | 0.0031° / 0.0046° | 0.0019° / 0.0033° | 0.0080° / 0.0032° |
| Malapert (84.9°S, 12.9°E) | 0.0033° / 0.0053° | 0.0019° / 0.0032° | 0.0075° / 0.0032° |
| Apollo 11 (0.674°N, 23.473°E) | 0.0067° / 0.0079° | 0.0021° / 0.0036° | 0.0070° / 0.0030° |

For scale: the solar disk radius is 0.267° and Earth's angular radius is ~0.95°. At polar
sites the Sun's elevation changes by roughly 0.01° every 10–20 minutes, so a 0.005° error
shifts a sunrise/sunset by minutes at most. In the app, both providers give the same
percentages for the default scenario (e.g. Malapert, 1 Dec 2026, 14 d: 13.5% sunlit).
The residual comes from the ignored aberration (~20″), the truncated lunar theory, and the
difference between the IAU rotation model and the DE441 ME frame.

## 3. Horizon / terrain: NASA LOLA topography

| Mode | Badge | What it is |
|---|---|---|
| **LOLA** (default) | LOLA-DERIVED | Horizon traced over NASA LRO LOLA topography (details below) |
| Geometric | COMPUTED | Horizon at 0° elevation (smooth sphere). Terrain is ignored. |
| Demo | ILLUSTRATIVE | Deterministic synthetic profile, to show the effect of terrain. **Not LOLA.** |
| Upload | SOURCED (user) | Any `azimuth_deg,elevation_deg` CSV. A file that calls itself synthetic is badged ILLUSTRATIVE. |

**Data:** `LDEM_75S_240M` (LRO LOLA Gridded Data Record, PDS3 V2.0) from the PDS Geosciences
Node. It is a 3812×3812 grid of 16-bit heights (×0.5 m) relative to a 1737.4 km sphere, in
south-polar stereographic projection, 240 m/pixel, in the Mean Earth/polar axis frame (the same
frame as the ephemeris).

**Orientation check:** the PDS projection catalog (`DSMAP_POLAR.CAT`) gives inconsistent signs
for the east-west axis. The correct convention was settled with data: gazetteer crater centres
(Shackleton, de Gerlache, Shoemaker, Malapert, Cabeus) all fall 0.9–3.5 km below their
surroundings with the adopted convention, and none do with the opposite sign.

**Horizon algorithm** (`tools/lola_masks.py`, ported to `src/lib/providers/lola.ts`): for each
azimuth (1° steps), march along the great circle every half pixel out to 200 km, with bilinear
heights, and keep the maximum of
`atan2((R+h)·cosθ − (R+h_obs), (R+h)·sinθ)`, where θ = d/R. The observer stands 2 m above the
terrain. 200 km is enough because a 5 km peak sinks below the geometric horizon beyond ~130 km.

* Curated sites (south of 76°S) use masks precomputed from the full 240 m grid and bundled in
  `src/data/lola-masks.json`.
* Custom sites, the **live shadow map** and the **best-lit-spot search** use a 2×2-averaged 480 m
  copy (`public/terrain/ldem_75s_480m.bin`, 7.3 MB), loaded on first use. Against the 240 m masks,
  the 480 m horizons differ by 0.02–0.09° RMS at four of the six curated polar sites, and by
  0.9–1.2° RMS (up to 3°) at Malapert and IM-1, where steep nearby slopes are smoothed by averaging.
* The best-lit search screens ~110 grid points with 3° azimuth steps and 480 m ray steps.
  Selecting a result recomputes it at 1°.
* The shadow map ray-traces each map pixel toward the Sun across the stereographic grid (which is
  conformal, so local azimuths are straight lines over the 200 km ray), and adds slope shading.

**Validation: known permanently shadowed regions.** Sunlight over all of 2026 (hourly):

| Site | Smooth sphere | LOLA terrain |
|---|---|---|
| Shackleton floor | 51.9% | **0.0%** |
| de Gerlache floor | 51.1% | **0.0%** |
| Shoemaker floor | 51.1% | **0.0%** |
| Cabeus (LCROSS impact) | 51.6% | **0.0%** |

Every documented permanently shadowed site tested stays dark with LOLA terrain, as it should.
The best-lit search starting from Shackleton's floor finds 86% sunlight on the rim 10 km away,
at the geographic south pole, which lies on Shackleton's rim.

**Limits:** 240/480 m grids resolve mountains and crater walls but not boulders, small rims or
the lander itself. LOLA terrain covers 76°S–90°S; elsewhere the geometric horizon is used and
the app says so. For landing-ellipse-scale work, use the 5–20 m LOLA products, or QuickMap and
Moon Trek.

## 4. Visibility rules

* **Sun above horizon:** centre of the solar disk above the local horizon at that azimuth.
* **Mean solar-disk visibility:** the average fraction of the disk area above the horizon
  (circular-segment formula). This is a **power-availability proxy, not a power forecast**.
  Panel orientation, incidence angle, mast height, dust, temperature, degradation and the
  vehicle's self-shadowing are not modelled.
* **Earth visible / DTE link:** centre of Earth above the horizon **plus** a user-set comm
  elevation mask. Line of sight is necessary but not sufficient for communication: Deep Space
  Network station visibility, scheduling, link budget and multipath are not modelled.
* **Longest darkness / blackout:** the longest continuous run inside the mission window. If
  that run touches the window edge it is shown as "≥", because the true duration may be longer.
* **Next sunset / Earthset:** found in data extending 30 days past mission end. The time is
  linearly interpolated between samples.

## 5. Sampling

10-minute steps for spans ≤ 75 days (20 min ≤ 150 d). The landing-window scan uses 30-minute
steps with candidates every 6 h. The polar coverage map uses hourly steps (2-hourly for missions
> 20 d) on a 64×64 grid with a geometric horizon.

## 6. Site coordinates

The 16 predefined sites fall into four groups: CLPS & commercial, south-polar features,
international, and Apollo. They are feature centres from the IAU/USGS Gazetteer of Planetary
Nomenclature, or published landing points: NASA NSSDC (Apollo 12–17, DE421 ME frame), LROC
(IM-1, IM-2 intended site, Chang'e 6), NASA LCROSS, Firefly (Blue Ghost M1) and ISRO
(Chandrayaan-3). Each site's source is shown in the sidebar. The crater-centre coordinates are
independently consistent with LOLA, since each one lands in its crater's floor. These are **not** certified landing
ellipses. NASA's nine Artemis III candidate regions (Oct 2024) are listed by name only, because
the app does not hold their boundaries.

## 7. Planning index

The planning index is a transparent weighted average of five criteria (illumination, communication,
simultaneous coverage, darkness resilience, blackout resilience), each scaled to 0–100.
The weights can be edited in the UI. It is a heuristic for comparing scenarios in this tool and
**is not an official NASA feasibility determination.**

## 8. Imagery

The globe uses the NASA Scientific Visualization Studio *CGI Moon Kit* (SVS 4720): LRO LROC WAC
colour mosaic with polar fill (`lroc_color_poles_1k.jpg`) and LOLA elevation (`ldem_3_8bit.jpg`)
as displacement. Relief is exaggerated about 2×. The globe is lit by the computed Sun direction
at the time cursor, with faint earthshine from the computed Earth direction.
