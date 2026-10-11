# DESIGN.md

## Purpose
This file is the **UI design source of truth**. Follow it for every page, component, state, and responsive layout. Do not invent new colors or fonts unless explicitly instructed.

## Design Tokens

```css
:root {
  --color-background: #FFFFFF;
  --color-surface: #FFFFFF;
  --color-text: #020062;
  --color-primary: #2563EB;
  --color-accent: #0025AE;
  --color-border: #E2E8F0;

  --font-headline: "Gloock", serif;
  --font-body: "Inter", sans-serif;
}
```

### Color Usage
- `background` — page/app background.
- `surface` — cards, sections, inputs, modals, containers.
- `text` — primary text and headings.
- `primary` — primary CTAs, links, active/focus actions.
- `accent` — strong emphasis, selected states, important highlights.
- `border` — borders, dividers, and input outlines.

### Color Rules
- Use only the defined color tokens.
- Do not introduce arbitrary colors, gradients, or alternate shades.
- Prefer `text` for typography, `primary` for actions, and `accent` sparingly.
- Maintain accessible contrast, especially for text and buttons.

## Typography

### Headline — Gloock
Use for:
- Hero headlines
- Major section headings
- High-impact display text

### Body/UI — Inter
Use for:
- Body copy
- Navigation
- Buttons
- Forms
- Labels
- Cards
- Metadata
- All functional UI text

### Typography Rules
- Gloock = display/headline only.
- Inter = body/UI only.
- Do not use Gloock for dense text or small UI.
- Establish hierarchy through size, weight, line-height, and spacing.

## Visual Direction
**Premium · Editorial · Modern · Clean · Confident · Minimal**

Prioritize:
- Generous whitespace
- Strong typography
- Clear hierarchy
- Clean white surfaces
- Restrained blue accents
- Subtle borders
- Precise spacing and alignment

Avoid:
- Excessive gradients
- Heavy shadows
- Visual clutter
- Excessive rounded cards
- Decorative elements without purpose
- Inconsistent spacing or typography

## Component Rules
- **Primary CTA:** `primary`
- **Strong/selected state:** `accent`
- **Card/input:** `surface` + `border`
- Prefer borders and whitespace over heavy shadows.
- Interactive elements must have clear hover, focus, active, and disabled states.
- Keep components visually consistent across all pages.

## Responsive Rules
- Design mobile-first.
- Preserve hierarchy and usability at mobile, tablet, and desktop widths.
- Never allow text, buttons, forms, or important content to overflow or become unusable.

## Agent Rules
1. Treat this file as authoritative for visual decisions.
2. Reuse existing components/tokens before creating new ones.
3. Never hardcode a new brand color or font.
4. If a design decision is ambiguous, choose the simplest option that preserves this system.
