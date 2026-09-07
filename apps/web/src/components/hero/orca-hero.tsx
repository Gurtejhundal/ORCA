'use client';

import { AskOrcaBar } from './ask-orca-bar';
import { OceanRippleVideo } from './ocean-ripple-video';
import { OrcaNav } from './orca-nav';
import { OrcaToolRail } from './orca-tool-rail';

export function OrcaHero() {
  return (
    <main className="orca-hero" id="home">
      <OceanRippleVideo />
      <div className="orca-hero__legibility" aria-hidden="true" />
      <OrcaNav />
      <OrcaToolRail />
      <AskOrcaBar />
    </main>
  );
}
