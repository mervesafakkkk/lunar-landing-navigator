import type { Visibility, WindowMetrics } from './analysis.ts';
import { indexAt } from './analysis.ts';
import type { HorizonMask, SkySeries } from './providers/types.ts';
import type { Site } from './sites.ts';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function exportCsv(site: Site, s: SkySeries, v: Visibility, startMs: number, endMs: number) {
  const i0 = indexAt(s, startMs), i1 = indexAt(s, endMs);
  const rows = ['utc,sun_az_deg,sun_el_deg,horizon_at_sun_deg,sun_visible,sun_disk_fraction,earth_az_deg,earth_el_deg,horizon_at_earth_deg,earth_visible,both_visible'];
  for (let i = i0; i <= i1; i++) {
    rows.push([
      new Date(s.t[i]).toISOString(), s.sunAz[i].toFixed(4), s.sunEl[i].toFixed(4), v.sunHorizon[i].toFixed(3), v.sun[i],
      v.sunDisk[i].toFixed(3), s.earthAz[i].toFixed(4), s.earthEl[i].toFixed(4), v.earthHorizon[i].toFixed(3), v.earth[i], v.both[i],
    ].join(','));
  }
  const header = `# Lunar Landing Navigator export\n# site=${site.name} lat=${site.lat} lon=${site.lon}\n# ephemeris=${s.providerId} (${s.provenance})\n`;
  download(`lln-${slug(site.name)}-${new Date(startMs).toISOString().slice(0, 10)}.csv`, header + rows.join('\n'), 'text/csv');
}

export function exportJson(payload: {
  site: Site; landingMs: number; durationDays: number; series: SkySeries; mask: HorizonMask; commMinEl: number; metrics: WindowMetrics; planningIndex: number;
}) {
  const { site, series, mask, metrics } = payload;
  const report = {
    generator: 'Lunar Landing Navigator',
    generatedUtc: new Date().toISOString(),
    disclaimer: 'Planning aid. Not an official NASA feasibility determination. Illumination is a power-availability proxy, not a power forecast.',
    scenario: {
      site: { name: site.name, lat: site.lat, lon: site.lon, coordinateSource: site.source },
      landingUtc: new Date(payload.landingMs).toISOString(),
      durationDays: payload.durationDays,
    },
    dataSources: {
      ephemeris: { id: series.providerId, provenance: series.provenance, stepMinutes: series.stepMs / 60000 },
      horizon: { kind: mask.kind, label: mask.label, provenance: mask.provenance, source: mask.source },
      commElevationMaskDeg: payload.commMinEl,
    },
    metrics: {
      sunlitPct: +metrics.sunPct.toFixed(2),
      earthVisiblePct: +metrics.earthPct.toFixed(2),
      simultaneousPct: +metrics.bothPct.toFixed(2),
      meanSolarDiskFraction: +metrics.meanSunDisk.toFixed(4),
      longestDarknessHours: +metrics.longestDarkH.toFixed(2),
      longestDarknessTruncatedByWindow: metrics.longestDarkOpen,
      longestCommBlackoutHours: +metrics.longestBlackoutH.toFixed(2),
      longestCommBlackoutTruncatedByWindow: metrics.longestBlackoutOpen,
      sunElevationRangeDeg: [+metrics.sunElMin.toFixed(3), +metrics.sunElMax.toFixed(3)],
      earthElevationRangeDeg: [+metrics.earthElMin.toFixed(3), +metrics.earthElMax.toFixed(3)],
      planningIndexHeuristic: +payload.planningIndex.toFixed(1),
    },
    darkPeriods: metrics.darkPeriods.map((p) => [new Date(p.start).toISOString(), new Date(p.end).toISOString()]),
    commBlackouts: metrics.blackoutPeriods.map((p) => [new Date(p.start).toISOString(), new Date(p.end).toISOString()]),
  };
  download(`lln-report-${slug(site.name)}.json`, JSON.stringify(report, null, 2), 'application/json');
}
