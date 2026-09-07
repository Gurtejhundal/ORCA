import { describe, expect, it } from 'vitest';
import type { Evidence, MarineSnapshot } from '@orca/contracts';
import {
  FIXTURES,
  calculateConfidence,
  calculateFishingOpportunity,
  calculateRouteCost,
  calculateSafetyScore,
  evidenceAt,
  snapshotFromEvidence,
  usableEvidence,
} from '@orca/engine';
const time = '2026-09-07T05:00:00+05:30';
const local = evidenceAt(FIXTURES.evidence, { lat: 10.87, lon: 80.1 }, time);
const calm: MarineSnapshot = {
  location: { lat: 0, lon: 0 },
  time,
  evidenceIds: [],
  waveHeightM: 0,
  windSpeedMs: 0,
  currentSpeedMs: 0,
  alertSeverity: 0,
};
describe('deterministic scores', () => {
  it('gives 100 for zero risks with complete certainty', () =>
    expect(calculateSafetyScore(calm, 1).score).toBe(100));
  it('decreases monotonically as waves rise', () => {
    let previous = 100;
    for (let wave = 0; wave <= 10; wave += 0.1) {
      const current = calculateSafetyScore(
        { ...calm, waveHeightM: wave },
        1,
      ).score;
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });
  it.each([
    ['waveHeightM', 3, 'HARD_GATE_WAVES'],
    ['windSpeedMs', 15, 'HARD_GATE_WIND'],
    ['currentSpeedMs', 1.8, 'HARD_GATE_CURRENT'],
    ['alertSeverity', 3, 'HARD_GATE_SEVERE_ALERT'],
  ])('hard gates %s at the configured boundary', (variable, value, gate) => {
    expect(
      calculateSafetyScore({ ...calm, [variable]: value }, 1).gates,
    ).toContain(gate);
  });
  it('restricted intersection overrides otherwise perfect score', () =>
    expect(calculateSafetyScore(calm, 1, true).gates).toContain(
      'HARD_GATE_RESTRICTED_ZONE',
    ));
  it('missing and non-finite hazards fail closed', () => {
    for (const value of [undefined, NaN, Infinity, -1])
      expect(
        calculateSafetyScore({ ...calm, waveHeightM: value }, 1).gates,
      ).toContain('MISSING_CRITICAL_waveHeightM');
  });
  it('has stable outputs without timestamps or randomness', () =>
    expect(calculateSafetyScore(calm, 0.8)).toEqual(
      calculateSafetyScore(calm, 0.8),
    ));
  it('missing evidence lowers confidence', () => {
    expect(
      calculateConfidence(
        local.filter((e) => e.variable !== 'chlorophyllMgM3'),
        time,
      ).score,
    ).toBeLessThan(calculateConfidence(local, time).score);
    expect(calculateConfidence([], time).score).toBe(0);
  });
  it('does not count duplicate evidence as additional coverage', () =>
    expect(calculateConfidence([...local, ...local], time).coverage).toBe(
      calculateConfidence(local, time).coverage,
    ));
  it('old cached data reduces confidence', () => {
    const cached = local.map(
      (e): Evidence => ({
        ...e,
        freshness: 'CACHED',
        observedAt: '2026-09-01T00:00:00Z',
      }),
    );
    expect(calculateConfidence(cached, time).score).toBeLessThan(
      calculateConfidence(local, time).score,
    );
  });
  it('conflicting readings lower confidence and use worst critical value', () => {
    const wave = local.find((e) => e.variable === 'waveHeightM')!;
    const conflict = [...local, { ...wave, id: 'conflict', value: 4 }];
    expect(calculateConfidence(conflict, time).score).toBeLessThan(
      calculateConfidence(local, time).score,
    );
    expect(
      snapshotFromEvidence(conflict, wave.location, time).waveHeightM,
    ).toBe(4);
  });
  it('expired, wrong-unit and physically invalid evidence is unavailable', () => {
    const wave = local.find((e) => e.variable === 'waveHeightM')!;
    expect(usableEvidence({ ...wave, unit: 'ft' }, time)).toBe(false);
    expect(usableEvidence({ ...wave, value: -1 }, time)).toBe(false);
    expect(usableEvidence(wave, wave.validTo)).toBe(false);
    expect(usableEvidence(wave, wave.validFrom)).toBe(true);
    expect(evidenceAt([wave], { lat: 0, lon: 0 }, time)).toEqual([]);
  });
  it('opportunity is bounded and cannot be invented without supporting evidence', () => {
    const snapshot = snapshotFromEvidence(local, local[0].location, time);
    expect(calculateFishingOpportunity(snapshot, local).score).toBeGreaterThan(
      0,
    );
    expect(
      calculateFishingOpportunity(snapshot, local).score,
    ).toBeLessThanOrEqual(100);
    expect(calculateFishingOpportunity(snapshot, []).score).toBe(0);
  });
  it('route cost favors safety over distance and serializes rejection', () => {
    const safe = calculateRouteCost({
      distanceKm: 40,
      meanRisk: 0.05,
      maxRisk: 0.1,
      confidence: 0.8,
      rejected: false,
    });
    const risky = calculateRouteCost({
      distanceKm: 10,
      meanRisk: 0.5,
      maxRisk: 0.7,
      confidence: 0.8,
      rejected: false,
    });
    expect(safe.cost!).toBeLessThan(risky.cost!);
    expect(
      calculateRouteCost({
        distanceKm: 1,
        meanRisk: 0,
        maxRisk: 0,
        confidence: 1,
        rejected: true,
      }).cost,
    ).toBeNull();
  });
});
