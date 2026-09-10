import type { AppLanguage } from './ask-orca-bar';

const NAV_ITEMS = [
  { en: 'Home', hi: 'होम', view: 'home' },
  { en: 'Ask ORCA', hi: 'ORCA से पूछें', view: 'chat' },
  { en: 'Workspace', hi: 'कार्यस्थल', view: 'workspace' },
  { en: 'Evidence', hi: 'प्रमाण', view: 'evidence' },
];

export function OrcaNav({ language, activeView, onNavigate }: { language: AppLanguage; activeView: string | null; onNavigate?: (view: string) => void }) {
  return (
    <header className="orca-nav">
      <nav className="orca-nav__rail" aria-label={language === 'hi' ? 'मुख्य नेविगेशन' : 'Primary navigation'}>
        {NAV_ITEMS.map((item, index) => (
          <button
            key={item.view}
            aria-label={item[language]}
            aria-current={(activeView === item.view || (!activeView && index === 0)) ? 'page' : undefined}
            onClick={() => {
              if (item.view !== 'home') return onNavigate?.(item.view);
              if (onNavigate) onNavigate('home');
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            {item[language]}
          </button>
        ))}
      </nav>
    </header>
  );
}
