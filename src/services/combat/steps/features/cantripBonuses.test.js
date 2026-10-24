// @maintained-by-ai
// Dedicated lane for src/services/combat/steps/features/cantripBonuses.js —
// closes ledger rec "modal-interrupt branch pinned by NO lane" (pass #298).
// The step-internal branch: applyCantripDamageBonusOption -> grantCantripTempHp
// returns { modal } when ctx.setSecondaryTargetModal is armed and allies exist
// (the handler then short-circuits via `if (result.modal) return result.modal`),
// and otherwise writes tempHp = max(existing, thp) with NO modal.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const grv = vi.fn();
const srv = vi.fn();
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => grv(...args),
  setRuntimeValue: (...args) => srv(...args),
}));

const getCombatContext = vi.fn();
vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: (...args) => getCombatContext(...args),
}));

const evaluateAutoExpression = vi.fn();
vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: (...args) => evaluateAutoExpression(...args),
}));

import { cantripBonuses } from './cantripBonuses.js';

const ally = { name: 'Thorin', type: 'player', currentHp: 20, maxHp: 26, size: 'M' };

function ctxBase(extra = {}) {
  return {
    campaignName: 'test-campaign',
    isCantrip: true,
    attack: { name: 'Booming Blade' },
    playerStats: {
      name: 'Thorin',
      abilities: [{ name: 'Wisdom', bonus: 3 }],
      automation: {
        actions: [{
          name: 'Improved Blessed Strikes',
          type: 'damage_bonus',
          tempHpExpression: '1d8 + 3',
          options: ['Use Spellcasting ability modifier'],
        }],
        passives: [],
      },
    },
    ...extra,
  };
}

describe('cantripBonuses — grantCantripTempHp modal-interrupt branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grv.mockReturnValue(0);
    evaluateAutoExpression.mockReturnValue(7);
    getCombatContext.mockResolvedValue({ creatures: [ally] });
  });

  const prevData = { formula: '1d8', total: 4, rolls: [{ dice: '1d8', value: 4 }] };

  it('returns { modal } (secondaryTarget, Grant Temp HP) when the interrupt is armed — no tempHp write at press time', async () => {
    const setSecondaryTargetModal = vi.fn();
    const result = await cantripBonuses.handler(ctxBase({ setSecondaryTargetModal }), prevData);

    // handler returns the envelope `result.modal` = { data, modal }.
    expect(result.data).toEqual({ _cantripTempHp: 7 });
    expect(result.modal.type).toBe('secondaryTarget');
    expect(result.modal.props.confirmLabel).toBe('Grant Temp HP');
    expect(result.modal.props.targets).toEqual([
      { name: 'Thorin', currentHp: 20, maxHp: 26, size: 'M', type: 'player' },
    ]);
    // No direct write — the grant defers to the modal confirm.
    expect(srv).not.toHaveBeenCalled();
  });

  it('short-circuits the bonus loop: modal return skips the wisMod formula append', async () => {
    const result = await cantripBonuses.handler(
      ctxBase({ setSecondaryTargetModal: vi.fn() }), prevData);
    // Step returns the interrupt envelope (data carries the deferred THP),
    // NOT the summed { formula, total } shape — the pipeline pauses.
    expect(result.data).toEqual({ _cantripTempHp: 7 });
    expect(result.modal.type).toBe('secondaryTarget');
  });

  it('no modal armed → writes tempHp = max(existing, thp) and applies wisMod to the formula', async () => {
    grv.mockImplementation((_name, key) => (key === 'tempHp' ? 4 : 0));
    const result = await cantripBonuses.handler(
      ctxBase({ setSecondaryTargetModal: null }), prevData);

    expect(result.modal).toBeUndefined();
    expect(srv).toHaveBeenCalledWith('Thorin', 'tempHp', Math.max(4, 7), 'test-campaign');
    expect(result.data.formula).toBe('1d8 + 3 [Cantrip]');
    expect(result.data.total).toBe(4 + 3);
  });

  it('no allies in combat context → falls through to the direct tempHp write', async () => {
    getCombatContext.mockResolvedValue({ creatures: [] });
    const result = await cantripBonuses.handler(
      ctxBase({ setSecondaryTargetModal: vi.fn() }), prevData);

    expect(result.modal).toBeUndefined();
    expect(srv).toHaveBeenCalledWith('Thorin', 'tempHp', 7, 'test-campaign');
  });
});
