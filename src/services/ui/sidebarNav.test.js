// @maintained-by-ai 2026-11-26
// Pure toolbelt/nav logic (learnability backlog Item 1): the checkbox set is
// derived from NAV_ITEMS + the Admin footer, presets are convenience
// batch-sets whose ACTIVE state is DERIVED from the current hidden set
// (nothing preset-shaped is stored), and the route guard resolves a hidden
// activeView back to the neutral stage (null).
// Rendered-dialog behavior (checkbox ticking, pills, debounce, close kit)
// lives in ToolbeltSettings.test.jsx; this file pins only the data/logic
// contracts that file consumes.
import { describe, it, expect } from 'vitest';
import {
  VIEW_LABELS,
  NAV_ITEMS,
  TOOLBELT_VIEWS,
  TOOLBELT_PRESETS,
  normalizeHiddenViews,
  matchToolbeltPreset,
  resolveVisibleView,
} from './sidebarNav.js';

describe('TOOLBELT_VIEWS', () => {
  it('is exactly the sidebar destinations (every NAV_ITEMS view + the Admin footer), once each, labelled from VIEW_LABELS and alphabetical', () => {
    const views = TOOLBELT_VIEWS.map((v) => v.view);
    const navViews = NAV_ITEMS.filter((i) => i.view).map((i) => i.view);
    expect([...views].sort()).toEqual([...navViews, 'campaignRepair'].sort());
    for (const { view, label } of TOOLBELT_VIEWS) {
      expect(label).toBe(VIEW_LABELS[view].label);
    }
    const labels = TOOLBELT_VIEWS.map((v) => v.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});

describe('TOOLBELT_PRESETS', () => {
  it('opens with the neutral "Everything" batch-set and every other preset hides a non-empty, deduped set of real sidebar views', () => {
    const [first, ...rest] = TOOLBELT_PRESETS;
    expect(first.id).toBe('everything');
    expect(first.hidden).toEqual([]);
    const known = new Set(TOOLBELT_VIEWS.map((v) => v.view));
    for (const preset of rest) {
      expect(preset.hidden.length).toBeGreaterThan(0);
      expect(preset.hidden.every((v) => known.has(v))).toBe(true);
      expect(new Set(preset.hidden).size).toBe(preset.hidden.length);
    }
  });

  it('copy never names fixed modes/levels — presets are batch-set conveniences (hints render only as tooltips, so the dialog test cannot see them)', () => {
    const copy = TOOLBELT_PRESETS.map((p) => `${p.label} ${p.hint}`).join(' ').toLowerCase();
    expect(copy).not.toMatch(/\bmode\b|\blevel\b/);
  });
});

describe('matchToolbeltPreset (derived, never stored)', () => {
  it('matches a preset only on EXACT set equality (order-insensitive) and reads Custom the instant the set moves off one', () => {
    const theater = TOOLBELT_PRESETS.find((p) => p.id === 'theater');
    const printDice = TOOLBELT_PRESETS.find((p) => p.id === 'print-dice');
    // Exact hits, in any order; the empty set lands on the "Everything" preset.
    expect(matchToolbeltPreset(theater.hidden)).toBe(theater);
    expect(matchToolbeltPreset([...theater.hidden].reverse())).toBe(theater);
    expect(matchToolbeltPreset([])).toBe(TOOLBELT_PRESETS[0]);
    // Adding, removing, or naming an unknown view never matches any preset.
    expect(matchToolbeltPreset([...printDice.hidden, 'mapsManager'])).toBeNull();
    expect(matchToolbeltPreset(printDice.hidden.slice(1))).toBeNull();
    expect(matchToolbeltPreset([...printDice.hidden, 'unknown-view'])).toBeNull();
  });
});

describe('normalizeHiddenViews', () => {
  it('dedupes and orders by the checkbox list, dropping anything not a sidebar view', () => {
    const [first, second] = TOOLBELT_VIEWS;
    expect(normalizeHiddenViews([second.view, first.view, second.view])).toEqual([first.view, second.view]);
    expect(normalizeHiddenViews(['not-a-view'])).toEqual([]);
  });
});

describe('resolveVisibleView (route guard)', () => {
  it('keeps a visible view, falls a hidden one back to the neutral stage (null)', () => {
    expect(resolveVisibleView('initiative', [])).toBe('initiative');
    expect(resolveVisibleView('initiative', ['music'])).toBe('initiative');
    expect(resolveVisibleView('initiative', ['initiative'])).toBeNull();
    expect(resolveVisibleView(null, ['initiative'])).toBeNull();
  });
});
