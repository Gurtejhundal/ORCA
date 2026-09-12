import { OrcaExperience } from '@/components/orca-experience';
import { runQuery } from '@orca/engine';
import './experience.css';
import './landing.css';
import './dashboard/dashboard.css';
import 'maplibre-gl/dist/maplibre-gl.css';

export default async function Page() {
  const result = await runQuery({
    message: 'I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish and what is the safest route?',
    scenario: 'normal',
    language: 'en',
  });

  return (
    <OrcaExperience
      initialDecision={result.status === 'COMPLETE' ? result.decision : undefined}
      initialContext={result.status === 'COMPLETE' ? result.context : undefined}
    />
  );
}
