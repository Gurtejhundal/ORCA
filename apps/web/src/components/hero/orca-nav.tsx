'use client';

import { Menu, Waves, X } from 'lucide-react';
import { useState } from 'react';
import type { AppLanguage } from './ask-orca-bar';

const NAV_ITEMS = [
  { en: 'Home', hi: 'होम', id: 'home' },
  { en: 'Capabilities', hi: 'क्षमताएँ', id: 'capabilities' },
  { en: 'Use Cases', hi: 'उपयोग', id: 'use-cases' },
  { en: 'Data Sources', hi: 'डेटा स्रोत', id: 'data-sources' },
  { en: 'About', hi: 'परिचय', id: 'about' },
] as const;

export function OrcaNav({
  language,
  activeView,
  onNavigate,
  onLanguageChange,
}: {
  language: AppLanguage;
  activeView: string | null;
  onNavigate?: (view: string) => void;
  onLanguageChange: (language: AppLanguage) => void;
}) {
  const [activeSection, setActiveSection] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const openWorkspace = () => {
    setMenuOpen(false);
    onNavigate?.('workspace');
  };
  const selectSection = (id: string) => {
    setActiveSection(id);
    setMenuOpen(false);
    onNavigate?.('home');
  };

  return (
    <header className="orca-nav">
      <a className="orca-nav__brand" href="#home" aria-label="ORCA home" onClick={() => selectSection('home')}>
        <Waves size={19} strokeWidth={1.7} aria-hidden="true" />
        <span><strong>ORCA</strong><small>MARINE INTELLIGENCE</small></span>
      </a>

      <nav className="orca-nav__rail" aria-label={language === 'hi' ? 'मुख्य नेविगेशन' : 'Primary navigation'}>
        {NAV_ITEMS.map((item) => (
          <a key={item.id} href={`#${item.id}`} aria-current={!activeView && activeSection === item.id ? 'page' : undefined} onClick={() => selectSection(item.id)}>{item[language]}</a>
        ))}
      </nav>

      <div className="orca-nav__actions">
        <button className="orca-nav__workspace" type="button" aria-pressed={activeView === 'workspace'} onClick={openWorkspace}>{language === 'hi' ? 'कार्यस्थल खोलें' : 'Open workspace'}</button>
        <div className="language-switch" role="group" aria-label={language === 'hi' ? 'इंटरफ़ेस भाषा चुनें' : 'Choose interface language'}>
          <button type="button" aria-pressed={language === 'en'} onClick={() => onLanguageChange('en')}>EN</button>
          <button type="button" lang="hi" aria-pressed={language === 'hi'} onClick={() => onLanguageChange('hi')}>हिंदी</button>
        </div>
        <button className="orca-nav__menu" type="button" aria-expanded={menuOpen} aria-controls="orca-mobile-menu" aria-label={menuOpen ? (language === 'hi' ? 'मेनू बंद करें' : 'Close menu') : (language === 'hi' ? 'मेनू खोलें' : 'Open menu')} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
        </button>
      </div>

      <nav className="orca-nav__mobile" id="orca-mobile-menu" hidden={!menuOpen} aria-label={language === 'hi' ? 'मोबाइल नेविगेशन' : 'Mobile navigation'}>
        {NAV_ITEMS.map((item) => <a key={item.id} href={`#${item.id}`} onClick={() => selectSection(item.id)}>{item[language]}</a>)}
        <button type="button" onClick={openWorkspace}>{language === 'hi' ? 'कार्यस्थल खोलें' : 'Open workspace'}<span aria-hidden="true">↗</span></button>
      </nav>
    </header>
  );
}
