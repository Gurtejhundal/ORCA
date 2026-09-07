'use client';
import type { DecisionResponse } from '@orca/contracts';
import { Database, ExternalLink } from 'lucide-react';
import { localDate, localTime, VARIABLE_LABELS } from './format';
export function EvidencePanel({
  decision,
  zoneId,
}: {
  decision: DecisionResponse;
  zoneId: string;
}) {
  const zone = decision.zones.find((z) => z.id === zoneId);
  const ids = new Set(zone?.evidenceIds ?? []);
  const evidence = decision.evidence.filter((e) => ids.has(e.id));
  return (
    <section
      className="evidence-section"
      id="evidence"
      aria-labelledby="evidence-heading"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">EVERY VALUE HAS A SOURCE</span>
          <h2 id="evidence-heading">
            <Database size={18} />
            Evidence · {zone?.name ?? 'Unavailable'}
          </h2>
        </div>
        <span className="badge demo">DEMO DATA</span>
      </div>
      {!evidence.length ? (
        <p className="empty-note">
          No evidence is available for this zone and time. No measurements have
          been substituted.
        </p>
      ) : (
        <div className="evidence-grid">
          {evidence.map((e) => (
            <article className="evidence-item" key={e.id}>
              <span>{VARIABLE_LABELS[e.variable]}</span>
              <p className="measurement">
                {e.value}
                <small>{e.unit}</small>
              </p>
              <dl>
                <div>
                  <dt>Source</dt>
                  <dd>
                    {e.sourceName}
                    {e.sourceUrl && (
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open evidence source"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Valid</dt>
                  <dd>
                    {localDate(e.validFrom)} {localTime(e.validFrom)} –{' '}
                    {localDate(e.validTo)} {localTime(e.validTo)} IST
                  </dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {e.location.lat.toFixed(3)}° N, {e.location.lon.toFixed(3)}°
                    E
                  </dd>
                </div>
                <div>
                  <dt>Quality / freshness</dt>
                  <dd>
                    {Math.round(e.quality * 100)}% · {e.freshness}
                  </dd>
                </div>
              </dl>
              <details>
                <summary>Record provenance</summary>
                <p>{e.id}</p>
                <p>
                  Created: {localDate(e.observedAt)} {localTime(e.observedAt)}{' '}
                  IST
                  <br />
                  Fixture retrieval: {localDate(e.fetchedAt)}{' '}
                  {localTime(e.fetchedAt)} IST
                </p>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
