// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useActionPopup, {
  buildFeatureDetailHtml,
  buildAbilityDetailHtml,
  showBackgroundPopup,
} from './useActionPopup.js';

// Mock usePopup with the same contract as the real hook: showPopup invokes the
// handler and only sets popupHtml when the built HTML is truthy. This lets tests
// verify preset-handler wiring without usePopup's React state internals.
vi.mock('./usePopup.js', () => {
  let popupHtml = null;

  return {
    default: vi.fn((handler) => {
      const popup = {
        showPopup: vi.fn((entity) => {
          const html = handler(entity);
          if (html) popupHtml = html;
        }),
        setPopupHtml: vi.fn((html) => { popupHtml = html; }),
      };
      Object.defineProperty(popup, 'popupHtml', { get: () => popupHtml });
      return popup;
    }),
    resetMock: () => { popupHtml = null; },
  };
});

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadBackgroundData: vi.fn(),
  loadWildMagicSurgeTable: vi.fn(async () => []),
}));

import { loadBackgroundData } from '../../services/ui/dataLoader.js';
import { resetMock } from './usePopup.js';

// Re-import useActionPopup.js with a cleared module registry so the module-level
// fetch caches (weaponMasteryCache) start empty, with fetch stubbed per test.
async function freshModuleWithFetch(fetchImpl) {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubGlobal('fetch', fetchImpl);
  return import('./useActionPopup.js');
}

const fetchJson = (data) => vi.fn(() =>
  Promise.resolve({ json: () => Promise.resolve(data) })
);

beforeEach(() => {
  resetMock();
  loadBackgroundData.mockReset();
});

describe('buildFeatureDetailHtml', () => {
  it('renders name, description, and details when details is present', () => {
    const result = buildFeatureDetailHtml({
      name: 'Second Wind',
      description: 'You have a limited well of stamina.',
      details: 'You can use a bonus action to regain 1d10 + fighter level hit points.',
    });
    expect(result).toBe(
      '<b>Second Wind</b><br/>You have a limited well of stamina.<br/><br/>You can use a bonus action to regain 1d10 + fighter level hit points.'
    );
  });

  it('returns null when details is falsy or missing', () => {
    expect(buildFeatureDetailHtml({ name: 'X', details: '' })).toBeNull();
    expect(buildFeatureDetailHtml({ name: 'X', details: 0 })).toBeNull();
    expect(buildFeatureDetailHtml({ name: 'X', description: 'Just a description.' })).toBeNull();
  });
});

describe('buildAbilityDetailHtml', () => {
  const ABILITIES = [
    { full_name: 'Strength', description: 'Measures physical power.' },
    { full_name: 'Dexterity', description: 'Measures agility.' },
  ];

  it('renders HTML for a known ability name (exact match, first occurrence)', () => {
    expect(buildAbilityDetailHtml(ABILITIES)('Strength')).toBe('<h3>Strength</h3>Measures physical power.<br/>');
    expect(buildAbilityDetailHtml([{ full_name: 'Strength', description: 'First.' }, ...ABILITIES])('Strength'))
      .toBe('<h3>Strength</h3>First.<br/>');
  });

  it('returns null for unknown names, including case differences', () => {
    expect(buildAbilityDetailHtml(ABILITIES)('Unknown')).toBeNull();
    expect(buildAbilityDetailHtml(ABILITIES)('strength')).toBeNull();
    expect(buildAbilityDetailHtml([])('Strength')).toBeNull();
  });

  it('throws TypeError at lookup time when the ability list is undefined or null', () => {
    expect(() => buildAbilityDetailHtml(undefined)('Strength')).toThrow(TypeError);
    expect(() => buildAbilityDetailHtml(null)('Strength')).toThrow(TypeError);
  });
});

describe('useActionPopup preset wiring', () => {
  it('spell preset: sets popupHtml when entity has a description', () => {
    const { result } = renderHook(() => useActionPopup('spell'));
    act(() => {
      result.current.showPopup({
        name: 'Fireball',
        description: 'A bright streak flashes from your pointing finger.',
      });
    });
    expect(result.current.popupHtml).toBe(
      '<b>Fireball</b><br/><br/>A bright streak flashes from your pointing finger.<br/>'
    );
  });

  it('spell preset: leaves popupHtml untouched when description is missing or empty', () => {
    const { result } = renderHook(() => useActionPopup('spell'));
    act(() => { result.current.showPopup({ name: 'Fireball' }); });
    act(() => { result.current.showPopup({ name: 'Fireball', description: '' }); });
    expect(result.current.popupHtml).toBeNull();
  });

  it('feature preset: builds via buildFeatureDetailHtml, null when no details', () => {
    const { result } = renderHook(() => useActionPopup('feature'));
    act(() => {
      result.current.showPopup({ name: 'Test', description: 'Desc', details: 'Details here' });
    });
    expect(result.current.popupHtml).toBe('<b>Test</b><br/>Desc<br/><br/>Details here');
    act(() => { result.current.showPopup({ name: 'Test', description: 'Desc' }); });
    expect(result.current.popupHtml).toBe('<b>Test</b><br/>Desc<br/><br/>Details here');
  });

  it('ability preset: builds via context.allAbilityScores', () => {
    const { result } = renderHook(() =>
      useActionPopup('ability', { allAbilityScores: [{ full_name: 'Strength', description: 'Power.' }] })
    );
    act(() => { result.current.showPopup('Strength'); });
    expect(result.current.popupHtml).toBe('<h3>Strength</h3>Power.<br/>');
  });

  it('function preset: uses the custom handler', () => {
    const { result } = renderHook(() => useActionPopup((entity) => `<b>${entity.name}</b>`));
    act(() => { result.current.showPopup({ name: 'Fireball' }); });
    expect(result.current.popupHtml).toBe('<b>Fireball</b>');
  });

  it('unknown preset: never shows a popup', () => {
    const { result } = renderHook(() => useActionPopup('unknown'));
    act(() => { result.current.showPopup({ name: 'Test', details: 'Stuff' }); });
    expect(result.current.popupHtml).toBeNull();
  });
});

