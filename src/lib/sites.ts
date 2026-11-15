export type SiteProvenance = 'published' | 'feature-centre' | 'custom';

export interface Site {
  id: string;
  name: string;
  /** Selenographic (planetocentric) latitude, degrees, south negative. */
  lat: number;
  /** East-positive longitude, degrees (−180…180). */
  lon: number;
  provenance: SiteProvenance;
  source: string;
  note?: string;
  region: 'south-polar' | 'high-latitude' | 'reference';
  group?: SiteGroup;
}

export type SiteGroup = 'CLPS & commercial' | 'South-polar features' | 'International' | 'Apollo';
export const SITE_GROUPS: SiteGroup[] = ['CLPS & commercial', 'South-polar features', 'International', 'Apollo'];

/**
 * Predefined sites. Coordinates are copied from the cited public sources; they are
 * feature centres or reported landing points — NOT certified landing ellipses.
 * Cross-check against the IAU/USGS Gazetteer of Planetary Nomenclature
 * (planetarynames.wr.usgs.gov) before any operational use.
 */
export const SITES: Site[] = [
  // ---- South-polar candidates & features -------------------------------------------
  {
    id: 'im2-athena', name: 'IM-2 Athena · Mons Mouton', lat: -84.78, lon: 29.13, region: 'south-polar', group: 'CLPS & commercial',
    provenance: 'published', source: 'Intended landing site, LROC (ASU) "IM-2 Landing Region" (2025). Athena touched down a few hundred metres away.',
    note: 'Mons Mouton is a high plateau. Compare it with the shadowed crater floors to see how terrain decides everything at the pole.',
  },
  {
    id: 'im1-odysseus', name: 'IM-1 Odysseus · Malapert A', lat: -80.13, lon: 1.44, region: 'high-latitude', group: 'CLPS & commercial',
    provenance: 'published', source: 'NASA LRO / LROC landing-site identification (Feb 2024)',
  },
  {
    id: 'shackleton', name: 'Shackleton Crater (floor)', lat: -89.67, lon: 129.78, region: 'south-polar', group: 'South-polar features',
    provenance: 'feature-centre', source: 'IAU/USGS Gazetteer of Planetary Nomenclature (crater centre)',
    note: 'A permanently shadowed crater floor. With LOLA terrain it receives no direct sunlight. Its sunlit rims are where landers would go.',
  },
  {
    id: 'de-gerlache', name: 'de Gerlache Crater (floor)', lat: -88.5, lon: -87.1, region: 'south-polar', group: 'South-polar features',
    provenance: 'feature-centre', source: 'IAU/USGS Gazetteer of Planetary Nomenclature (crater centre)',
    note: 'The de Gerlache rim region is among NASA’s Artemis III candidate regions (Oct 2024). The crater floor itself is permanently shadowed.',
  },
  {
    id: 'shoemaker', name: 'Shoemaker Crater (floor)', lat: -88.1, lon: 44.9, region: 'south-polar', group: 'South-polar features',
    provenance: 'feature-centre', source: 'IAU/USGS Gazetteer of Planetary Nomenclature (crater centre)',
  },
  {
    id: 'cabeus-lcross', name: 'Cabeus · LCROSS impact', lat: -84.675, lon: -48.725, region: 'south-polar', group: 'South-polar features',
    provenance: 'published', source: 'NASA LCROSS impact point (Colaprete et al., Science 2010)',
    note: 'LCROSS detected water ice here, inside a permanently shadowed region.',
  },
  {
    id: 'malapert', name: 'Malapert Crater (floor)', lat: -84.9, lon: 12.9, region: 'south-polar', group: 'South-polar features',
    provenance: 'feature-centre', source: 'IAU/USGS Gazetteer of Planetary Nomenclature (crater centre)',
    note: 'The nearby Malapert Massif region is among NASA’s Artemis III candidate regions (Oct 2024).',
  },
  // ---- Other CLPS / commercial ----------------------------------------------------------
  {
    id: 'blue-ghost-m1', name: 'Blue Ghost M1 · Mare Crisium', lat: 18.56, lon: 61.81, region: 'reference', group: 'CLPS & commercial',
    provenance: 'published', source: 'Firefly Aerospace, Blue Ghost Mission 1 landing (2 Mar 2025)',
  },
  // ---- International ---------------------------------------------------------------------
  {
    id: 'chandrayaan3', name: 'Chandrayaan-3 · Shiv Shakti', lat: -69.373, lon: 32.319, region: 'high-latitude', group: 'International',
    provenance: 'published', source: 'ISRO Chandrayaan-3 mission (Aug 2023)',
  },
  {
    id: 'change6', name: 'Chang’e 6 · Apollo basin (far side)', lat: -41.64, lon: -153.99, region: 'reference', group: 'International',
    provenance: 'published', source: 'LROC (ASU) "First Look: Chang’e 6" (2024): 41.64°S, 206.01°E, ±30 m',
    note: 'Far side: Earth is never visible, so direct-to-Earth communication is impossible without a relay satellite.',
  },
  // ---- Apollo ------------------------------------------------------------------------------
  {
    id: 'apollo11', name: 'Apollo 11 · Tranquility Base', lat: 0.67408, lon: 23.47297, region: 'reference', group: 'Apollo',
    provenance: 'published', source: 'NASA Apollo 11 landing site (LROC-refined)',
    note: 'Equatorial near-side reference. Earth is always high in the sky, and nights last ~14.75 days.',
  },
  { id: 'apollo12', name: 'Apollo 12 · Oceanus Procellarum', lat: -3.013, lon: -23.422, region: 'reference', group: 'Apollo', provenance: 'published', source: 'NASA NSSDC Apollo Landing Site Coordinates (DE421 ME frame)' },
  { id: 'apollo14', name: 'Apollo 14 · Fra Mauro', lat: -3.646, lon: -17.472, region: 'reference', group: 'Apollo', provenance: 'published', source: 'NASA NSSDC Apollo Landing Site Coordinates (DE421 ME frame)' },
  { id: 'apollo15', name: 'Apollo 15 · Hadley Rille', lat: 26.132, lon: 3.633, region: 'reference', group: 'Apollo', provenance: 'published', source: 'NASA NSSDC Apollo Landing Site Coordinates (DE421 ME frame)' },
  { id: 'apollo16', name: 'Apollo 16 · Descartes', lat: -8.973, lon: 15.501, region: 'reference', group: 'Apollo', provenance: 'published', source: 'NASA NSSDC Apollo Landing Site Coordinates (DE421 ME frame)' },
  { id: 'apollo17', name: 'Apollo 17 · Taurus-Littrow', lat: 20.191, lon: 30.772, region: 'reference', group: 'Apollo', provenance: 'published', source: 'NASA NSSDC Apollo Landing Site Coordinates (DE421 ME frame)' },
];

export const ARTEMIS_III_REGIONS = [
  'Peak near Cabeus B', 'Haworth', 'Malapert Massif', 'Mons Mouton Plateau', 'Mons Mouton',
  'Nobile Rim 1', 'Nobile Rim 2', 'de Gerlache Rim 2', 'Slater Plain',
];

export function makeCustomSite(lat: number, lon: number, name = 'Custom site'): Site {
  return {
    id: 'custom', name, lat, lon, region: lat < -80 ? 'south-polar' : 'high-latitude',
    provenance: 'custom', source: 'User-entered coordinates',
  };
}

export function fmtLatLon(lat: number, lon: number) {
  const la = `${Math.abs(lat).toFixed(3)}°${lat < 0 ? 'S' : 'N'}`;
  const lo = `${Math.abs(lon).toFixed(3)}°${lon < 0 ? 'W' : 'E'}`;
  return `${la}, ${lo}`;
}
