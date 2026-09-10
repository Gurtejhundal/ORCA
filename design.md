# ORCA Product Design System

## 1. Product Context

- Product: conversational marine decision-support system
- Primary users: fishers, coastal operators, researchers, and maritime authorities
- Primary tasks: ask a marine question, review a recommendation, inspect the map, and verify evidence
- Device priority: desktop workspace with a deliberate mobile companion
- Trust level: high; live, cached, static, and demo data must remain visibly distinct
- Typical session: short planning conversations followed by focused map inspection

## 2. Design Objective

ORCA must feel like one calm marine-intelligence application. The ocean remains visible as product context while navigation, conversation, maps, and evidence share one persistent shell. Changing tasks must never feel like opening another website.

## 3. Chosen Direction

- Primary style: Minimalist UI
- Secondary influence: restrained Glassmorphism
- Ratio: 80% minimal utility, 20% atmospheric glass
- Reason: long-session clarity and credibility need quiet structure; marine glass connects controls to the ocean hero
- Main risks: expensive full-screen blur, poor contrast over moving water, and hidden navigation state
- Strongest glass use: navigation, tool rail, search, composer, compact map controls
- Restrained utility use: map, evidence, forms, tables, warnings, and long text

## 4. Design Principles

1. One shell, three modes: Ask, Workspace, Evidence.
2. Conversation is the entry point; the map is the working surface.
3. Persistent controls do not move or change material between modes.
4. Evidence and uncertainty stay visible without dashboard clutter.
5. Motion explains continuity and never hijacks ordinary scrolling.

## 5. Color System

- Background: `#041D2B`
- Deep surface: `#062936`
- Elevated surface: `#0A3442`
- Primary text: `#F4FBF8`
- Secondary text: `#B8CACB`
- Muted text: `#78969C`
- Border: `rgba(223, 247, 242, 0.18)`
- Primary accent: `#8AD7D8`
- Success: `#8FD6A3`
- Warning: `#E7BE73`
- Error: `#D97872`
- Contrast target: WCAG 2.2 AA
- Gradients: only subtle legibility fades over ocean imagery
- Transparency: only persistent controls and compact overlays; never dense data panels

## 6. Typography

- Interface font: IBM Plex Sans
- Technical font: IBM Plex Mono
- H1: 30–44px, regular weight
- H2: 22–30px
- H3: 16–20px
- Body: 14–16px, 1.55–1.7 line height
- Label: 10–12px, mono only for metadata
- Maximum reading line: 72 characters

## 7. Spacing and Grid

- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64
- Desktop shell: 78px top navigation, 102px left tool allowance
- Maximum reading width: 760px
- Maximum workspace width: 1600px
- Breakpoints: 600px, 760px, 1024px, 1440px
- Mobile margin: 12–20px; desktop margin: 24–64px

## 8. Shape, Border, and Depth

- Standard border: 1px marine-white at 14–18% opacity
- Small radius: 8px
- Medium radius: 16px
- Large radius: 22px
- Pills: language switch, compact status, and suggestions only
- Shadows: quiet dark separation; no glow
- Blur: 24–30px for nav, rail, search, and composer; avoid full-page backdrop blur when an image filter works

## 9. Iconography and Imagery

- Icons: Lucide, outline, 1.5–1.75 stroke, 16–20px
- Icon-only controls: accessible label and at least 44px target
- Imagery: real ocean surface, marine maps, routes, and actual data views
- Prohibited: emoji, generic AI art, neon HUDs, stock portraits, decorative 3D icons

## 10. Core Components

- Navigation: fixed, full-width blurred marine bar; active mode is explicit
- Tool rail: persistent blurred marine control strip; tools reveal a mode in the same shell
- Search/composer: same material as navigation and rail
- Chat: one continuous scroll with earlier turns above and a visible recent-history entry point
- Workspace: embedded trip planner and map; no second product header
- Evidence: capability summary, provenance pipeline, freshness labels, and safety rules in one view
- Loading: local skeleton or map placeholder only where data is genuinely loading
- Error: inline, adjacent to the failed action, without replacing the whole shell

## 11. Motion

- Fast: 160ms
- Standard: 240ms
- Mode transition: 280ms ease-out crossfade with 10px vertical continuity
- Chat append: 220ms fade and translate
- Scroll: native scrolling; smooth only for programmatic movement
- Reduced motion: disable transforms and reduce transitions to near-zero
- Forbidden: scroll-jacking, bounce, large zoom, rotation, and decorative parallax

## 12. Accessibility

- All gesture actions have visible button equivalents
- Focus ring: 2px pale marine green with 3px offset
- Touch target: 44px minimum
- Chat updates use a polite live region; errors use alerts
- Language choices never mix within the same control label
- Map remains supplementary to text recommendations and evidence

## 13. Responsive Behavior

- Desktop: top navigation, left tool rail, centered chat, two-column workspace
- Tablet: compact rail and narrower trip planner
- Mobile: top bar plus horizontal tool dock; workspace becomes planner above map; chat uses full available width
- No horizontal page scrolling; only intentional local table or tab overflow

## 14. Page Rules

- Home: ocean, persistent controls, one conversational input
- Chat: same ocean held static and softened; history scrolls inside one thread
- Workspace: existing analysis and marine-map logic embedded below persistent controls
- Evidence: one consolidated technical view, not separate marketing pages
- `/dashboard`: retained as a direct deep link, but normal product navigation stays in the home shell

## 15. Forbidden Patterns

- White modal pages over the ocean
- Duplicate headers or nested navigation systems
- Route changes for primary shell modes
- Random glass cards, giant headings, fake metrics, and endless three-column grids
- Unlabelled demo or synthetic data

## 16. Implementation and QA

- Styling: global CSS scoped by component classes and shared tokens
- Components: `apps/web/src/components`
- Icons: `lucide-react`
- Motion: native View Transitions with a CSS fallback and reduced-motion support
- Validation: typecheck, production build, keyboard flow, console, and 390/768/1440px browser checks

