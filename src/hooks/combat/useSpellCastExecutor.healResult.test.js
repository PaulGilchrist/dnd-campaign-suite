// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', ...overrides };
}

function makeSpell(overrides = {}) {
  return { name: 'Cure Wounds', ...overrides };
}

function makeProps(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(),
    campaignName: 'TestCampaign',
    mapName: 'TestMap',
    characters: [],
    setPopupHtml: vi.fn(),
    extraMeta: {},
    ...overrides,
  };
}

describe('useSpellCastExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('castAction — heal result handling', () => {
    it('calls setPopupHtml with correct payload for a basic heal result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 15,
        formula: '2d8+3',
        rolls: [4, 3, 5],
        targetName: 'Ally 1',
        bonusHeal: 3,
        bonusDetails: [{ amount: 3, name: 'Divine Favor' }],
      });

      const spell = makeSpell({ name: 'Cure Wounds' });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(spell, {});
      });

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

    it('uses rawTotal over healAmount for total when both are present', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        rawTotal: 18,
        formula: '2d8+3',
        rolls: [4, 3, 5],
        targetName: 'Ally 1',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 18,
          finalHeal: 10,
        })
      );
    });

    it('defaults total to healAmount when rawTotal is absent', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 12,
        formula: '1d8',
        rolls: [12],
        targetName: 'Ally 2',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 12,
          finalHeal: 12,
        })
      );
    });

    it('defaults bonusHeal to 0 when missing from result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 8,
        formula: '1d8',
        rolls: [8],
        targetName: 'Ally 3',
        bonusDetails: [],
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          bonusHeal: 0,
          bonusHealDetail: '',
        })
      );
    });

    it('defaults bonusHeal to 0 when explicitly zero', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 8,
        formula: '1d8',
        rolls: [8],
        targetName: 'Ally 3',
        bonusHeal: 0,
        bonusDetails: [],
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          bonusHeal: 0,
          bonusHealDetail: '',
        })
      );
    });

    it('builds bonusHealDetail from multiple bonusDetails entries', async () => {
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

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          bonusHealDetail: '5 Divine Favor, 3 Blessing',
        })
      );
    });

    it('passes healingReroll rolls through when present', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '2d8',
        rolls: [1, 1],
        targetName: 'Ally 4',
        healingRerollOriginalRolls: [1, 1],
        healingRerollDisplayRolls: [6, 6],
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          healingRerollOriginalRolls: [1, 1],
          healingRerollDisplayRolls: [6, 6],
        })
      );
    });

    it('defaults healingReroll fields to null when absent', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 7,
        formula: '1d6',
        rolls: [7],
        targetName: 'Ally 6',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          healingRerollOriginalRolls: null,
          healingRerollDisplayRolls: null,
        })
      );
    });

    it('defaults rolls to empty array when missing from result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 5,
        formula: '1d4',
        targetName: 'Ally 7',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          rolls: [],
        })
      );
    });

    it('does not call setPopupHtml when result has no targetName and no automationPopup and no modalName', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8',
        rolls: [10],
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('does not call setPopupHtml when result is null', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('does not call setPopupHtml when result is undefined', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('does not call setPopupHtml when result is an empty object', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({});

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('calls setPopupHtml when result has targetName of empty string (!= null check)', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        targetName: '',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          targetName: '',
        })
      );
    });

    it('calls setPopupHtml when result has targetName of 0 (!= null check)', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        targetName: 0,
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          targetName: 0,
        })
      );
    });

    it('does not call setPopupHtml when result has targetName of null', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        targetName: null,
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('calls setPopupHtml when result has targetName of false (!= null check)', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        targetName: false,
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          targetName: false,
        })
      );
    });

    it('uses spell.name from the spell parameter in the popup payload', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8',
        rolls: [10],
        targetName: 'Ally 1',
      });

      const spell = makeSpell({ name: 'Prayer of Healing' });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(spell, {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Prayer of Healing',
        })
      );
    });

    it('uses spell.name even when it is missing from the spell object', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8',
        rolls: [10],
        targetName: 'Ally 1',
      });

      const spell = {};

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(spell, {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          name: undefined,
        })
      );
    });

    it('passes formula through from the result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '4d6+2',
        rolls: [3, 1, 4, 2],
        targetName: 'Ally 1',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          formula: '4d6+2',
        })
      );
    });

    it('passes formula as undefined when missing from result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        rolls: [10],
        targetName: 'Ally 1',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          formula: undefined,
        })
      );
    });

    it('passes targetName through from the result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8',
        rolls: [10],
        targetName: 'Bard Ally',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          targetName: 'Bard Ally',
        })
      );
    });

    it('handles bonusDetails with missing name field (concatenates amount + undefined)', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8',
        rolls: [10],
        targetName: 'Ally 1',
        bonusHeal: 5,
        bonusDetails: [{ amount: 5 }],
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          bonusHealDetail: '5 undefined',
        })
      );
    });

    it('handles bonusDetails with missing amount field (concatenates undefined + name)', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8',
        rolls: [10],
        targetName: 'Ally 1',
        bonusHeal: 3,
        bonusDetails: [{ name: 'Feature' }],
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          bonusHealDetail: 'undefined Feature',
        })
      );
    });
  });
});
