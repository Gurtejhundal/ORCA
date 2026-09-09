const NAV_ITEMS = ['Home', 'Capabilities', 'Use Cases', 'Data Sources', 'About'];

export function OrcaNav() {
  return (
    <header className="orca-nav">
      <nav className="orca-nav__rail" aria-label="Primary navigation">
        {NAV_ITEMS.map((item, index) => (
          <a
            key={item}
            href={item === 'Home' ? '#home' : item === 'Data Sources' ? '/dashboard' : '#ask-orca'}
            aria-current={index === 0 ? 'page' : undefined}
          >
            {item}
          </a>
        ))}
      </nav>
    </header>
  );
}
