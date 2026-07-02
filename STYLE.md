# Jorgensen Foundation — Style & Design System

The single reference for how the site looks and behaves. The machine-readable
source of truth for colors and type is [`src/css/tokens.css`](src/css/tokens.css);
this document explains the tokens **and** the higher-level patterns (heroes,
breakpoints, 3Dmol viewers, mobile rules) so styling stays consistent site-wide.

> **Rule of thumb:** reach for a token or a documented pattern before hardcoding a
> value. If you need something new, add it here and in `tokens.css` rather than
> sprinkling one-off numbers across page CSS.

---

## 1. Color

Theme: **"Midnight / Stone / Oyster on white."** White-bodied pages, midnight-ink
structure, oyster hairlines, with a cream palette reserved for dark hero sections.

| Token | Hex | Use |
|---|---|---|
| `--ground` | `#ffffff` | Page background |
| `--ink` | `#302C2E` | Headings, primary text, dark hero backgrounds |
| `--ink-hover` | `#211e20` | Primary-button hover deepen |
| `--body` | `#53534C` | Body copy |
| `--surface` | `#DEDCD5` | Tags, cards, active-nav fill |
| `--hairline` | `#DEDCD5` | Decorative hairlines & borders |
| `--cream` | `#f4efe4` | Text/marks **on dark hero sections only** |
| `--hero-overlay` | `rgba(9,10,13,0.82)` | Gradient scrim over hero media |

- On dark heroes, derive translucent tints with `color-mix(in srgb,var(--cream) N%,transparent)`
  rather than new hex values.
- `--cream` must never appear on white surfaces (invisible). `--ink`/`--body` must
  never appear on dark heroes.

---

## 2. Typography

| Token | Value | Use |
|---|---|---|
| `--font-serif` | `'Cormorant Garamond', Georgia, serif` | Display & headings — weight **300**, italic `<em>` accent |
| `--font-sans` | `Helvetica, Arial, sans-serif` | Body copy + all UI |
| `--fs-body` | `1.0625rem` (17px) | Body paragraphs |
| `--fs-body-lg` | `1.1875rem` (19px) | Lead / intro paragraphs |
| `--fs-small` | `0.875rem` (14px) | Captions/meta — **never below ~13px** |
| `--fs-eyebrow` | `0.72rem` (~11.5px) | Uppercase letter-spaced labels |
| `--lh-body` | `1.8` | Body line-height |

- **Headings**: serif, weight 300, tight line-height (~1.04–1.1), with an italic
  `<em>` for the accent word ("of _Discovery_", "what it _does._").
- **Eyebrows / tags**: sans, uppercase, letter-spacing `0.2em–0.32em`, small.
- Fluid heading sizes use `clamp()`, e.g. hero H1 `clamp(3rem,7vw,5.5rem)`.

---

## 3. Breakpoints

Use these standard breakpoints. (The codebase still has a few legacy values —
380/560/720/960 — prefer the standard set below for new work and migrate when
you touch a file.)

| Name | Query | Targets |
|---|---|---|
| Phone | `max-width:600px` | Phones (portrait) |
| Phone / small | `max-width:760px` | Large phones, small tablets portrait |
| Tablet | `max-width:900px` | iPad portrait and below |
| iPad landscape | `min-width:901px) and (max-width:1024px` | iPad landscape band |
| Desktop | `min-width:1025px` | Everything larger |

---

## 4. Heroes

Two hero systems share the cream-on-ink language but differ structurally.

### 4a. Homepage hero (`.hp-hero`)
- Full-bleed, `height:100svh` (see §6 on viewport units), content bottom-aligned.
- Carries a live 3Dmol structure (`.hp-hero__viewer`, `#hp-hero-bio`) at `inset:0`.
- **Scroll guards (all breakpoints):** transparent `::before`/`::after` strips
  (top ~32%, bottom ~30%, `z-index:1`, `pointer-events:auto`) sit above the
  canvas but below the content. They confine drag-to-rotate to the central band
  so swipes over the top/bottom scroll the page; the molecule's size/visuals are
  unchanged and the CTA (above them) stays clickable.
- **Mobile (`max-width:760px`):** the molecule stays full-bleed (`inset:0`) for
  the same large proportions as iPad; the scroll guards grow (top `42%`, bottom
  `38%`) so the central drag-to-rotate band is smaller. The scroll cue drops to
  `bottom:0.75rem` so it never touches the CTA.

### 4b. Program heroes (`.hero.hero--<name>`)
boss · mcpro · fep · opls · bomb · visualisation. Shared base in
`components.css`; per-page accent + 3Dmol viewer in each `src/css/<page>.css`.

- **Desktop:** `height:90svh; min-height:680px`, content bottom-aligned, a live
  3Dmol viewer on the right (`width:55%`) with a floating data readout.
- **iPad landscape (901–1024px):** viewer trimmed to `width:50%; opacity:0.85`.
- **Mobile (`max-width:900px`):** viewer goes full-width and **faint
  (`opacity:0.2`)** as a pure backdrop; the floating readout is **hidden**
  (`display:none`) so it never collides with the headline.
