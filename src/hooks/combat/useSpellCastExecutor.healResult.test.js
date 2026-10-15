// @maintained-by-ai: 2026-10-14
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

function makeProps(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: { name: 'TestCaster' },
    getTargetInfo: vi.fn(),
    campaignName: 'TestCampaign',
    mapName: 'TestMap',
    characters: [],
    setPopupHtml: vi.fn(),
    extraMeta: {},
    ...overrides,
  };
}

// Render the hook and run one cast, awaiting the result-routing promise chain.
async function cast(props, spell = { name: 'Cure Wounds' }) {
  const { result } = renderHook(() => useSpellCastExecutor(props));
  await act(async () => {
    await result.current.castAction(spell, {});
  });
}

describe('useSpellCastExecutor — heal result routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes a full heal result to setPopupHtml with the complete heal payload', async () => {
    const props = makeProps();
    executeSpellCast.mockResolvedValue({
      healAmount: 15,
      formula: '2d8+3',
      rolls: [4, 3, 5],
      targetName: 'Ally 1',
      bonusHeal: 3,
      bonusDetails: [{ amount: 3, name: 'Divine Favor' }],
    });

    await cast(props, { name: 'Cure Wounds' });

    // Shape mirrors buildHealPopup and the genericHealResult emitted by
    // spellCastService/execution/index.js (rawTotal absent → total = healAmount).
    expect(props.setPopupHtml).toHaveBeenCalledWith({
      type: 'heal',
      name: 'Cure Wounds',
      formula: '2d8+3',
      rolls: [4, 3, 5],
      total: 15,
      targetName: 'Ally 1',
      finalHeal: 15,
      bonusHeal: 3,
      bonusHealDetail: '3 Divine Favor',
      healingRerollOriginalRolls: null,
      healingRerollDisplayRolls: null,
    });
  });

  it('prefers rawTotal for total but keeps finalHeal as healAmount', async () => {
    const props = makeProps();
    executeSpellCast.mockResolvedValue({
      healAmount: 10,
      rawTotal: 18,
      formula: '2d8+3',
      rolls: [4, 3, 5],
      targetName: 'Ally 1',
    });

    await cast(props);

    expect(props.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ total: 18, finalHeal: 10 })
    );
  });

  it('defaults missing optional result fields (rolls, bonusHeal, rerolls, formula)', async () => {
    const props = makeProps();
    executeSpellCast.mockResolvedValue({
      healAmount: 12,
      targetName: 'Ally 2',
    });

    await cast(props);

    expect(props.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        rolls: [],
        total: 12,
        finalHeal: 12,
        bonusHeal: 0,
        bonusHealDetail: '',
        healingRerollOriginalRolls: null,
        healingRerollDisplayRolls: null,
      })
    );
  });

  it('joins multiple bonusDetails into bonusHealDetail', async () => {
    const props = makeProps();
    executeSpellCast.mockResolvedValue({
      healAmount: 20,
      formula: '3d8+2',
      rolls: [5, 4, 3],
      targetName: 'Ally 5',
      bonusHeal: 8,
      bonusDetails: [
        { amount: 5, name: 'Divine Favor' },
        { amount: 3, name: 'Blessing' },
      ],
    });

    await cast(props);

    expect(props.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ bonusHealDetail: '5 Divine Favor, 3 Blessing' })
    );
  });

  it('passes healingReroll original/display rolls through for the reroll display', async () => {
    const props = makeProps();
    executeSpellCast.mockResolvedValue({
      healAmount: 10,
      formula: '2d8',
      rolls: [6, 6],
      targetName: 'Ally 4',
      healingRerollOriginalRolls: [1, 1],
      healingRerollDisplayRolls: [6, 6],
    });

    await cast(props);

    expect(props.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        healingRerollOriginalRolls: [1, 1],
        healingRerollDisplayRolls: [6, 6],
      })
    );
  });

  it('renders incomplete bonusDetails entries with undefined placeholders', async () => {
    // Defensive: entries come from feature services; the seam must not crash.
    const missingName = makeProps();
    executeSpellCast.mockResolvedValue({
      healAmount: 10,
      targetName: 'Ally 1',
      bonusHeal: 5,
      bonusDetails: [{ amount: 5 }],
    });
    await cast(missingName);
    expect(missingName.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ bonusHealDetail: '5 undefined' })
    );

    const missingAmount = makeProps();
    executeSpellCast.mockResolvedValue({
      healAmount: 10,
      targetName: 'Ally 1',
      bonusHeal: 3,
      bonusDetails: [{ name: 'Feature' }],
    });
    await cast(missingAmount);
    expect(missingAmount.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ bonusHealDetail: 'undefined Feature' })
    );
  });

  it('routes on targetName != null — falsy-but-defined targets show, null/absent stay silent', async () => {
    // The heal branch guards with `targetName != null` (loose), so '', 0 and
    // false are legitimate routable targets; null and undefined are not.
    for (const targetName of ['', 0, false]) {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({ healAmount: 10, targetName });
      await cast(props);
      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({ targetName })
      );
    }

    for (const result of [null, undefined, {}, { healAmount: 10 }, { healAmount: 10, targetName: null }]) {
      const props = makeProps();
      executeSpellCast.mockResolvedValue(result);
      await cast(props);
      expect(props.setPopupHtml).not.toHaveBeenCalled();
    }
  });
});
