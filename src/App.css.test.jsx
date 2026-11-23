// @maintained-by-ai
/**
 * Contract tests for App.css.
 *
 * These verify the styling contracts the app's JSX relies on (app shell
 * layout and the shared `ct-*` campaign-tool component family used by
 * Factions, Notes, NPCs, Quests, Settlements, Sessions and PartyInventory),
 * not incidental formatting:
 *
 *  - Rules are parsed into selector → property maps, so assertions match
 *    exact normalized declaration values instead of brittle substrings
 *    (`toContain('flex: 1')` would also pass `flex: 1 0 auto`).
 *  - CSS comments are stripped before parsing, so commented-out rules can
 *    never satisfy an assertion.
 *  - Assertions test semantics (layout modes, viewport units, positive
 *    feedback relationships like "hover brighter than resting"), not exact
 *    cosmetic values — designer nudges shouldn't break the contract, but
 *    removing an interaction affordance or breakpoint should.
 *  - The `!important` guard removes @media blocks by parse position rather
 *    than fragile string replacement, and is kept honest by asserting the
 *    print block DOES use !important.
 *  - Theme tokens consumed via `var()` must be declared in the global
 *    theme (index.css) or carry an inline fallback — a rename in either
 *    file breaks the contract loudly.
 *
 * Selectors with no JSX consumer (e.g. legacy .icon-button, campaign
 * action buttons, .theme-toggle-btn, button.download/.hidden) are
 * deliberately NOT covered here — dead CSS gets no contract.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Read a stylesheet and strip /* ... *\/ comments before parsing. */
const readCss = (file) => readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

const css = readCss(join(SRC_DIR, 'App.css'));

/** index.css holds the light/dark theme custom properties App.css consumes. */
const themeCss = readCss(join(SRC_DIR, 'index.css'));

/** Fixed sidebar lives in its own file; its width reserves .app-body's gutter. */
const sidebarCss = readCss(join(SRC_DIR, 'components/sidebar/Sidebar.css'));

const normalize = (s) => s.trim().replace(/\s+/g, ' ');
const normalizeSelector = (s) => normalize(s).toLowerCase();

function parseDeclarations(body) {
  const props = {};
  for (const decl of body.split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const value = normalize(decl.slice(colon + 1)).toLowerCase();
    if (prop) props[prop] = value;
  }
  return props;
}

/** Parse a flat block of rules (used inside @media bodies). */
function parseRules(block) {
  const rules = [];
  const regex = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = regex.exec(block)) !== null) {
    rules.push({
      selector: normalizeSelector(match[1]),
      props: parseDeclarations(match[2]),
    });
  }
  return rules;
}

/**
 * Parse a stylesheet into top-level rules and @media blocks.
 * Block extents are found by brace-depth tracking so nested rules and the
 * print block's !important never confuse downstream extraction.
 */
function parseStylesheet(source) {
  const topRules = [];
  const mediaQueries = new Map();
  let i = 0;
  while (i < source.length) {
    const brace = source.indexOf('{', i);
    if (brace === -1) break;
    const prelude = normalize(source.slice(i, brace));
    let depth = 1;
    let j = brace + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}') depth--;
      j++;
    }
    const body = source.slice(brace + 1, j - 1);
    if (prelude.toLowerCase().startsWith('@media')) {
      mediaQueries.set(prelude, parseRules(body));
    } else {
      topRules.push({ selector: normalizeSelector(prelude), props: parseDeclarations(body) });
    }
    i = j;
  }
  return { topRules, mediaQueries };
}

const { topRules, mediaQueries } = parseStylesheet(css);

/** Sidebar.css keeps its own small-screen @media block; parse it with the
 *  same block-aware parser so media rules never leak into the base lookup. */
const { mediaQueries: sidebarMediaQueries } = parseStylesheet(sidebarCss);

/** Sessions lane ships a wider planner modal; its width law lives here. */
const sessionsCss = parseRules(readCss(join(SRC_DIR, 'components/sessions/Sessions.css')));

/** NPCs lane ships a wider stat editor; its width law lives here too. */
const npcsCss = parseRules(readCss(join(SRC_DIR, 'components/npcs/NPCs.css')));

/** Initiative GM control row + Encounters toolbar ride the narrow-viewport
 *  wrap law (2026-11-23 backlog); their rules live in the lane CSS. */
const initiativeCss = parseRules(readCss(join(SRC_DIR, 'components/initiative/Initiative.css')));
const encounterCss = parseRules(readCss(join(SRC_DIR, 'components/encounter/EncounterBuilder.css')));

/** Narrow-viewport lane-debt pass (2026-11-23 backlog): CharSheet, Log and
 *  Maps-manager lane rules pin the wrap / border-box / min-width:0 kit laws
 *  in their own component stylesheets. */
