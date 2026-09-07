import type {
  Evidence,
  FishingZoneProvider,
  FishingZoneRequest,
  MarineProvider,
  MarineRequest,
  ProviderResult,
  Scenario,
  Geofence,
} from '@orca/contracts';
import { asPoint, haversineDistance } from '@orca/geo';
import { CONFIG } from './config';
import { FIXTURES } from './fixtures';

function envelope<T>(data: T, error: string | null = null): ProviderResult<T> {
  return {
    status: error ? 'unavailable' : 'demo',
    source: 'ORCA Demo Dataset',
    fetchedAt: CONFIG.replayClock,
    data,
    error,
  };
}
export class FixtureMarineProvider implements MarineProvider {
  async getSnapshot(input: MarineRequest): Promise<ProviderResult<Evidence[]>> {
    if (input.scenario === 'api-failure')
      return envelope([], 'Marine fixture provider failure was simulated.');
    const evidence = structuredClone(FIXTURES.evidence).filter(
      (e) =>
        !['windSpeedMs', 'alertSeverity'].includes(e.variable) &&
        Date.parse(e.validFrom) < Date.parse(input.end) &&
        Date.parse(e.validTo) > Date.parse(input.start),
    );
    if (input.scenario === 'high-waves') {
      for (const row of evidence) {
        if (row.variable === 'waveHeightM' && row.location.lat >= 10.81) {
          row.value = 3.8;
          row.id += '-high-waves';
        }
      }
    }
    return evidence.length
      ? envelope(evidence)
      : envelope([], 'No demo marine evidence covers this time window.');
  }
}
export class FixtureWeatherProvider implements MarineProvider {
  async getSnapshot(input: MarineRequest): Promise<ProviderResult<Evidence[]>> {
    const evidence = structuredClone(FIXTURES.evidence).filter(
      (e) =>
        ['windSpeedMs', 'alertSeverity'].includes(e.variable) &&
        Date.parse(e.validFrom) < Date.parse(input.end) &&
        Date.parse(e.validTo) > Date.parse(input.start),
    );
    return evidence.length
      ? envelope(evidence)
      : envelope([], 'No demo weather evidence covers this time window.');
  }
}
export class FixtureFishingZoneProvider implements FishingZoneProvider {
  async getCandidates(input: FishingZoneRequest) {
    const withinTime =
      Date.parse(input.time) >= Date.parse(FIXTURES.evidence[0].validFrom) &&
      Date.parse(input.time) < Date.parse(FIXTURES.evidence[0].validTo);
    const candidates = withinTime
      ? structuredClone(FIXTURES.candidates).filter(
          (z) =>
            haversineDistance(input.origin, asPoint(z.geometry.coordinates)) <=
            input.radiusKm,
        )
      : [];
    return envelope(
      candidates,
      candidates.length
        ? null
        : 'No demo fishing zones cover the requested location and date.',
    );
  }
}
export function getGeofences(
  scenario: Scenario,
  start: string,
  end: string,
): Geofence[] {
  const geofences = structuredClone(FIXTURES.geofences);
  if (scenario === 'restricted-route') {
    geofences.push({
      ...geofences.find((g) => g.category === 'restricted')!,
      id: 'restricted-b',
      name: 'Zone B closure scenario',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [80.07, 10.85],
            [80.13, 10.85],
            [80.13, 10.9],
            [80.07, 10.9],
            [80.07, 10.85],
          ],
        ],
      },
    });
  }
  return geofences.filter(
    (g) =>
      Date.parse(g.validFrom) < Date.parse(end) &&
      Date.parse(g.validTo) > Date.parse(start),
  );
}
