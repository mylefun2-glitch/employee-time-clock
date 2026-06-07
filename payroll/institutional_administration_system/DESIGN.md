---
name: Institutional Administration System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#424750'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737781'
  outline-variant: '#c3c6d1'
  surface-tint: '#325f9c'
  primary: '#00366b'
  on-primary: '#ffffff'
  primary-container: '#1b4d89'
  on-primary-container: '#98bfff'
  inverse-primary: '#a7c8ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#2e354a'
  on-tertiary: '#ffffff'
  tertiary-container: '#444c62'
  on-tertiary-container: '#b5bdd7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#a7c8ff'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#114783'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max-width: 1440px
  sidebar-width: 260px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for the rigorous demands of social care administration and payroll management. It prioritizes **trustworthiness, precision, and institutional reliability**. The brand personality is that of a quiet, efficient steward—unobtrusive yet authoritative.

The visual style follows a **Modern Corporate** approach with **Minimalist** influences. By utilizing a restrained color palette and a structured grid, the interface minimizes cognitive load for users handling complex financial data. The aesthetic mirrors the stability of government reporting standards while providing the fluid usability of a modern SaaS platform.

## Colors

The palette is anchored by **Professional Blue**, a deep navy that conveys institutional stability and authority. 

- **Primary (Professional Blue):** Used for key actions, primary navigation, and branding elements.
- **Secondary (Slate):** Reserved for supporting information and secondary UI elements.
- **Neutral (Soft Gray):** A range of cool grays serves as the foundation for the interface, defining background layers and table borders to ensure a clean, high-density layout.
- **Functional Colors:** Status-specific colors for "Draft" (neutral gray) and "Locked" (darker slate) are desaturated to maintain professional decorum, while semantic colors for success and error remain clear and accessible.

## Typography

This design system utilizes a dual-font strategy to ensure maximum legibility across administrative and financial data. 

**Inter** is the primary UI typeface, chosen for its systematic and utilitarian nature in English characters, making it ideal for labels, buttons, and navigation elements. 

**Noto Sans** serves as the primary body font, providing exceptional readability for both Traditional Chinese and English text. It ensures that complex payroll names and financial terms are rendered with clarity. The type scale favors smaller, legible sizes (13px–14px) for data tables to maximize information density without sacrificing visual comfort.

## Layout & Spacing

The layout uses a **Fluid Grid** system within a constrained maximum width to ensure performance on large administrative monitors. 

- **Structure:** A persistent 260px left-hand sidebar contains primary navigation, while the main content area utilizes a 12-column grid.
- **Rhythm:** A 4px baseline grid governs all spacing. Data-heavy views utilize "Compact" spacing (8px–12px padding), while landing pages and dashboards use "Comfortable" spacing (24px–32px).
- **Responsiveness:** On tablet devices, the sidebar collapses into a rail or drawer. On mobile, the system reflows into a single column, with data tables utilizing horizontal scrolling or card-based transformations.

## Elevation & Depth

To maintain a "government-standard" clean aesthetic, this design system avoids heavy shadows. Instead, it utilizes **Tonal Layers** and **Low-Contrast Outlines** to create hierarchy.

- **Surface Levels:** The primary background uses the lightest neutral gray. Content containers (cards, table headers) use pure white to pop against the background.
- **Outlines:** Elements are defined by 1px solid borders in a light gray (#E2E8F0). 
- **Subtle Depth:** Shadows are only used on floating elements (modals, dropdowns) and are extremely soft and diffused (e.g., `0 4px 6px -1px rgba(0, 0, 0, 0.05)`). This keeps the interface feeling flat, organized, and professional.

## Shapes

The shape language is conservative and disciplined. A **Soft (Level 1)** roundedness is applied to buttons and inputs (4px), providing a modern touch without appearing overly casual. 

Data containers and tables should use sharp corners or the minimum 4px radius to maximize the use of screen real estate and align with the linear nature of spreadsheet-style data.

## Components

### Data Tables
The core component of the system. Tables must feature:
- Sticky headers for long payroll lists.
- Zebra-striping (alternating row colors) for row tracking.
- Inline actions that appear on hover to reduce visual noise.
- Monospaced numerical alignment for financial columns.

### Status Badges
Status indicators use a "Pill" shape with a light background tint and dark text:
- **Draft:** Light Gray background / Slate text.
- **Locked:** Slate background / White text.
- **Approved:** Light Green background / Dark Green text.

### Buttons & Inputs
- **Primary Button:** Solid Professional Blue with white text.
- **Secondary Button:** White background with a Slate border.
- **Input Fields:** Standardized height of 36px for high-density forms, using a 1px border that darkens on focus.

### Complex Administrative Tools
- **Filter Bars:** Located directly above tables, using a horizontal layout to conserve vertical space.
- **Summary Cards:** Small, borderless cards at the top of payroll pages highlighting "Total Payout," "Employee Count," and "Pending Approvals" using the primary blue for emphasis.