const charActionsCss = parseRules(readCss(join(SRC_DIR, 'components/char-sheet/CharActions.css')));
const charSpellsCss = parseRules(readCss(join(SRC_DIR, 'components/char-sheet/char-spells/CharSpells.css')));
const charSlotLevelsCss = parseRules(readCss(join(SRC_DIR, 'components/char-sheet/char-spells/CharSpellSlots.css')));
const logLaneCss = parseRules(readCss(join(SRC_DIR, 'components/log/Log.css')));
const mapsManagerCss = parseRules(readCss(join(SRC_DIR, 'components/maps-manager/MapsManager.css')));
// index.css carries an @media print block before .char-reactions .attacks —
// use the block-aware parser so media rules never taint the lookup.
const indexTopRules = parseStylesheet(themeCss).topRules;

/**
 * Cascade-aware lookup: merges declarations from every top-level rule whose
 * (possibly comma-grouped) selector matches, later rules winning.
 */
function styleFor(selector, rules = topRules) {
  const target = normalizeSelector(selector);
  const props = {};
  let found = false;
  for (const rule of rules) {
    const parts = rule.selector.split(',').map((p) => p.trim());
    if (parts.includes(target)) {
      found = true;
      Object.assign(props, rule.props);
    }
  }
  return found ? props : null;
}

/** Same lookup, scoped to a parsed @media block. */
function styleInMedia(query, selector) {
  const rules = mediaQueries.get(normalize(query));
  if (!rules) return null;
  return styleFor(selector, rules);
}

/** Assert every expected declaration holds, naming the offending selector. */
function expectStyles(selector, expected, source = 'App.css') {
  const props = source === 'App.css' ? styleFor(selector) : styleInMedia(source, selector);
  expect(props, `${source}: rule for "${selector}" should exist`).not.toBeNull();
  for (const [prop, value] of Object.entries(expected)) {
    expect(props[prop], `${source}: "${selector}" should declare "${prop}: ${value}"`).toBe(value);
  }
}

/** Assert a hover/state rule visibly changes a property from its resting value. */
function expectChanges(selector, hoverSelector, prop) {
  expectStyles(selector, {});
  const hoverProps = styleFor(hoverSelector);
  expect(hoverProps, `rule for "${hoverSelector}" should exist`).not.toBeNull();
  expect(
    hoverProps[prop],
    `"${hoverSelector}" should change "${prop}" from its resting value`
  ).toBeTruthy();
  expect(hoverProps[prop]).not.toBe(styleFor(selector)[prop]);
}

