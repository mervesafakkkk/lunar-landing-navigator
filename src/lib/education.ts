export interface Topic {
  title: string;
  body: string;
}

export const EDU = {
  southPole: {
    title: 'Why is the lunar south pole hard to explore?',
    body: 'The Moon’s spin axis is tilted only ~1.54° to the ecliptic, so at the poles the Sun always skims the horizon. Small hills cast shadows kilometres long, and some crater floors have not seen sunlight for billions of years. Those permanently shadowed regions may trap water ice, which is why the poles are a priority. The same geometry gives extreme temperature swings, long shadows that hide hazards, and difficult landing illumination.',
  },
  sunlight: {
    title: 'Why does sunlight matter?',
    body: 'Sunlight is the main energy source for most landers and rovers. It also drives thermal control and gives the lighting that cameras, navigation and crews depend on. In this app illumination is a power-availability PROXY. Real power output also depends on panel orientation and tracking, dust, temperature, degradation, local shadowing from the vehicle itself, and battery state. None of those are modelled.',
  },
  earthVisibility: {
    title: 'Why is Earth sometimes not visible?',
    body: 'The Moon is tidally locked, so Earth stays in nearly the same part of the sky. At the poles that spot sits right on the horizon. Libration makes Earth wander a few degrees up and down over each month, and above and below the horizon. A site that faces away from Earth (the far side) never sees it. Without line of sight to Earth, direct-to-Earth (DTE) radio is impossible, and a relay satellite is needed.',
  },
  terrain: {
    title: 'How does terrain block sunlight and communication?',
    body: 'The geometric horizon assumes a smooth sphere. Real polar terrain has mountains and crater rims that rise many degrees above it, blocking a Sun or Earth only ~0–2° high. In this app the LOLA terrain mode uses NASA Lunar Reconnaissance Orbiter laser-altimeter topography. It traces the horizon in every direction (out to 200 km, including lunar curvature). Example: Shackleton’s floor is walled in by a ~21° horizon and never sees the Sun, while the Mons Mouton plateau 5 km up has a horizon of ~1°.',
  },
  libration: {
    title: 'What is lunar libration?',
    body: 'Libration is the apparent wobble of the Moon seen from Earth. Libration in longitude (up to ±7.9°) comes from the elliptical orbit. Libration in latitude (up to ±6.7°) comes from the tilt of the Moon’s axis relative to its orbit. From the surface, this makes Earth trace a slow loop in the sky each month. Near the poles, that loop decides whether Earth clears the horizon. The model includes libration through the full Moon orbit and the IAU rotation model.',
  },
  noAtmosphere: {
    title: 'No atmosphere, no refraction, no twilight',
    body: 'On Earth the atmosphere bends sunlight by about 0.57° at the horizon. We see the Sun before it geometrically rises, and twilight lights the sky afterwards. The Moon has no atmosphere: the horizon is set purely by terrain and the curve of the sphere, the sky stays black in daytime, and when the Sun’s disk drops behind a ridge, light ends at once. This app applies no refraction.',
  },
  power: {
    title: 'Illumination ≠ electrical power',
    body: '"Mean solar-disk visibility" is the average fraction of the Sun’s disk above the horizon. It is a proxy for available solar energy, not a power forecast. A panel needs line of sight to the Sun at its own height (often above local obstructions). Output also depends on incidence angle, temperature and dust.',
  },
  commMask: {
    title: 'Communication elevation mask',
    body: 'Earth must be above the local horizon AND above this extra margin for a usable direct-to-Earth link. The margin stands in for multipath, antenna pointing limits and the lander’s own structure. Earth visibility is necessary but not sufficient: a ground station (e.g. a NASA Deep Space Network complex) must also have the Moon in view and be scheduled.',
  },
  provenance: {
    title: 'Data provenance labels',
    body: 'SOURCED: provided by an external authoritative source (JPL Horizons ephemeris, or a horizon mask you supply). COMPUTED: calculated here from published physical models (the analytic ephemeris and geometric horizon). ILLUSTRATIVE: synthetic demonstration data that does not represent a real measurement. No NASA measurement in this app is invented.',
  },
  index: {
    title: 'Planning index',
    body: 'A transparent weighted average of five normalised criteria. You can see and change every weight. It is a heuristic for comparing scenarios inside this tool. It is NOT an official NASA feasibility determination.',
  },
  window: {
    title: 'Landing-window scan',
    body: 'For every candidate landing time, the tool recomputes illumination and Earth-visibility percentages over the full mission duration. Peaks show the best times to land. Click a point to set it as the landing time, or pin it as an alternative date.',
  },
} satisfies Record<string, Topic>;

export type EduKey = keyof typeof EDU;
