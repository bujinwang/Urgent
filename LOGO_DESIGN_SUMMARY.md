# LifeSpark Logo Design for 急救侠

## Design Overview

The redesigned 急救侠 logo uses a **LifeSpark** mark: a rounded emergency app icon containing a heart, a lightning spark, and a compact medical cross. It is built for mobile UI first, so it remains legible at small sizes and works on both light backgrounds and red emergency buttons.

## Core Concept

- **Rounded red app tile**: product identity, urgency, and mobile-app recognition.
- **Heart form**: CPR and life support, making the mark warmer than a generic medical cross.
- **Lightning spark**: AED activation, rapid response, and the golden rescue window.
- **Small medical cross**: explicit first-aid signal without dominating the mark.
- **Inner life ring**: continuity of care and responder network coordination.

## Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| Rescue Red | `#C0392B` | Primary tile, emergency identity |
| Deep Red | `#8B2A1F` | Existing gradients and depth |
| White | `#FFFFFF` | Heart and cross contrast |
| Spark Gold | `#F6C65B` | AED spark and action highlight |

## Technical Implementation

**Format**: Inline SVG, 100x100 viewBox.

**CSS Tokens**:

```css
.logo-bg
.logo-heart
.logo-spark
.logo-chip
.logo-chip-cross
.logo-ring
.logo-pulse
```

The mark uses CSS variables such as `--logo-bg`, `--logo-heart`, and `--logo-chip-cross` so the same SVG can invert cleanly on red buttons without turning black.

## Usage

1. **Launch screen**: large animated LifeSpark mark next to 急救侠.
2. **Home header**: compact brand mark beside the app name.
3. **Emergency SOS button**: inverted white tile with red heart for contrast.
4. **Mission alert and rescue buttons**: updated LifeSpark watermark.
5. **Share page**: same hero mark and CTA icon.
6. **Proposal cover**: same logo system for external presentation.

## Accessibility

- SVG stays crisp at all sizes.
- High contrast variants are defined for red and light backgrounds.
- Pulse animation respects `prefers-reduced-motion`.
- The shape no longer relies on inherited nested `<use>` styling, preventing black-icon rendering.

---

**Design Date**: 2026-05-03  
**Design System**: 急救侠 LifeSpark Logo  
**Status**: Updated
