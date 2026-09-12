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
  return { name: 'Fireball', ...overrides };
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

/**
 * Modal routing mappings from handleModalResult switch cases.
 * Each entry: [modalName from executeSpellCast, expected setModalState key]
 */
const MODAL_ROUTE_MAP = [
  ['massHealTarget', 'massHealModal'],
  ['massCureWoundsTarget', 'massCureWoundsModal'],
  ['prayerOfHealingTarget', 'prayerOfHealingModal'],
  ['powerWordFortifyTarget', 'powerWordFortifyModal'],
  ['massHealingWordTarget', 'massHealingWordModal'],
  ['saveAttackAoe', 'saveAttackAoeModal'],
  ['aoeCondition', 'aoeConditionModal'],
  ['fear', 'fearModal'],
  ['hypnoticPattern', 'hypnoticPatternModal'],
  ['calmEmotions', 'calmEmotionsModal'],
  ['massSuggestion', 'massSuggestionModal'],
  ['ArcaneVigor', 'arcaneVigorModal'],
  ['blindnessDeafness', 'blindnessDeafnessModal'],
  ['silenceTargetSelection', 'silenceModal'],
  ['eyebiteEffect', 'eyebiteEffectModal'],
  ['wildMagicSurge', 'wildMagicSurgeModal'],
  ['feignDeathTargetSelection', 'feignDeathModal'],
  ['tashasLaughter', 'tashasLaughterModal'],
  ['animateDead', 'animateDeadModal'],
  ['createUndead', 'createUndeadModal'],
  ['summonSpirit', 'summonSpiritModal'],
  ['starryChaliceHeal', 'starryChaliceHealModal'],
];

describe('useSpellCastExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleModalResult — modalName routing', () => {
    it.each(MODAL_ROUTE_MAP)(
      'maps modalName "%s" to setModalState key "%s" with correct payload',
      async (modalName, expectedKey) => {
        const props = makeProps();
        const setModalState = vi.fn();
        const payload = { data: 'payloadData' };

        executeSpellCast.mockResolvedValue({ modalName, payload });

        const { result } = renderHook(() =>
          useSpellCastExecutor({ ...props, setModalState }),
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(setModalState).toHaveBeenCalledWith({ [expectedKey]: payload });
        expect(props.setPopupHtml).not.toHaveBeenCalled();
      },
    );

    it('passes the payload through unchanged without transformation', async () => {
      const props = makeProps();
      const setModalState = vi.fn();
      const complexPayload = {
        targets: ['A', 'B', 'C'],
        spellLevel: 3,
        customFlag: true,
        nested: { key: 'value' },
      };

      executeSpellCast.mockResolvedValue({
        modalName: 'massHealTarget',
        payload: complexPayload,
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState }),
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ massHealModal: complexPayload });
    });

    it('passes undefined payload when result has modalName but no payload field', async () => {
      const props = makeProps();
      const setModalState = vi.fn();

      executeSpellCast.mockResolvedValue({ modalName: 'fear' });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState }),
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ fearModal: undefined });
    });

    it('passes empty object payload when result has modalName with empty payload', async () => {
      const props = makeProps();
      const setModalState = vi.fn();

      executeSpellCast.mockResolvedValue({ modalName: 'calmEmotions', payload: {} });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState }),
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ calmEmotionsModal: {} });
    });

    it('falls back to setPopupHtml when modalName result is received but setModalState is undefined', async () => {
      const props = makeProps();

      executeSpellCast.mockResolvedValue({
        modalName: 'fear',
        payload: { action: { name: 'Fear' } },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props),
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith({ action: { name: 'Fear' } });
    });

    it('automationPopup takes priority over modalName in result', async () => {
      const props = makeProps();
      const setModalState = vi.fn();

      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'popup', payload: '<div>Automation!</div>' },
        modalName: 'massHealTarget',
        payload: { action: { name: 'Mass Heal' } },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState }),
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Automation!</div>');
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('uses different spell names without affecting modal routing', async () => {
      const props = makeProps();
      const setModalState = vi.fn();

      executeSpellCast.mockResolvedValue({
        modalName: 'massHealTarget',
        payload: { spell: 'DifferentSpell' },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState }),
      );

      await act(async () => {
        await result.current.castAction(makeSpell({ name: 'Prayer of Healing' }), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ massHealModal: { spell: 'DifferentSpell' } });
    });

    it('clears ref.current after modal routing completes', async () => {
      const props = makeProps();
      const setModalState = vi.fn();
      const ref = { current: { attackerPos: { x: 1 } } };

      executeSpellCast.mockResolvedValue({
        modalName: 'massHealTarget',
        payload: { data: 'test' },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, cachedPosRef: ref, setModalState }),
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(ref.current).toBeNull();
    });
  });
});
