# MediScribe Login Portal Refresh — PRD & Implementation Plan

## 1. Context & Scope

**Target Page:** `/login` (Portal Landing Page — `frontend/src/app/login/page.tsx`)  
**Entry Point:** "Log In" / "Get Started" buttons on Home page Navbar  
**Downstream Pages:** Role-specific login forms (`/login/receptionist`, `/login/doctor`, `/login/pharmacist`, `/login/admin`) — **NOT in scope**.

---

## 2. Current State Analysis

| Aspect | Current | Pain Points |
|--------|---------|-------------|
| **Layout** | 2×2 grid on dark gradient bg | Utilitarian; no visual hierarchy |
| **Typography** | Mixed sizing; heading font only on brand | No consistent type scale |
| **Color/Theme** | `--color-workspace-bg` (#1F2937) + radial gradients | Clashes with light Home page |
| **Cards** | Dark glassmorphism, colored accent borders | Hover only; no keyboard/focus/loading states |
| **Accessibility** | Basic HTML; no ARIA; global focus-visible only | Keyboard nav unclear; no screen reader support |
| **Responsive** | Stacks < 840px | Cramped mobile; no touch targets |
| **Trust** | Lock icon + "ABDM Compliant" | Minimal credibility signals |
| **Motion** | Card hover lift + border glow | No entrance; no press feedback |

---

## 3. Design Constraints (Non-Negotiable)

- **Zero new colors** — Use ONLY existing tokens from `globals.css`
- **Zero SVGs/illustrations** — No custom icons, no "AI slop" graphics
- **Zero default AI palettes** — No purple/blue/indigo gradients unless already in your system
- **Clean, clinical, professional** — Typography + spacing + your existing green accent
- **Emoji icons are fine** — Current emoji (📝 🩺 💊 📊) acceptable if you prefer

### Your Existing Tokens (Source of Truth)

```css
/* globals.css — USE THESE ONLY */
--color-workspace-bg: #1F2937;        /* Page background */
--color-sidebar-bg: #111827;          /* Card surface */
--color-text-primary: #FFFFFF;         /* Primary text */
--color-text-secondary: #CBD5E1;       /* Secondary text */
--color-accent-green: #10B981;         /* Primary accent (focus, hover, CTA) */
--color-accent-green-dark: #059669;    /* Accent hover */
--font-family-sans: 'DM Sans', ...;    /* Body font */
--font-family-heading: 'Outfit', ...;  /* Heading font */
```

---

## 4. Proposed Design (Using Your Tokens Only)

### 4.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  HERO (centered, generous vertical padding)                 │
│  ├─ ☤ MediScribe AI      (existing brand, larger)           │
│  ├─ Headline: "Select your portal"                          │
│  └─ Sub: "Choose your role to continue"                     │
├─────────────────────────────────────────────────────────────┤
│  PORTAL GRID (2×2 desktop, 1×4 mobile)                      │
│  ├─ Reception & Intake    → /login/receptionist             │
│  ├─ Doctor Portal         → /login/doctor                   │
│  ├─ Pharmacy Dispatch     → /login/pharmacist               │
│  └─ Super Admin           → /login/admin                    │
├─────────────────────────────────────────────────────────────┤
│  TRUST BAR (minimal, one line)                              │
│  └─ "ABDM Compliant • HIPAA-Ready • AES-256 Encryption"     │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Card Design (Clean, No Gradients)

```
┌─────────────────────────────────────────────────────────────┐
│  📝  Reception & Intake                                      │
│      Patient registration and queue management.             │
│  ─────────────────────────────────────────────────────────  │  ← 1px accent line
│  [ Open Patient Queue ]                                      │  ← Button: your green
└─────────────────────────────────────────────────────────────┘
```

**Card Spec:**
- Background: `--color-sidebar-bg` (#111827)
- Border: `1px solid rgba(255,255,255,0.08)`
- Radius: 12px (consistent with dashboard)
- Padding: 24px
- Title: `--font-family-heading`, 1.125rem, `--color-text-primary`
- Description: `--font-family-sans`, 0.875rem, `--color-text-secondary`
- Divider: `1px solid --color-accent-green` (subtle)
- CTA Button: `--color-accent-green` bg, white text, 10px radius

**States (CSS only, no JS animation library):**
- Hover: Border → `--color-accent-green`, shadow `0 8px 24px rgba(0,0,0,0.3)`
- Focus-visible: `outline: 2px solid --color-accent-green; outline-offset: 2px`
- Active/Press: `transform: scale(0.98)`
- Loading: Button disabled, spinner, "Opening..."

### 4.3 Typography (Your Fonts, Sensible Scale)

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Brand | Heading | 2rem | 800 | Primary + Accent on "AI" |
| Headline | Heading | 1.5rem | 600 | Primary |
| Sub-headline | Sans | 1rem | 400 | Secondary |
| Card Title | Heading | 1.125rem | 600 | Primary |
| Card Desc | Sans | 0.875rem | 400 | Secondary |
| Button | Sans | 0.875rem | 600 | White |
| Trust Bar | Sans | 0.75rem | 500 | Secondary |

### 4.4 Motion (CSS Only, Respects `prefers-reduced-motion`)

| Trigger | Animation |
|---------|-----------|
| Page load | Fade + translateY(20px) → 0, 400ms ease-out, stagger 80ms/card |
| Card hover | Border color + shadow, 150ms ease-out |
| Card press | Scale 0.98, 50ms |
| Focus ring | Outline appear, 100ms |
| Button hover | Background → `--color-accent-green-dark` |

---

## 5. Technical Implementation

### 5.1 Files to Change

| File | Action |
|------|--------|
| `frontend/src/app/login/page.tsx` | Rewrite |
| `frontend/src/app/login/Login.module.css` | Replace entirely |
| `frontend/src/app/login/portals.config.ts` | Create (data config) |

**No new components folder. No Framer Motion. No new globals.css tokens.**

### 5.2 Data Config (`portals.config.ts`)

```ts
export const PORTALS = [
  { id: 'receptionist', title: 'Reception & Intake', desc: 'Patient registration and queue management.', icon: '📝', cta: 'Open Patient Queue', href: '/login/receptionist' },
  { id: 'doctor', title: 'Doctor Portal', desc: 'Live AI Scribe and EMR review workspace.', icon: '🩺', cta: 'Access Workspace', href: '/login/doctor' },
  { id: 'pharmacist', title: 'Pharmacy Dispatch', desc: 'Secure prescription and patient handover.', icon: '💊', cta: 'Open Dispensary', href: '/login/pharmacist' },
  { id: 'admin', title: 'Super Admin', desc: 'Clinic oversight and system configuration.', icon: '📊', cta: 'Access Dashboard', href: '/login/admin' },
] as const;
```

### 5.3 Component Structure (Single File, Colocated)

```tsx
// page.tsx
export default function LoginPage() {
  const router = useRouter();
  return (
    <main className={styles.page}>
      <header className={styles.hero}>...</header>
      <section className={styles.grid} aria-label="Access portals">
        {PORTALS.map(p => <PortalCard key={p.id} portal={p} router={router} />)}
      </section>
      <footer className={styles.trust}>ABDM Compliant • HIPAA-Ready • AES-256 Encryption</footer>
    </main>
  );
}

function PortalCard({ portal, router }) {
  const [loading, setLoading] = useState(false);
  const handleClick = () => { setLoading(true); router.push(portal.href); };
  return (
    <article className={styles.card} onClick={handleClick} onKeyDown={...} tabIndex={0} role="button" aria-label={portal.title}>
      <span className={styles.icon}>{portal.icon}</span>
      <h3 className={styles.title}>{portal.title}</h3>
      <p className={styles.desc}>{portal.desc}</p>
      <hr className={styles.divider} />
      <button className={styles.cta} disabled={loading}>{loading ? 'Opening...' : portal.cta}</button>
    </article>
  );
}
```

---

## 6. Implementation Phases

| Phase | Tasks | Est. |
|-------|-------|------|
| **1. Config & CSS** | Create `portals.config.ts`, rewrite `Login.module.css` with your tokens | 2-3h |
| **2. Page Rewrite** | New `page.tsx` with Hero, Grid, TrustBar, `PortalCard` inline | 3-4h |
| **3. Polish** | Stagger entrance (CSS), focus states, loading UX, responsive | 2h |
| **4. A11y/QA** | Keyboard test, screen reader, Lighthouse, contrast check | 1-2h |

**Total: ~1-1.5 days**

---

## 7. Open Questions (Need Your Input)

1. **Hero headline:** "Select your portal" / "Choose your access" / "Your clinical workspace" / other?
2. **Trust bar text:** Exact wording? (I used "ABDM Compliant • HIPAA-Ready • AES-256 Encryption")
3. **Keep emoji icons?** (📝 🩺 💊 📊) — or replace with text-only?
4. **Card click behavior:** Whole card clickable (current) OR only CTA button? (I proposed whole card + button)
5. **Page background:** Keep `--color-workspace-bg` (#1F2937) or darker `--color-sidebar-bg` (#111827)?

---

## 8. What This Plan Explicitly Avoids

- ❌ New color tokens
- ❌ SVG icons/illustrations
- ❌ Framer Motion / animation libraries
- ❌ Gradient backgrounds (radial, linear, mesh)
- ❌ Glassmorphism / backdrop-filter
- ❌ "AI" aesthetic (purple/indigo, glowing orbs, cylindrical shapes)
- ❌ Badge clusters, trust logos, statistic counters
- ❌ Component folder extraction (keep it simple)

---

*Ready to proceed when you confirm the 5 questions above.*