// Weapon masteries from public/data/2024/weapon-mastery.json (real names).
describe('loadWeaponMasteries / showWeaponMasteryPopup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches once, caches, and resolves the mastery list', async () => {
    const masteries = [{ name: 'Nick', description: 'Make an additional attack.' }];
    const fetchMock = fetchJson(masteries);
    const { loadWeaponMasteries } = await freshModuleWithFetch(fetchMock);

    expect(await loadWeaponMasteries()).toEqual(masteries);
    expect(await loadWeaponMasteries()).toEqual(masteries);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/data/2024/weapon-mastery.json');
  });

  it('propagates fetch rejection', async () => {
    const { loadWeaponMasteries } = await freshModuleWithFetch(
      vi.fn(() => Promise.reject(new Error('Network error')))
    );
    await expect(loadWeaponMasteries()).rejects.toThrow('Network error');
  });

  it('sets popup HTML for a known mastery with a description', async () => {
    const { showWeaponMasteryPopup } = await freshModuleWithFetch(fetchJson([
      { name: 'Nick', description: 'Make an additional attack after the Attack action.' },
    ]));
    const setPopupHtml = vi.fn();

    await showWeaponMasteryPopup('Nick', setPopupHtml);

    expect(setPopupHtml).toHaveBeenCalledWith(
      '<b>Nick</b><br/><br/>Make an additional attack after the Attack action.<br/>'
    );
  });

  it('leaves popup closed when mastery is unknown, has no description, or the fetch fails', async () => {
    const cases = [
      ['unknown mastery', fetchJson([{ name: 'Nick', description: 'Extra attack.' }]), 'Nonexistent'],
      ['missing description', fetchJson([{ name: 'Nick' }]), 'Nick'],
      ['fetch rejection', vi.fn(() => Promise.reject(new Error('Network error'))), 'Nick'],
    ];
    for (const [, fetchImpl, name] of cases) {
      const { showWeaponMasteryPopup } = await freshModuleWithFetch(fetchImpl);
      const setPopupHtml = vi.fn();
      await showWeaponMasteryPopup(name, setPopupHtml);
      expect(setPopupHtml).not.toHaveBeenCalled();
    }
  });
});

describe('showBackgroundPopup', () => {
  it('renders 2024 background with all optional fields', async () => {
    loadBackgroundData.mockResolvedValue([{
      name: 'Soldier',
      description: 'Warfare is no stranger to you.',
      ability_scores: 'STR +2, CON +1',
      feat: 'Tough',
      skill_proficiencies: 'Athletics, Intuition',
      tool_proficiencies: 'Gaming set',
      equipment: 'A shield',
      book: 'Player\'s Handbook',
      page: '42',
    }]);
    const setPopupHtml = vi.fn();

    await showBackgroundPopup('Soldier', setPopupHtml, '2024');

    expect(loadBackgroundData).toHaveBeenCalledWith('2024');
    expect(setPopupHtml).toHaveBeenCalledWith(
      '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Ability Scores:</b> STR +2, CON +1<br/><br/><b>Feat:</b> Tough<br/><br/><b>Skill Proficiencies:</b> Athletics, Intuition<br/><br/><b>Tool Proficiencies:</b> Gaming set<br/><br/><b>Equipment:</b> A shield<br/><br/><b>Source:</b> Player\'s Handbook 42'
    );
  });

  it('matches 5e backgrounds by lowercase index', async () => {
    loadBackgroundData.mockResolvedValue([
      { index: 'soldier', name: 'Soldier', description: 'Warfare is no stranger to you.' },
    ]);
    const setPopupHtml = vi.fn();

    await showBackgroundPopup('soldier', setPopupHtml, '5e');

    expect(loadBackgroundData).toHaveBeenCalledWith('5e');
    expect(setPopupHtml).toHaveBeenCalledWith(
      '<b>Soldier</b><br/><br/>Warfare is no stranger to you.'
    );
  });

  it('shows a not-found error when background is missing or has no description', async () => {
    loadBackgroundData.mockResolvedValue([
      { name: 'Acolyte', description: 'Temple life.' },
      { name: 'Charlatan' },
    ]);
    const setPopupHtml = vi.fn();

    await showBackgroundPopup('Soldier', setPopupHtml, '2024');
    expect(setPopupHtml).toHaveBeenLastCalledWith(
      '<b>Soldier</b><br/><br/>Background details not found in database.'
    );

    await showBackgroundPopup('Charlatan', setPopupHtml, '2024');
    expect(setPopupHtml).toHaveBeenLastCalledWith(
      '<b>Charlatan</b><br/><br/>Background details not found in database.'
    );
  });

  it('shows a friendly error message when the data load rejects', async () => {
    loadBackgroundData.mockRejectedValue(new Error('Network error'));
    const setPopupHtml = vi.fn();

    await showBackgroundPopup('Acolyte', setPopupHtml, '2024');

    expect(setPopupHtml).toHaveBeenCalledWith(
      '<b>Acolyte</b><br/><br/>Error loading background details: Network error. Check browser console for more details.'
    );
  });
});
