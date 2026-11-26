// Pure toolbelt/nav logic (learnability backlog Item 1): the checkbox set is
// derived from NAV_ITEMS + the Admin footer, presets are convenience
// batch-sets whose ACTIVE state is DERIVED from the current hidden set
// (nothing preset-shaped is stored), and the route guard resolves a hidden
// activeView back to the neutral stage (null).
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
  it('covers every sidebar destination (all NAV_ITEMS views + the Admin footer) exactly once', () => {
    const navViews = NAV_ITEMS.filter((i) => i.view).map((i) => i.view);
    expect([...TOOLBELT_VIEWS.map((v) => v.view)].sort()).toEqual([...navViews, 'campaignRepair'].sort());
    expect(new Set(TOOLBELT_VIEWS.map((v) => v.view)).size).toBe(TOOLBELT_VIEWS.length);
  });

  it('labels every entry from the shared VIEW_LABELS vocabulary and stays alphabetical by label', () => {
    for (const { view, label } of TOOLBELT_VIEWS) {
      expect(label).toBe(VIEW_LABELS[view].label);
    }
    const labels = TOOLBELT_VIEWS.map((v) => v.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});

describe('TOOLBELT_PRESETS', () => {
  it('every preset hides real views and keeps every checkbox editable afterwards (it is data, not a lock)', () => {
    const known = new Set(TOOLBELT_VIEWS.map((v) => v.view));
    for (const preset of TOOLBELT_PRESETS) {
      expect(preset.hidden.every((v) => known.has(v))).toBe(true);
      expect(new Set(preset.hidden).size).toBe(preset.hidden.length);
    }
  });

  it('starts with the neutral "Everything" batch-set (hides nothing)', () => {
    expect(TOOLBELT_PRESETS[0].id).toBe('everything');
    expect(TOOLBELT_PRESETS[0].hidden).toEqual([]);
  });

  it('copy never names fixed levels/modes — presets are batch-set conveniences', () => {
    const copy = TOOLBELT_PRESETS.map((p) => `${p.label} ${p.hint}`).join(' ').toLowerCase();
    expect(copy).not.toMatch(/mode|level/);
  });
});

describe('matchToolbeltPreset (derived, never stored)', () => {
  it('matches a preset only on EXACT set equality, order-insensitive', () => {
    const theater = TOOLBELT_PRESETS.find((p) => p.id === 'theater');
    expect(matchToolbeltPreset(theater.hidden)).toBe(theater);
    expect(matchToolbeltPreset([...theater.hidden].reverse())).toBe(theater);
    expect(matchToolbeltPreset([])).toBe(TOOLBELT_PRESETS[0]);
  });

  it('reads Custom the instant a checkbox moves off a preset', () => {
    const printDice = TOOLBELT_PRESETS.find((p) => p.id === 'print-dice');
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
