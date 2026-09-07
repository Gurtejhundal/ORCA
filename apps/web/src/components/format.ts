import type { MarineVariable } from '@orca/contracts';
export const VARIABLE_LABELS: Record<MarineVariable, string> = {
  waveHeightM: 'Wave height',
  wavePeriodS: 'Wave period',
  waveDirectionDeg: 'Wave direction',
  windSpeedMs: 'Wind speed',
  currentSpeedMs: 'Current speed',
  alertSeverity: 'Alert severity',
  sstC: 'Sea surface temperature',
  chlorophyllMgM3: 'Chlorophyll',
  pfzSignal: 'Fishing zone signal',
  otherSignal: 'Other opportunity signal',
};
export function localTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
export function localDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
export function reasonLabel(value: string) {
  const labels: Record<string, string> = {
    HARD_GATE_WAVES: 'High waves',
    HARD_GATE_WIND: 'High wind',
    HARD_GATE_CURRENT: 'Strong current',
    HARD_GATE_SEVERE_ALERT: 'Severe alert',
    HARD_GATE_RESTRICTED_ZONE: 'Restricted area',
    HARD_GATE_OUTSIDE_WATER_MASK: 'Outside water mask',
    INSUFFICIENT_ROUTE_EVIDENCE: 'Missing route evidence',
    INSUFFICIENT_EVIDENCE: 'Missing evidence',
    NO_FEASIBLE_ROUTE: 'No feasible route',
    BELOW_MINIMUM_ROUTE_SAFETY: 'Low route safety',
  };
  return (
    labels[value] ??
    (value.startsWith('MISSING_CRITICAL_')
      ? 'Missing ' +
        (VARIABLE_LABELS[value.slice(17) as MarineVariable] ?? 'critical data')
      : value)
  );
}
