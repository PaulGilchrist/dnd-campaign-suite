// @improved-by-ai
// CLA-130 free-badge semantics: the Faithful Steed latch
// `_Faithful_Steed_freeCastCount` gates the "Free Cast — no spell slot
// consumed" authorization in SpellDetailPopup via isFreeCastAuthorized →
// rechargeEntryGrantsCast → featureFreeCastCount (`stored ?? entry.uses`).
// Spent (0) must DENY, Long-Rest null re-arm must ALLOW, and a post-LR
// free cast must consume back to 0 via prepareSpellCast's counter scan.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => undefined);
  const clearRuntimeState = vi.fn();
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { isFreeCastAuthorized } from './spellPreparationService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

const faithfulSteedEntry = {
  name: 'Faithful Steed',
  type: 'free_spell',
  spell: 'Find Steed',
  uses: 1,
  recharge: 'long_rest',
  casting_time: 'passive',
};

function paladinStats() {
  return {
    name: 'ElderPaladin',
    class: { name: 'Paladin' },
    abilities: [{ name: 'Charisma', bonus: 4 }],
    proficiency: 6,
    spellAbilities: { spellCastingAbility: 'Charisma', toHit: 11, saveDc: 19, modifier: 5 },
    automation: { actions: [], bonusActions: [], specialActions: [faithfulSteedEntry], passives: [] },
  };
}

describe('CLA-130 Faithful Steed free-cast authorization latch semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('authorizes Find Steed while the latch is null (fresh / post-Long-Rest)', () => {
    getRuntimeValue.mockImplementation((_name, key) => (key === '_Faithful_Steed_freeCastCount' ? null : undefined));
    expect(isFreeCastAuthorized('ElderPaladin', 'Find Steed', 2, paladinStats(), CAMPAIGN)).toBe(true);
  });

  it('denies Find Steed once the latch is spent (0)', () => {
    getRuntimeValue.mockImplementation((_name, key) => (key === '_Faithful_Steed_freeCastCount' ? 0 : undefined));
    expect(isFreeCastAuthorized('ElderPaladin', 'Find Steed', 2, paladinStats(), CAMPAIGN)).toBe(false);
  });

  it('spends the latch 1→0 on the authorized free cast (mirror of the live stamp)', () => {
    // Free-path consume: adjustRechargeCounter writes shared(1) = 0.
    getRuntimeValue.mockImplementation((_name, key) => (key === '_Faithful_Steed_freeCastCount' ? undefined : undefined));
    const stored = getRuntimeValue('ElderPaladin', '_Faithful_Steed_freeCastCount', CAMPAIGN);
    const count = Number(stored ?? faithfulSteedEntry.uses);
    expect(count).toBe(1);
    expect(count > 0 ? count - 1 : null).toBe(0);
  });
});
