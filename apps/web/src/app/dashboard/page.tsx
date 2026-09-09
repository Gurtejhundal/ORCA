import { Dashboard } from '@/components/dashboard';
import { runQuery } from '@orca/engine';
import './dashboard.css';
import 'maplibre-gl/dist/maplibre-gl.css';

export default async function DashboardPage() {
  const result = await runQuery({ message: 'I am leaving from Nagapattinam tomorrow at 5 AM. Where should I fish and what is the safest route?', scenario: 'normal', language: 'en' });
  if (result.status !== 'COMPLETE') return <p>The existing replay could not load.</p>;
  return <Dashboard initialDecision={result.decision} initialContext={result.context} />;
}