- **Mobile spacing (`max-width:600px`):** program heroes switch to
  `min-height:90svh; height:auto; align-items:flex-start` (fills ~90% of the
  viewport with a peek of the next section) and the content gets `padding-top:16rem`.
  This anchors the eyebrow a **fixed distance below the fixed nav (~170px gap)** so
  the nav→eyebrow spacing is identical on every program page and every device,
  instead of scaling with viewport height. This single rule lives in
  `components.css` and targets `.hero[class*="hero--"]`, so plain `.hero` pages
  (terms, privacy, contact) are untouched.

### Shared hero rules
- Plain `.hero` (terms/privacy/contact/etc.): `height:70svh; min-height:480px`.
- Always pair a dark hero with `--cream` text and the `--hero-overlay` scrim.
- `overflow:hidden` on heroes — verify content never clips at the **top** on short
  (landscape) viewports.

---

## 5. 3Dmol viewer conventions

- Container id (`#hp-hero-bio`, `#boss-viewer`, …) holds an absolutely-positioned
  viewer div; 3Dmol sizes its canvas to the container, so **control size via CSS**
  on the container and the canvas follows (including media-query changes at load).
- The viewer canvas is the only touch-interactive layer in a hero. On mobile it
  will eat every swipe (rotate) unless a canvas-free zone exists for scrolling —
  either shrink/relocate the canvas (homepage) or rely on the page area below it.
- Decorative readouts (`.*-hero__readout`) are **hidden ≤900px**.
- Program-hero mobile molecule opacity is **0.2** (faint backdrop); desktop full.

### Molecular brand palette
All molecule viewers use the warm site palette (never CPK defaults / cool blues):
- C `#DEDCD5` oyster · H `#F4EFE4` cream · O `#C9824E` amber · **N `#AFA290` warm
  taupe** (was a cool slate-blue — retoned warm) · S `#E3C766` · P `#CB8E5A`.
- Proteins: single-colour **oyster** cartoon + **amber** ligand/inhibitor.
- Viewer background is `#302C2E` (`--ink`).
- Shared by `hp-hero-bio.js`, `bio.js`, `surface.js`, `lab.js`.

### Fitting molecules (per-viewer JS)
Some molecules overflow narrow mobile canvases, so the viewer JS sizes them
responsively via `matchMedia('(max-width:760px)')`:
- `bio.js` (cholesterol band): `zoom` 0.7 on mobile, and `index.css` lifts the
  viewer `transform:translateY(-25%)` so it clears the heading text.
- `lab.js` (the "From parameters to insight" molecule): `zoom` **0.4 desktop /
  0.28 mobile** so even a flat molecule's widest spin orientation keeps margin.

### Battery/heat — UNRESOLVED tradeoff (read before touching the hero spin)
Continuous WebGL spin of complex structures heats phones/iPads. We tried several
mitigations — fps-throttling, time-scaled (`dt`) rotation, a
`window.devicePixelRatio` cap to 2×, and lighter `setDefaultCartoonQuality` —
but they made the spin **clunky/stuttery** and the DPR cap **dropped iPhone
definition (3×→2×)**. All of this was **reverted on the homepage hero**, which is
back to the original simple loop: render every frame, fixed `viewer.rotate(0.2)`,
pause off-screen, respect `prefers-reduced-motion`. **Do not re-add fps gates,
dt-scaling, or a DPR cap to the homepage hero.** (The 5 program-page spin viewers
— surface/visualisation/opls/fep/bomb — still carry a legacy 45fps gate +
time-scaled rotation; revert them to a plain fixed-step loop if they feel clunky.)
If heat is revisited, do it **without** degrading smoothness or definition.

### Device colour/brightness
iPhone/iMac reading *darker* than iPad is the **displays** (True Tone / Night
Shift / OLED), not the site. `color-scheme:light` is declared (meta + tokens.css);
don't chase this difference in code.

---

## 6. Viewport units (important)

Use **`svh`, not `vh`**, for hero/section heights, with a `vh` fallback for old
browsers:

```css
.hero { height: 90vh; height: 90svh; }
```

`vh` measures the viewport with mobile browser toolbars **hidden**, so
bottom-aligned hero content hides behind the address bar on load. `svh` (small
viewport height) uses the toolbar-visible size and keeps content on-screen. All
hero/feature/split/lab heights follow this pattern.

---

## 7. Components

- **Buttons:** uppercase sans, letter-spacing `~0.22em`, padding `~0.9rem 2.5rem`.
  - Primary (light on dark hero): cream fill, inverts to outline on hover.
  - Ghost: 1px translucent cream border, brightens on hover.
  - Dark (on white): `--ink` fill → `--ink-hover`.
- **Cards / tags:** `--surface` fill or `--hairline` 1px border; minimal/no shadow.
- **Eyebrow label:** `.eyebrow` / `.hero-tag` — uppercase, letter-spaced, small.
- **Scroll cue:** thin animated bar + "SCROLL"; bottom-right on desktop, tucked to
  the corner on mobile so it clears CTAs.