describe('App.css', () => {
  describe('file hygiene', () => {
    it('keeps !important confined to the print media block', () => {
      // The print block legitimately needs !important to override the app
      // layout on paper; nothing else may use it.
      const printRules = mediaQueries.get('@media print');
      expect(printRules, 'expected an @media print block').toBeDefined();
      const printUsesImportant = printRules.some((rule) =>
        Object.values(rule.props).some((v) => v.includes('!important'))
      );
      expect(printUsesImportant, 'print block should still force display: none with !important').toBe(true);

      // Rebuild the non-print CSS from the parse (comments already gone).
      const nonPrint =
        topRules.map((r) => Object.values(r.props).join(';')).join(';') +
        [...mediaQueries.entries()]
          .filter(([query]) => normalize(query) !== '@media print')
          .flatMap(([, rules]) => rules.flatMap((r) => Object.values(r.props)))
          .join(';');
      expect(nonPrint).not.toMatch(/!important/);
    });

    it('only consumes theme tokens that are globally defined or have a fallback', () => {
      const definedTokens = new Set([
        ...[...themeCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
        // Layout tokens owned by App.css itself (e.g. --sidebar-w, declared
        // next to the dock law it shares a breakpoint with) count as defined.
        ...topRules.filter((r) => r.selector === ':root').flatMap((r) => Object.keys(r.props)),
      ]);

      const used = [...css.matchAll(/var\(\s*(--[\w-]+)((?:[^()]|\([^()]*\))*)\)/g)];
      expect(used.length, 'App.css should consume theme tokens via var()').toBeGreaterThan(0);

      for (const match of used) {
        const [, token, rest] = match;
        const hasFallback = rest.trim().startsWith(',');
        expect(
          hasFallback || definedTokens.has(token),
          `theme token ${token} is used without fallback but never declared in index.css or App.css :root`
        ).toBe(true);
      }
    });
  });

  describe('app shell layout', () => {
    it('stacks the shell at full viewport height and keeps main content scrollable', () => {
      expectStyles('.app', {
        height: '100vh',
        display: 'flex',
        'flex-direction': 'column',
      });
      // min-height: 0 lets the flex child scroll instead of overflowing.
      expectStyles('.app-body', {
        display: 'flex',
        flex: '1',
        'min-height': '0',
      });
    });

    it('reserves a gutter in .app-body exactly as wide as the fixed sidebar', () => {
      // A mismatch slides page content under (or leaves a gap beside) the sidebar.
      const sidebar = styleFor('.sidebar', parseRules(sidebarCss));
      expect(sidebar, 'Sidebar.css should style .sidebar').not.toBeNull();
      expect(sidebar.position, 'sidebar should be fixed').toBe('fixed');
      // The gutter rides the --sidebar-w token — the single pairing point with
      // the fixed-overlay family — so the contract is: token feeds the gutter,
      // and the token's desktop value equals the sidebar width.
      expect(styleFor('.app-body')['padding-left']).toBe('var(--sidebar-w)');
      expect(
        styleFor(':root')['--sidebar-w'],
        'gutter token must match .sidebar width'
      ).toBe(sidebar.width);
    });

    it('renders .half-line as a half-em vertical spacer', () => {
      expectStyles('.half-line', {
        height: '0.5em',
        'line-height': '0.5em',
      });
    });
  });

  describe('loading overlay', () => {
    // Contract for the blocking busy layer App.jsx renders on its three
    // loading faces (rules data / campaign / party-stats enrichment).
    // Backlog 2026-11-12 OP: the class had zero CSS, so the enrichment
    // band never dimmed or blocked the shell and the sidebar stayed
    // clickable over an empty roster.
    it('covers the whole viewport above every interactive surface', () => {
      expectStyles('.loading-overlay', {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        cursor: 'progress',
      });
      const overlay = styleFor('.loading-overlay');
      expect(
        overlay['background-color'],
        'overlay must dim (and pointer-block) the page behind it'
      ).not.toMatch(/^(none|transparent)$/);
      const sidebar = styleFor('.sidebar', parseRules(sidebarCss));
      expect(
        parseInt(overlay['z-index'], 10),
        'overlay must outrank the fixed sidebar so nav clicks cannot land'
      ).toBeGreaterThan(parseInt(sidebar['z-index'], 10));
      expect(
        parseInt(overlay['z-index'], 10),
        'overlay must outrank the 1000-tier modals while busy'
      ).toBeGreaterThanOrEqual(1100);
    });

    it('shows a centered spinner card with an animated ring', () => {
      expectStyles('.loading-spinner', {
        display: 'flex',
        'align-items': 'center',
      });
      const ring = styleFor('.loading-spinner::before');
      expect(ring, 'a ::before ring gives the band a visible spinner').not.toBeNull();
      expect(ring['border-radius'], 'ring should be circular').toBe('50%');
      expect(
        ring.animation,
        'ring animation should reference a declared keyframes block'
      ).toContain('loading-spin');
      expect(
        topRules.some((rule) => rule.selector === '@keyframes loading-spin'),
        '@keyframes loading-spin must be declared'
      ).toBe(true);
    });
  });

  describe('character summary buttons', () => {
    it('lays out the toolbar group; button skins ride the ct-* kit', () => {
      // flex-wrap is the narrow-viewport wrap law (2026-11-23 lane-debt
      // backlog): the 6-button group exceeds the 384px content region at
      // 420px, so the row must wrap instead of parking buttons off-window.
      expectStyles('.char-btn-group', { display: 'flex', 'align-items': 'center', 'flex-wrap': 'wrap' });
      // .ct-* kit convergence (tranche 2): the bespoke .char-btn skin was
      // removed — every former .char-btn site now rides the global kit tiers
      // (.ct-container .ct-btn / -primary / -danger / -sm). The .char-btn
      // class token survives on the buttons as a locator hook only, so the
      // retired rule must NOT come back.
      expect(
        topRules.filter((r) => ['.char-btn', '.char-btn:hover'].includes(normalizeSelector(r.selector))),
        '.char-btn styling rules were retired with the ct-* kit convergence'
      ).toHaveLength(0);
    });
  });

  describe('campaign tool container and header', () => {
    it('fills the content area with a spread header and an actionable new button', () => {
      // border-box shared kit law (2026-11-23 narrow-viewport backlog): the
      // 100% width must INCLUDE the padding — as content-box every kit screen
      // overflowed the window by 2×padding at narrow viewports (Initiative
      // rode this law privately; promoted to the kit tier).
      expectStyles('.ct-container', { flex: '1', width: '100%', 'box-sizing': 'border-box' });
      // Toolbar-wrap shared kit law: header rows wrap on overflow instead of
      // parking buttons off-window (promoted from the 600px media block).
      expectStyles('.ct-container .ct-header', {
        display: 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
        'flex-wrap': 'wrap',
      });
      expectStyles('.ct-container .ct-title', { color: 'var(--color-header)' });
      expectStyles('.ct-container .ct-new-btn', {
        background: 'var(--color-primary)',
        color: 'var(--color-text-inverse)',
        cursor: 'pointer',
      });
      expectChanges('.ct-container .ct-new-btn', '.ct-container .ct-new-btn:hover', 'background');
    });
  });

  describe('narrow-viewport toolbar wrap (2026-11-23 backlog)', () => {
    it('wraps the Initiative header and GM control rows in the lane CSS', () => {
      // Mirrors the shared .ct-header wrap law: at 420×760 the control row
      // must drop buttons onto wrapped rows instead of past the window edge.
      expect(
        styleFor('.initiative .combat-controls', initiativeCss)?.['flex-wrap'],
        'Initiative.css: .combat-controls must wrap on overflow'
      ).toBe('wrap');
      expect(
        styleFor('.initiative .combat-header', initiativeCss)?.['flex-wrap'],
        'Initiative.css: .combat-header must wrap on overflow'
      ).toBe('wrap');
    });

    it('wraps the Encounter Builder toolbar in the lane CSS', () => {
      expect(
        styleFor('.encounter-builder .encounter-actions', encounterCss)?.['flex-wrap'],
        'EncounterBuilder.css: .encounter-actions must wrap on overflow'
      ).toBe('wrap');
    });
  });

  describe('narrow-viewport lane debt (2026-11-23 backlog)', () => {
    it('scrolls the fixed-track attack/reaction grids inside their rows', () => {
      // The 645/725px fixed grid tracks cannot wrap without breaking the
      // table columns, so the Encounters-lane scroller idiom applies: the
      // row owns an overflow-x scroller and the document holds at
      // innerWidth (live-proved 420×760: row sw 725 / cw 364, docSW 420).
      expect(
        styleFor('.char-actions .attacks', charActionsCss)?.['overflow-x'],
        'CharActions.css: .attacks must be its own overflow-x scroller'
      ).toBe('auto');
      expect(
        styleFor('.char-reactions .attacks', indexTopRules)?.['overflow-x'],
        'index.css: .char-reactions .attacks must be its own overflow-x scroller'
      ).toBe('auto');
    });

    it('lets long spell-table tokens wrap instead of forcing width', () => {
      // The spells table min-content is the SUM of its seven columns'
      // longest unbreakable tokens (~390px at 420 viewports); anywhere-wrap
      // shrinks it below the container. A scroller was rejected because
      // .spell-popup-parent must stay overflow:visible for spell popups.
      expect(
        styleFor('.char-spells .table-spells th', charSpellsCss)?.['overflow-wrap'],
        'CharSpells.css: spell table cells must allow anywhere-wrapping of long tokens'
      ).toBe('anywhere');
    });

    it('wraps the spell-slot level row so its grid track can shrink', () => {
      expect(
        styleFor('.char-spell-slots.levels', charSlotLevelsCss)?.['flex-wrap'],
        'CharSpellSlots.css: the slot row must wrap on overflow'
      ).toBe('wrap');
    });

    it('wraps the Log composer and shrinks its flexed inputs', () => {
      expect(
        styleFor('.log-add-note', logLaneCss)?.['flex-wrap'],
        'Log.css: the composer row must wrap on overflow'
      ).toBe('wrap');
      expect(
        styleFor('.log-add-note textarea', logLaneCss)?.['min-width'],
        'Log.css: the flexed textarea must be allowed below its intrinsic size'
      ).toBe('0');
      expect(
        styleFor('.log-add-note input[type="text"]', logLaneCss)?.['min-width'],
        'Log.css: the flexed input must be allowed below its intrinsic size'
      ).toBe('0');
    });

    it('wraps the Maps-manager create row, list rows and action clusters', () => {
      expect(
        styleFor('.maps-manager-create', mapsManagerCss)?.['flex-wrap'],
        'MapsManager.css: the create row must wrap on overflow'
      ).toBe('wrap');
      expect(
        styleFor('.maps-manager-item', mapsManagerCss)?.['flex-wrap'],
        'MapsManager.css: list rows must wrap (actions drop under the name)'
      ).toBe('wrap');
      const actions = styleFor('.maps-manager-item-actions', mapsManagerCss);
      expect(actions?.['flex-wrap'], 'MapsManager.css: action clusters must wrap on overflow').toBe('wrap');
      // The retired flex-shrink: 0 pinned the cluster to its 588px
      // max-content width even on a wrapped line — it must not come back.
      expect(
        actions['flex-shrink'],
        'MapsManager.css: .maps-manager-item-actions must stay shrinkable so wrapping engages'
      ).not.toBe('0');
    });
  });

  describe('collapsible small-screen sidebar (2026-11-23 backlog)', () => {
    const MEDIA = '@media (max-width: 768px)';
    const sidebarTopRules = parseRules(sidebarCss);
    const sidebarMediaRules = () => sidebarMediaQueries.get(normalize(MEDIA));

    it('releases the 180px gutter to a ≤40px toggle column at small widths', () => {
      const desktop = parseFloat(styleFor(':root')['--sidebar-w']);
      const mobile = styleInMedia(MEDIA, '.app-body');
      expect(mobile, `expected ${MEDIA} to restyle .app-body`).not.toBeNull();
      const gutter = parseFloat(mobile['padding-left']);
      expect(gutter, 'small screens must release the sidebar column').toBeLessThan(desktop);
      expect(
        gutter,
        'reserved gutter must stay ≤40px so a 420px viewport keeps ≥380px of content'
      ).toBeLessThanOrEqual(40);
      // Tie-hardening: the media rule shares the base rule's 0-1-0
      // specificity, so document order is load-bearing — the block must come
      // after the base .app-body rule.
      expect(css.indexOf(MEDIA), '768px block must parse after the base .app-body rule')
        .toBeGreaterThan(css.indexOf('.app-body'));
    });

    it('docks the small-screen sidebar off-canvas until the drawer-open class', () => {
      const rules = sidebarMediaRules();
      expect(rules, 'Sidebar.css must ship a 768px media block').toBeDefined();
      const closed = styleFor('.sidebar', rules);
      expect(closed, 'the media block must restyle .sidebar').not.toBeNull();
      expect(closed.transform, 'closed drawer sits fully off-canvas').toBe('translatex(-100%)');
      // Durable law: the resting sidebar stays fixed page chrome at the
      // ≤100 tier in EVERY tier.
      expect(closed.position ?? styleFor('.sidebar', sidebarTopRules).position).toBe('fixed');
      expect(styleFor('.sidebar', sidebarTopRules)['z-index'], 'base sidebar keeps the ≤100 chrome tier').toBe('100');

      const open = styleFor('.sidebar.sidebar--drawer-open', rules);
      expect(open, 'an open-drawer rule must exist').not.toBeNull();
      expect(open.transform, 'the drawer slides back on-screen when open').toBe('translatex(0)');
      expect(
        parseInt(open['z-index'], 10),
        'the open drawer must clear app content (backdrop/modal 1000 tier)'
      ).toBeGreaterThanOrEqual(1000);
    });

    it('styles the toggle and backdrop as the drawer furniture (z-order laws)', () => {
      const toggle = styleFor('.sidebar-nav-toggle', sidebarTopRules);
      expect(toggle, 'the toggle must be pinned over the viewport').not.toBeNull();
      expect(toggle.position).toBe('fixed');
      expect(toggle.cursor).toBe('pointer');
      const backdrop = styleFor('.sidebar-nav-backdrop', sidebarTopRules);
      expect(backdrop, 'a dismiss backdrop is part of the drawer idiom').not.toBeNull();
      expect(backdrop.position).toBe('fixed');
      expect(
        backdrop['background-color'],
        'backdrop must dim (and pointer-block) the page behind the drawer'
      ).not.toMatch(/^(none|transparent)$/);
      // Toggle must stay clickable ABOVE the backdrop AND the open drawer
      // (it doubles as the close (×)); the backdrop must cover the closed
      // sidebar's chrome tier.
      expect(parseInt(toggle['z-index'], 10))
        .toBeGreaterThan(parseInt(backdrop['z-index'], 10));
      expect(parseInt(backdrop['z-index'], 10))
        .toBeGreaterThan(parseInt(styleFor('.sidebar', sidebarTopRules)['z-index'], 10));
    });
  });

  describe('fixed-overlay sidebar carve-out (bug-overlay-family-hardcodes-sidebar-carveout)', () => {
    const MEDIA = '@media (max-width: 768px)';

    /** Every fixed scrim that used to hard-code the 180px sidebar gutter.
     *  Below the dock breakpoint the sidebar is out of the flow, so an
     *  overlay that keeps the carve-out loses viewport it no longer needs:
     *  dead left strip, shoved-right modal, footer buttons clipped past
     *  100vw (measured live at 420×800). */
    const OVERLAY_FAMILY = [
      ['components/common/SavePromptModal.css', '.sp-overlay'],
      ['components/common/DeathSavePromptModal.css', '.dsp-overlay'],
      ['components/common/ConditionChoiceModal.css', '.cc-overlay'],
      ['components/common/ConcentrationPromptModal.css', '.cnp-overlay'],
      ['components/common/popup.css', '.popup-overlay'],
      ['components/sidebar/DiceTray.css', '.dice-tray-popup-overlay'],
      ['components/initiative/EffectAdder.css', '.ea-overlay'],
      ['components/initiative/QuickMonsterSpawn.css', '.qms-overlay'],
      ['components/encounter/MonsterCardModal.css', '.mc-overlay'],
      ['components/char-sheet/modals/CircleOfTheLandSpellsModal.css', '.cotl-overlay'],
      ['components/char-sheet/modals/ResourcePoolModal.css', '.resource-pool-overlay'],
      ['components/char-sheet/modals/NaturalRecoveryModal.css', '.nr-overlay'],
      ['components/char-sheet/modals/FontOfMagicModal.css', '.font-of-magic-overlay'],
    ];

    it('declares --sidebar-w at the sidebar width and zeroes it at the dock breakpoint', () => {
      expect(styleFor(':root'), 'App.css must own the :root gutter token').not.toBeNull();
      expect(styleFor(':root')['--sidebar-w']).toBe('180px');
      const docked = styleInMedia(MEDIA, ':root');
      expect(docked, `${MEDIA} must release the overlay carve-out entirely`).not.toBeNull();
      expect(docked['--sidebar-w']).toBe('0px');
      // Tie-hardening: the override shares the :root tier, so the media block
      // must parse after the base declaration.
      expect(
        css.indexOf(MEDIA),
        '768px block must parse after the base :root rule'
      ).toBeGreaterThan(css.indexOf(':root'));
    });

    it('anchors every fixed overlay scrim on the gutter token', () => {
      for (const [file, selector] of OVERLAY_FAMILY) {
        const rules = parseStylesheet(readCss(join(SRC_DIR, file))).topRules;
        const props = styleFor(selector, rules);
        expect(props, `${file}: rule for "${selector}" should exist`).not.toBeNull();
        expect(props.position, `${file}: "${selector}" is fixed page chrome`).toBe('fixed');
        expect(
          props.left,
          `${file}: "${selector}" must follow the sidebar gutter token`
        ).toBe('var(--sidebar-w)');
        if (props.width !== undefined) {
          expect(
            props.width,
            `${file}: "${selector}" width must subtract the token, not a literal`
          ).toBe('calc(100vw - var(--sidebar-w))');
        } else {
          // right-inset siblings (ea/qms/mc tiers) need only the token left.
          expect(props.right, `${file}: "${selector}" must inset right at 0`).toBe('0');
        }
      }
    });

    it('keeps the whole stylesheet tree free of hard-coded sidebar carve-outs', () => {
      // Census guard: a NEW overlay must ride the token, not re-hard-code
      // the gutter (comments stripped, so historical prose cannot pass or fail).
      const offenders = [];
      for (const entry of readdirSync(SRC_DIR, { recursive: true })) {
        if (!String(entry).endsWith('.css')) continue;
        const file = join(SRC_DIR, String(entry));
        const source = readCss(file);
        if (/left:\s*180px/.test(source) || /calc\(\s*100vw\s*-\s*180px\s*\)/.test(source)) {
          offenders.push(relative(SRC_DIR, file));
        }
      }
      expect(offenders, 'fixed overlays must use var(--sidebar-w), never a literal gutter').toEqual([]);
    });
  });

  describe('campaign tool search bar', () => {
    it('grows the input in a flex row with focus feedback and a reddening clear control', () => {
      expectStyles('.ct-container .ct-search-row', { display: 'flex' });
      expectStyles('.ct-container .ct-search-input', { flex: '1' });
      expectStyles('.ct-container .ct-search-input:focus', { 'border-color': 'var(--color-primary)' });
      expectStyles('.ct-container .ct-search-clear', {
        cursor: 'pointer',
        border: 'none',
      });
      expectStyles('.ct-container .ct-search-clear:hover', { color: 'var(--color-error)' });
    });
  });

  describe('campaign tool list', () => {
    it('stacks clickable card items with hover feedback and unclipped layout', () => {
      expectStyles('.ct-container .ct-list', {
        'list-style': 'none',
        display: 'flex',
        'flex-direction': 'column',
      });
      expectStyles('.ct-container .ct-list-item', { cursor: 'pointer' });
      expectChanges(
        '.ct-container .ct-list-item',
        '.ct-container .ct-list-item:hover',
        'background'
      );
      expectStyles('.ct-container .ct-list-item-header', {
        display: 'flex',
        'justify-content': 'space-between',
      });
      expectStyles('.ct-container .ct-list-meta', { 'flex-shrink': '0' });
      expectStyles('.ct-container .ct-list-details', { 'flex-wrap': 'wrap' });
    });
  });

  describe('campaign tool modal', () => {
    it('overlays the viewport and keeps the modal scrollable within it', () => {
      expectStyles('.ct-container .ct-modal-overlay', {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        display: 'flex',
      });
      expect(
        parseInt(styleFor('.ct-container .ct-modal-overlay')['z-index'], 10),
        'overlay must sit above app content'
      ).toBeGreaterThan(0);
      expect(
        styleFor('.ct-container .ct-modal-overlay').background,
        'overlay should dim the page behind the modal'
      ).not.toMatch(/^(none|transparent)$/);

      const modal = styleFor('.ct-container .ct-modal');
      expectStyles('.ct-container .ct-modal', {
        display: 'flex',
        'flex-direction': 'column',
      });
      expect(modal['max-width'], 'modal should be constrained to the viewport').toMatch(/vw$/);
      expect(modal['max-height'], 'modal should be constrained to the viewport').toMatch(/vh$/);

      expectStyles('.ct-container .ct-modal-body', { 'overflow-y': 'auto' });
      expectStyles('.ct-container .ct-modal-close', { cursor: 'pointer' });
    });

    it('never lets footer clusters push Cancel/Save outside the card', () => {
      // Repro (filed 2026-11-21): the sessions planner's 5-button left cluster
      // (~502px) overflowed the 520px card's content box and, with a nowrap
      // space-between footer, shoved Cancel/Save (~167px) fully onto the
      // backdrop — clipped by the viewport edge at ~800px windows. The wrap
      // law drops an over-wide cluster to its own row instead.
      expectStyles('.ct-container .ct-modal-footer', {
        'flex-wrap': 'wrap',
        gap: '8px',
      });
      // The actions cluster must wrap internally so it can shrink below its
      // widest single-line row.
      expectStyles('.ct-container .ct-modal-actions', { 'flex-wrap': 'wrap' });
      // margin-left:auto keeps the right cluster right-aligned even when it
      // wraps alone onto a second row (space-between cannot do that).
      expectStyles('.ct-container .ct-modal-buttons', { 'margin-left': 'auto' });
    });

    it('lets the sessions planner actually widen past the shared 520px card', () => {
      // Specificity law: `.sessions-modal` alone (0-1-0) LOSES to the shared
      // `.ct-container .ct-modal` width (0-2-0), so a bare-class override is
      // dead code — the planner measured 520px live despite claiming 720px.
      const sessionsWidth = styleFor('.ct-container .ct-modal.sessions-modal', sessionsCss);
      expect(
        sessionsWidth,
        'Sessions.css must out-specify .ct-container .ct-modal (compound selector)'
      ).not.toBeNull();
      expect(sessionsWidth.width, 'planner width must be viewport-capped (vw) as well as px').toMatch(
        /vw/
      );
      const px = parseFloat(sessionsWidth.width.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '');
      const shared = styleFor('.ct-container .ct-modal');
      expect(px, 'planner must be wider than the shared 520px card').toBeGreaterThan(
        parseFloat(shared.width)
      );
    });

    it('lets the NPC stat editor actually widen past the shared 520px card', () => {
      // Same specificity law (kit convergence tranche 3): the old bare
      // `.npcs-modal { max-width: 640px }` (0-1-0) lost to `.ct-container
      // .ct-modal` (0-2-0) and was dead code — the lane now ships the
      // compound tier + viewport cap, mirroring the sessions planner.
      const npcsWidth = styleFor('.ct-container .ct-modal.npcs-modal', npcsCss);
      expect(
        npcsWidth,
        'NPCs.css must out-specify .ct-container .ct-modal (compound selector)'
      ).not.toBeNull();
      expect(npcsWidth.width, 'stat editor width must be viewport-capped (vw) as well as px').toMatch(
        /vw/
      );
      const px = parseFloat(npcsWidth.width.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '');
      expect(
        px,
        'stat editor must be wider than the shared 520px card'
      ).toBeGreaterThan(parseFloat(styleFor('.ct-container .ct-modal').width));
      // The retired bare-class dead rule must not come back.
      expect(
        styleFor('.npcs-modal', npcsCss),
        'bare .npcs-modal rule is dead under the kit tier — it was retired'
      ).toBeNull();
    });
  });

  describe('campaign tool form fields', () => {
    it('sizes every field type to its container without overflowing', () => {
      for (const selector of ['.ct-input', '.ct-textarea', '.ct-select']) {
        expectStyles(`.ct-container ${selector}`, {
          width: '100%',
          'box-sizing': 'border-box',
        });
      }
    });

    it('highlights focused fields with the primary color and a glow ring', () => {
      for (const selector of ['.ct-input:focus', '.ct-textarea:focus', '.ct-select:focus']) {
        const full = `.ct-container ${selector}`;
        expectStyles(full, { 'border-color': 'var(--color-primary)' });
        const shadow = styleFor(full)['box-shadow'];
        expect(shadow, `${full} should declare a focus box-shadow`).toBeTruthy();
        expect(shadow, `${full} focus glow should use the primary rgb token`).toContain(
          'var(--color-primary-rgb'
        );
      }
    });

    it('marks required labels in the error color and keeps field affordances usable', () => {
      expectStyles('.ct-container .ct-label', {
        display: 'block',
        color: 'var(--color-text-secondary)',
      });
      expectStyles('.ct-container .ct-required', { color: 'var(--color-error)' });
      expectStyles('.ct-container .ct-textarea', { resize: 'vertical' });
      expectStyles('.ct-container .ct-select', { cursor: 'pointer' });
    });
  });

  describe('campaign tool buttons', () => {
    it('defaults to secondary styling, overrides via variants, and disables visibly', () => {
      expectStyles('.ct-container .ct-btn', { cursor: 'pointer' });
      expectChanges(
        '.ct-container .ct-btn',
        '.ct-container .ct-btn:hover:not(:disabled)',
        'background'
      );
      expectStyles('.ct-container .ct-btn-primary', {
        background: 'var(--color-primary)',
        color: 'var(--color-text-inverse)',
      });
      expectChanges(
        '.ct-container .ct-btn-primary',
        '.ct-container .ct-btn-primary:hover:not(:disabled)',
        'background'
      );
      const danger = styleFor('.ct-container .ct-btn-danger');
      // -light token keeps the ghost danger label ≥ AA on the secondary
      // fill (pure red fell to ~3.2:1 — backlog drafts-panel-contrast-family).
      expect(danger.color, 'danger buttons should read as error-colored').toBe(
        'var(--color-error-light)'
      );
      expectChanges(
        '.ct-container .ct-btn-danger',
        '.ct-container .ct-btn-danger:hover:not(:disabled)',
        'background'
      );
      // Disabled canon (backlog drafts-panel-contrast-family): token-muted,
      // never opacity-dimmed — dimming compounded below WCAG AA on dark
      // surfaces. The label token must be the readable secondary text token
      // and opacity must stay full-strength.
      const disabled = styleFor('.ct-container .ct-btn:disabled');
      expectStyles('.ct-container .ct-btn:disabled', {
        cursor: 'not-allowed',
        background: 'var(--background-color-disabled)',
        color: 'var(--color-text-secondary)',
      });
      expect(disabled.opacity ?? '1', 'disabled ct-btn must not opacity-dim').toBe('1');
      // The disabled rule outranks both variants on specificity (0-3-0 vs
      // 0-2-0), so one muted family covers default/primary/danger alike.
      expect(danger.background ?? 'none', 'danger variant should stay ghost (no background)').toBe('none');
    });

    it('ships the compact sm tier in the kit, ordered after the base it out-sizes', () => {
      // ct-* kit convergence (tranche 3): `.ct-btn-sm` used to live as a bare
      // 0-1-0 rule in NPCs.css — dead under `.ct-container .ct-btn` (0-2-0)
      // everywhere a container existed. It is now a container-scoped kit tier
      // in App.css, so the move must not regress in either direction.
      const sm = styleFor('.ct-container .ct-btn-sm');
      expect(sm, 'the kit must own a container-scoped .ct-btn-sm tier').not.toBeNull();
      const base = styleFor('.ct-container .ct-btn');
      expect(
        parseFloat(sm.padding),
        'sm tier must be more compact than the base tier'
      ).toBeLessThan(parseFloat(base.padding));
      expect(
        parseFloat(sm['font-size']),
        'sm tier must set a smaller type than the base tier'
      ).toBeLessThan(parseFloat(base['font-size']));
      // Tie-hardening law: same 0-2-0 tier as the base — file order is
      // load-bearing, so the sm rule MUST be parsed after the base rule.
      const smIndex = topRules.findIndex(
        (r) => normalizeSelector(r.selector) === '.ct-container .ct-btn-sm'
      );
      const baseIndex = topRules.findIndex(
        (r) => normalizeSelector(r.selector) === '.ct-container .ct-btn'
      );
      expect(smIndex, 'sm tier rule missing').toBeGreaterThan(-1);
      expect(smIndex, 'sm tier must be ordered after the base tier').toBeGreaterThan(baseIndex);
    });
  });

  describe('responsive styles (max-width: 600px)', () => {
    const MEDIA = '@media (max-width: 600px)';

    it('tightens the gutter and stretches the modal to the viewport', () => {
      // Tighter than desktop proves the breakpoint actually overrides.
      const desktop = parseFloat(styleFor('.ct-container').padding);
      const mobile = styleInMedia(MEDIA, '.ct-container');
      expect(mobile, `expected ${MEDIA} to restyle .ct-container`).not.toBeNull();
      expect(
        parseFloat(mobile.padding),
        'small screens should reduce .ct-container padding'
      ).toBeLessThan(desktop);
      // The header wrap law was PROMOTED to the base tier (2026-11-23
      // narrow-viewport backlog) so wide screens wrap on overflow too — the
      // media block must not keep a stale duplicate.
      expect(
        styleInMedia(MEDIA, '.ct-container .ct-header'),
        'header wrap law lives in the base tier, not the 600px block'
      ).toBeNull();
      const mobileModal = styleInMedia(MEDIA, '.ct-container .ct-modal');
      expect(mobileModal.width, 'modal should size to the viewport on small screens').toMatch(/vw$/);
      expect(
        parseFloat(mobileModal['max-height']),
        'modal should grow taller on small screens'
      ).toBeGreaterThan(parseFloat(styleFor('.ct-container .ct-modal')['max-height']));
    });

    it('stacks the modal footer and stretches its action rows full width', () => {
      expectStyles('.ct-container .ct-modal-footer', { 'flex-direction': 'column' }, MEDIA);
      expectStyles('.ct-container .ct-modal-actions', { width: '100%' }, MEDIA);
      expectStyles('.ct-container .ct-modal-buttons', {
        width: '100%',
        'justify-content': 'flex-end',
      }, MEDIA);
    });
  });

  describe('print styles', () => {
    const MEDIA = '@media print';

    it('flattens an open modal into a full-page scroll-free document', () => {
      expectStyles(
        '.ct-container:has(.ct-modal) > :not(.ct-modal-overlay)',
        { display: 'none !important' },
        MEDIA
      );
      expectStyles('.ct-container .ct-modal-overlay:has(.ct-modal)', {
        position: 'static',
        background: 'none',
        display: 'block',
        'z-index': 'auto',
      }, MEDIA);
      expectStyles('.ct-container .ct-modal', {
        width: '100%',
        'max-width': '100%',
        'max-height': 'none',
        'box-shadow': 'none',
        display: 'block',
      }, MEDIA);
      expectStyles('.ct-container .ct-modal .ct-modal-body', {
        overflow: 'visible',
      }, MEDIA);
    });
  });
});
