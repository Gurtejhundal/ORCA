import type {
  Evidence,
  GeoPoint,
  MarineSnapshot,
  MarineVariable,
} from '@orca/contracts';
import { haversineDistance } from '@orca/geo';
import { CONFIG } from './config';

export const CRITICAL: MarineVariable[] = [
  'waveHeightM',
  'windSpeedMs',
  'currentSpeedMs',
  'alertSeverity',
];
export const EXPECTED: MarineVariable[] = [
  ...CRITICAL,
  'sstC',
  'chlorophyllMgM3',
  'pfzSignal',
  'otherSignal',
];
export const UNITS: Record<MarineVariable, string> = {
  waveHeightM: 'm',
  wavePeriodS: 's',
  waveDirectionDeg: 'deg',
  windSpeedMs: 'm/s',
  currentSpeedMs: 'm/s',
  alertSeverity: 'level',
  sstC: '°C',
  chlorophyllMgM3: 'mg/m³',
  pfzSignal: 'index',
  otherSignal: 'index',
};
const RANGES: Record<MarineVariable, [number, number]> = {
  waveHeightM: [0, 30],
  wavePeriodS: [0, 60],
  waveDirectionDeg: [0, 360],
  windSpeedMs: [0, 100],
  currentSpeedMs: [0, 20],
  alertSeverity: [0, 3],
  sstC: [-3, 45],
  chlorophyllMgM3: [0, 200],
  pfzSignal: [0, 1],
  otherSignal: [0, 1],
};
export function usableEvidence(e: Evidence, time: string): boolean {
  const [min, max] = RANGES[e.variable];
  return (
    Number.isFinite(e.value) &&
    e.value >= min &&
    e.value <= max &&
    (e.variable !== 'alertSeverity' || Number.isInteger(e.value)) &&
    e.unit === UNITS[e.variable] &&
    e.quality > 0 &&
    Date.parse(e.validFrom) <= Date.parse(time) &&
    Date.parse(time) < Date.parse(e.validTo)
  );
}
export function evidenceAt(
  evidence: Evidence[],
  location: GeoPoint,
  time: string,
): Evidence[] {
  return EXPECTED.concat(['wavePeriodS', 'waveDirectionDeg']).flatMap(
    (variable) => {
      const options = evidence
        .filter(
          (e) =>
            e.variable === variable &&
            usableEvidence(e, time) &&
            haversineDistance(location, e.location) <=
              CONFIG.confidence.maxCellDistanceKm,
        )
        .sort(
          (a, b) =>
            haversineDistance(location, a.location) -
              haversineDistance(location, b.location) ||
            b.quality - a.quality ||
            a.id.localeCompare(b.id),
        );
      if (!options.length) return [];
      const nearestDistance = haversineDistance(location, options[0].location);
      // Preserve co-located provider disagreements for confidence and conservative hazards.
      return options.filter(
        (e) =>
          Math.abs(haversineDistance(location, e.location) - nearestDistance) <
          0.001,
      );
    },
  );
}
export function snapshotFromEvidence(
  evidence: Evidence[],
  location: GeoPoint,
  time: string,
): MarineSnapshot {
  const valid = evidence.filter((e) => usableEvidence(e, time));
  const snapshot: MarineSnapshot = {
    location,
    time,
    evidenceIds: valid.map((e) => e.id),
  };
  for (const variable of EXPECTED.concat(['wavePeriodS', 'waveDirectionDeg'])) {
    const entries = valid.filter((e) => e.variable === variable);
    if (entries.length)
      snapshot[variable] = CRITICAL.includes(variable)
        ? Math.max(...entries.map((e) => e.value))
        : entries.reduce((sum, e) => sum + e.value, 0) / entries.length;
  }
  return snapshot;
}
