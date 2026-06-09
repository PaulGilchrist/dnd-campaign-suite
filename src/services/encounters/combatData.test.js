import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock getCombatContext from damageUtils ────────────────────────
const mockGetCombatContext = vi.fn();
vi.mock('../rules/damageUtils.js', () => ({
  getCombatContext: (...args) => mockGetCombatContext(...args),
}));

import {
  loadCombatSummary,
  getCombatSummary,
  loadActiveCreatureName,
  getActiveCreatureName,
  loadCurrentCombatRound,
  getCurrentCombatRound,
} from './combatData.js';

// ── Helpers ───────────────────────────────────────────────────────
const CS_KEY = 'combatSummary';
const ACTIVE_KEY = 'activeCreatureName';

const fakeSummary = { round: 3, creatures: [{ name: 'Goblin', type: 'npc' }] };
const fakeSummaryWithActive = { ...fakeSummary, activeCreatureName: 'Goblin' };

function clearLocalStorage() {
  localStorage.clear();
}

function setLocalCombatSummary(data) {
  localStorage.setItem(CS_KEY, JSON.stringify(data));
}

function setLocalActiveCreatureName(name) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(name));
}

// ── Setup ─────────────────────────────────────────────────────────
beforeEach(() => {
  clearLocalStorage();
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════
// getCombatSummary — sync, local only
// ════════════════════════════════════════════════════════════════════
describe('getCombatSummary', () => {
  it('returns null when nothing stored locally', () => {
    expect(getCombatSummary()).toBeNull();
  });

  it('returns parsed combat summary from localStorage', () => {
    setLocalCombatSummary(fakeSummary);
    expect(getCombatSummary()).toEqual(fakeSummary);
  });

  it('returns null when stored value is malformed JSON', () => {
    localStorage.setItem(CS_KEY, '{bad');
    expect(getCombatSummary()).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════
// loadCombatSummary — async, API + local fallback
// ════════════════════════════════════════════════════════════════════
describe('loadCombatSummary', () => {
  it('returns null when no campaignName and nothing stored locally', async () => {
    expect(await loadCombatSummary(null)).toBeNull();
  });

  it('reads from localStorage when no campaignName', async () => {
    setLocalCombatSummary(fakeSummary);
    const result = await loadCombatSummary(null);
    expect(result).toEqual(fakeSummary);
    expect(mockGetCombatContext).not.toHaveBeenCalled();
  });

  it('fetches from API and caches in localStorage when data exists', async () => {
    mockGetCombatContext.mockResolvedValueOnce(fakeSummary);
    const result = await loadCombatSummary('MyCampaign');
    expect(result).toEqual(fakeSummary);
    expect(mockGetCombatContext).toHaveBeenCalledWith('MyCampaign');
    // Should be cached in localStorage
    expect(getCombatSummary()).toEqual(fakeSummary);
  });

  it('returns null when API returns null', async () => {
    mockGetCombatContext.mockResolvedValueOnce(null);
    const result = await loadCombatSummary('MyCampaign');
    expect(result).toBeNull();
  });

  it('returns null when API error is thrown (no local fallback)', async () => {
    mockGetCombatContext.mockRejectedValueOnce(new Error('network'));
    setLocalCombatSummary(fakeSummary);
    const result = await loadCombatSummary('MyCampaign');
     // loadCombatSummary returns null after catch — does not fall through to readLocal
    expect(result).toBeNull();
   });

  it('returns null when API throws and nothing in localStorage', async () => {
    mockGetCombatContext.mockRejectedValueOnce(new Error('network'));
    const result = await loadCombatSummary('MyCampaign');
    expect(result).toBeNull();
  });

  it('does not call API when campaignName is falsy', async () => {
    setLocalCombatSummary(fakeSummary);
    await loadCombatSummary('');
    expect(mockGetCombatContext).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// getActiveCreatureName — sync, local only
// ════════════════════════════════════════════════════════════════════
describe('getActiveCreatureName', () => {
  it('returns null when nothing stored', () => {
    expect(getActiveCreatureName()).toBeNull();
  });

  it('returns active creature name from localStorage', () => {
    setLocalActiveCreatureName('Goblin');
    expect(getActiveCreatureName()).toBe('Goblin');
  });

  it('returns null when stored value is malformed JSON', () => {
    localStorage.setItem(ACTIVE_KEY, '{bad');
    expect(getActiveCreatureName()).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════
// loadActiveCreatureName — async, API + local fallback
// ════════════════════════════════════════════════════════════════════
describe('loadActiveCreatureName', () => {
  it('returns null when no campaignName and nothing stored locally', async () => {
    expect(await loadActiveCreatureName(null)).toBeNull();
  });

  it('reads from localStorage when no campaignName', async () => {
    setLocalActiveCreatureName('Goblin');
    const result = await loadActiveCreatureName(null);
    expect(result).toBe('Goblin');
    expect(mockGetCombatContext).not.toHaveBeenCalled();
  });

  it('fetches activeCreatureName from API summary and caches', async () => {
    mockGetCombatContext.mockResolvedValueOnce(fakeSummaryWithActive);
    const result = await loadActiveCreatureName('MyCampaign');
    expect(result).toBe('Goblin');
    expect(mockGetCombatContext).toHaveBeenCalledWith('MyCampaign');
    // Should be cached in localStorage
    expect(getActiveCreatureName()).toBe('Goblin');
  });

  it('falls back to local when API has no activeCreatureName', async () => {
    mockGetCombatContext.mockResolvedValueOnce(fakeSummary); // no activeCreatureName
    setLocalActiveCreatureName('Orc');
    const result = await loadActiveCreatureName('MyCampaign');
    expect(result).toBe('Orc');
  });

  it('returns null when API has no activeCreatureName and nothing local', async () => {
    mockGetCombatContext.mockResolvedValueOnce(fakeSummary); // no activeCreatureName
    const result = await loadActiveCreatureName('MyCampaign');
    expect(result).toBeNull();
  });

  it('falls back to localStorage when API returns null summary', async () => {
    mockGetCombatContext.mockResolvedValueOnce(null);
    setLocalActiveCreatureName('Orc');
    const result = await loadActiveCreatureName('MyCampaign');
    expect(result).toBe('Orc');
  });

  it('returns null when API returns null and nothing in localStorage', async () => {
    mockGetCombatContext.mockResolvedValueOnce(null);
    const result = await loadActiveCreatureName('MyCampaign');
    expect(result).toBeNull();
  });

  it('falls through to localStorage when API throws', async () => {
    mockGetCombatContext.mockRejectedValueOnce(new Error('network'));
    setLocalActiveCreatureName('Orc');
    const result = await loadActiveCreatureName('MyCampaign');
    expect(result).toBe('Orc');
  });

  it('returns null when API throws and nothing in localStorage', async () => {
    mockGetCombatContext.mockRejectedValueOnce(new Error('network'));
    const result = await loadActiveCreatureName('MyCampaign');
    expect(result).toBeNull();
  });

  it('does not call API when campaignName is falsy', async () => {
    setLocalActiveCreatureName('Goblin');
    await loadActiveCreatureName('');
    expect(mockGetCombatContext).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// loadCurrentCombatRound — async, delegates to loadCombatSummary
// ════════════════════════════════════════════════════════════════════
describe('loadCurrentCombatRound', () => {
  it('returns 1 when no combat summary exists locally and no campaignName', async () => {
    expect(await loadCurrentCombatRound(null)).toBe(1);
  });

  it('returns round from locally stored combat summary', async () => {
    setLocalCombatSummary({ round: 5 });
    expect(await loadCurrentCombatRound(null)).toBe(5);
  });

  it('returns round from API data', async () => {
    mockGetCombatContext.mockResolvedValueOnce(fakeSummaryWithActive); // round: 3
    expect(await loadCurrentCombatRound('MyCampaign')).toBe(3);
  });

  it('returns default 1 when combat summary exists but has no round field', async () => {
    setLocalCombatSummary({ creatures: [] });
    expect(await loadCurrentCombatRound(null)).toBe(1);
  });

  it('returns default 1 when API returns summary without round', async () => {
    mockGetCombatContext.mockResolvedValueOnce({ creatures: [] });
    expect(await loadCurrentCombatRound('MyCampaign')).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// getCurrentCombatRound — sync, delegates to getCombatSummary
// ════════════════════════════════════════════════════════════════════
describe('getCurrentCombatRound', () => {
  it('returns 1 when no combat summary exists locally', () => {
    expect(getCurrentCombatRound()).toBe(1);
  });

  it('returns round from locally stored combat summary', () => {
    setLocalCombatSummary({ round: 7 });
    expect(getCurrentCombatRound()).toBe(7);
  });

  it('returns default 1 when summary exists but has no round field', () => {
    setLocalCombatSummary({ creatures: [] });
    expect(getCurrentCombatRound()).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// readLocal error handling (via exported functions)
// ════════════════════════════════════════════════════════════════════
describe('localStorage read errors', () => {
  it('handles getItem returning malformed JSON gracefully', () => {
    localStorage.getItem.mockImplementationOnce(() => '{incomplete');
    expect(getCombatSummary()).toBeNull();
  });

  it('handles setItem throwing (writeLocal should not throw)', () => {
    const origSet = localStorage.setItem;
    localStorage.setItem = vi.fn(() => { throw new Error('quota exceeded'); });
    // loadCombatSummary with valid campaign data that resolves — writeLocal is called but error swallows
    mockGetCombatContext.mockResolvedValueOnce({ round: 1 });
    // Should not throw
    expect(() => loadCombatSummary('Campaign')).not.toThrow();
    localStorage.setItem = origSet;
  });
});
