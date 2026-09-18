'use client';

import { History, Menu, Waves, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppLanguage } from './ask-orca-bar';

const NAV_ITEMS = [
  { en: 'Home', hi: 'होम', id: 'home' },
  { en: 'Capabilities', hi: 'क्षमताएँ', id: 'capabilities' },
  { en: 'How ORCA Works', hi: 'कार्यप्रणाली', id: 'how-it-works' },
  { en: 'Use Cases', hi: 'उपयोग', id: 'use-cases' },
  { en: 'Data Sources', hi: 'डेटा स्रोत', id: 'data-sources' },
] as const;

export function OrcaNav({
  language,
  activeView,
  hasHistory,
  onNavigate,
  onLanguageChange,
}: {
  language: AppLanguage;
  activeView: string | null;
  hasHistory: boolean;
  onNavigate?: (view: string) => void;
  onLanguageChange: (language: AppLanguage) => void;
}) {
  const [activeSection, setActiveSection] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (activeView) return;
    const sections = NAV_ITEMS.map(({ id }) => document.getElementById(id)).filter((node): node is HTMLElement => !!node);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { rootMargin: '-90px 0px -55% 0px', threshold: 0 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [activeView]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    const desktop = window.matchMedia('(min-width: 1101px)');
    const resize = () => { if (desktop.matches) setMenuOpen(false); };
    document.addEventListener('keydown', close);
    desktop.addEventListener('change', resize);
    return () => { document.removeEventListener('keydown', close); desktop.removeEventListener('change', resize); };
  }, []);
  const openWorkspace = () => {
    setMenuOpen(false);
    onNavigate?.('workspace');
  };
  const selectSection = (id: string) => {
    setActiveSection(id);
    setMenuOpen(false);
    onNavigate?.('home');
  };
  const languages = () => <div className="language-switch" role="group" aria-label={language === 'hi' ? 'इंटरफ़ेस भाषा चुनें' : 'Choose interface language'}>
    <button type="button" aria-pressed={language === 'en'} onClick={() => onLanguageChange('en')}>EN</button>
    <button type="button" lang="hi" aria-pressed={language === 'hi'} onClick={() => onLanguageChange('hi')}>हिंदी</button>
  </div>;
  const recent = () => hasHistory && <button className="orca-nav__recent" type="button" aria-label={language === 'hi' ? 'हाल की बातचीत खोलें' : 'Open recent chat'} aria-pressed={activeView === 'chat'} onClick={() => { setMenuOpen(false); onNavigate?.('chat'); }}><History size={18} strokeWidth={1.6} aria-hidden="true" /></button>;

  const compact = !!activeView;
  const hidden = !activeView && activeSection !== 'home';

  return (
    <header className={`orca-nav${compact ? ' orca-nav--compact' : ''}${hidden ? ' orca-nav--hidden' : ''}`}>
      <a className="orca-nav__brand marine-glass marine-glass--nav" href="#home" aria-label={language === 'hi' ? 'ORCA होम' : 'ORCA home'} onClick={() => selectSection('home')}>
        <Waves size={19} strokeWidth={1.7} aria-hidden="true" />
        <span><strong>ORCA</strong><small>{language === 'hi' ? 'समुद्री बुद्धिमत्ता' : 'MARINE INTELLIGENCE'}</small></span>
      </a>

      <nav className="orca-nav__rail marine-glass marine-glass--nav" aria-label={language === 'hi' ? 'मुख्य नेविगेशन' : 'Primary navigation'}>
        {NAV_ITEMS.map((item) => (
          <a key={item.id} href={`#${item.id}`} aria-current={!activeView && activeSection === item.id ? 'page' : undefined} onClick={() => selectSection(item.id)}>
            <span>{item[language]}</span>
          </a>
        ))}
      </nav>

      <div className="orca-nav__actions marine-glass marine-glass--nav">
        <div className="orca-nav__desktop-actions">{recent()}{languages()}</div>
        <button className="orca-nav__workspace" type="button" aria-pressed={activeView === 'workspace'} onClick={openWorkspace}>{language === 'hi' ? 'कार्यस्थल खोलें' : 'Open workspace'}</button>
        <button className="orca-nav__menu" type="button" aria-expanded={menuOpen} aria-controls="orca-mobile-menu" aria-label={menuOpen ? (language === 'hi' ? 'मेनू बंद करें' : 'Close menu') : (language === 'hi' ? 'मेनू खोलें' : 'Open menu')} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
        </button>
      </div>

      <nav className="orca-nav__mobile marine-glass marine-glass--nav" id="orca-mobile-menu" hidden={!menuOpen} aria-label={language === 'hi' ? 'मुख्य नेविगेशन' : 'Primary navigation'}>
        {NAV_ITEMS.map((item) => (
          <a key={item.id} href={`#${item.id}`} aria-current={!activeView && activeSection === item.id ? 'page' : undefined} onClick={() => selectSection(item.id)}>
            <span>{item[language]}</span>
          </a>
        ))}
        <button type="button" onClick={openWorkspace}>{language === 'hi' ? 'कार्यस्थल खोलें' : 'Open workspace'}<span aria-hidden="true">↗</span></button>
        <div className="orca-nav__mobile-actions">{languages()}{recent()}</div>
      </nav>
    </header>
  );
}