---

## 8. Layout & spacing

- Section horizontal padding: `3rem` desktop → `1.5rem` mobile (`max-width:960px`).
- Generous vertical rhythm; multi-column grids (`cap-grid`, `io-grid`, `split`)
  collapse to one column by the Tablet breakpoint.
- Keep design tokens in `tokens.css`; reuse them rather than hardcoding values.

---

## 9. Where things live

- `src/css/tokens.css` — colors, type families/scale (source of truth).
- `src/css/components.css` — shared hero, buttons, shared mobile rules.
- `src/css/nav.css` — fixed hero nav (`position:fixed`, ~87px tall on mobile).
- `src/css/<page>.css` — per-page styles + that page's 3Dmol viewer accent.
- `src/css/index.css` — homepage (its own `.hp-*` hero/feature/lab system).
- `src/styleguide.njk` — live visual styleguide page.

---

## 10. Email signature

Chosen design (catalog #31): **name-first** layout — name (serif) → title (small-caps)
→ horizontal lockup → stacked contacts (email / phone / web). Not yet wired into any
mail system; saved here to roll out properly later.

Conventions:
- Table-based with **inline styles** (Gmail / Apple Mail / Outlook compatible).
- Logo is referenced by **absolute `www` URL** — `https://www.jorgensenfoundation.org/...`
  — because the apex domain 307-redirects to `www` and mail clients shouldn't chase it.
- Colors are the brand tokens: ink `#302C2E`, body `#53534C`, muted label `#8a847c`;
  on dark, cream `#f4efe4`, oyster body `#DEDCD5`, muted `#b8b2a6`.
- Replace the `[bracketed]` fields. The `[Title]` line is optional.

### Version A — light backgrounds (midnight lockup + dark ink)

```html
<!-- Jorgensen Foundation — email signature (#31, light) -->
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
  <tr><td style="padding:0;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:22px;color:#302C2E;">[Full Name]</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:14px;letter-spacing:1.8px;text-transform:uppercase;color:#8a847c;padding-top:5px;">[Title]</div>
    <div style="height:15px;line-height:15px;font-size:0;">&nbsp;</div>
    <a href="https://www.jorgensenfoundation.org" target="_blank" style="text-decoration:none;border:0;outline:none;">
      <img src="https://www.jorgensenfoundation.org/img/brand/jf-lockup-midnight-1024.png" alt="Jorgensen Foundation" width="240" height="20" style="display:block;width:240px;height:20px;border:0;outline:none;">
    </a>
    <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;">
      <div><a href="mailto:[name@jorgensenfoundation.org]" style="color:#302C2E;text-decoration:none;">[name@jorgensenfoundation.org]</a></div>
      <div style="color:#53534C;">[+1 (415) 555&#8209;0123]</div>
      <div><a href="https://www.jorgensenfoundation.org" target="_blank" style="color:#302C2E;text-decoration:none;font-weight:bold;">jorgensenfoundation.org</a></div>
    </div>
  </td></tr>
</table>
```

### Version B — dark backgrounds (cream lockup + light ink)

```html
<!-- Jorgensen Foundation — email signature (#31, dark) -->
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
  <tr><td style="padding:0;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:22px;color:#f4efe4;">[Full Name]</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:14px;letter-spacing:1.8px;text-transform:uppercase;color:#b8b2a6;padding-top:5px;">[Title]</div>
    <div style="height:15px;line-height:15px;font-size:0;">&nbsp;</div>
    <a href="https://www.jorgensenfoundation.org" target="_blank" style="text-decoration:none;border:0;outline:none;">
      <img src="https://www.jorgensenfoundation.org/img/brand/jf-lockup-cream-1024.png" alt="Jorgensen Foundation" width="240" height="20" style="display:block;width:240px;height:20px;border:0;outline:none;">
    </a>
    <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;">
      <div><a href="mailto:[name@jorgensenfoundation.org]" style="color:#f4efe4;text-decoration:none;">[name@jorgensenfoundation.org]</a></div>
      <div style="color:#DEDCD5;">[+1 (415) 555&#8209;0123]</div>
      <div><a href="https://www.jorgensenfoundation.org" target="_blank" style="color:#f4efe4;text-decoration:none;font-weight:bold;">jorgensenfoundation.org</a></div>
    </div>
  </td></tr>
</table>
```

> **Recommended default — dark-mode-safe single signature.** Versions A and B are each
> transparent and only legible on their intended background. To use **one** signature
> everywhere, wrap Version A in a white "card": set the white background with **both** the
> `bgcolor="#ffffff"` attribute *and* inline `background-color` (the attribute is what Outlook
> and most dark-mode clients honor), plus padding and an optional `1px #eceae4` border —
> the card stays white and the dark ink/logo stay readable on light *and* dark surfaces.
> (A few aggressive mobile clients can still force-invert; this is the best available defense.)
