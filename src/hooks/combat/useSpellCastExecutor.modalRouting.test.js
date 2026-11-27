// @maintained-by-ai 2026-11-26
// Owns the authoritative modalName → modal-state key map for the cast lane:
// exhaustive coverage of every key in MODAL_STATE_KEYS (useSpellCastExecutor.js,
// the same map routeCastModal shares with useActionSpellMetamagic).
// Bare modalName derivation + the unknown-name guard live in
// useSpellCastExecutor.modalName.test.js; automationPopup precedence lives in
// useSpellCastExecutor.automationPopup.test.js; cachedPosRef clearing lives in
// useSpellCastExecutor.castAction.test.js.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

/**
 * Exhaustive mirror of MODAL_STATE_KEYS in useSpellCastExecutor.js.
 * If a key is added to (or removed from) the source map without updating
 * this table, the missing key's route goes untested — keep them in lockstep.
 * Each entry: [modalName emitted by executeSpellCast, expected setModalState key]
 */
const MODAL_ROUTE_MAP = [
  ['massHealTarget', 'massHealModal'],
  ['massCureWoundsTarget', 'massCureWoundsModal'],
  ['prayerOfHealingTarget', 'prayerOfHealingModal'],
  ['powerWordFortifyTarget', 'powerWordFortifyModal'],
  ['massHealingWordTarget', 'massHealingWordModal'],
  ['saveAttackAoe', 'saveAttackAoeModal'],
  ['aoeCondition', 'aoeConditionModal'],
  // fix#308: ['fear','fearModal'] row REMOVED in lockstep with the retired
  // useSpellCastExecutor consumer key + modalSpells.handleFear (census-dead).
  ['sleep', 'sleepModal'],
  ['hypnoticPattern', 'hypnoticPatternModal'],
  ['calmEmotions', 'calmEmotionsModal'],
  ['massSuggestion', 'massSuggestionModal'],
  ['commandChoice', 'commandModal'],
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

// Cast with a stubbed bare-modalName result; returns props plus setModalState
// so tests assert dispatch without repeating the seam setup.
async function castWithModalNameResult(result, propOverrides = {}) {
  executeSpellCast.mockResolvedValue(result);
  const setModalState = propOverrides.setModalState ?? vi.fn();
  const props = makeProps({ ...propOverrides, setModalState });
  const { result: hook } = renderHook(() => useSpellCastExecutor(props));
  await act(async () => {
    await hook.current.castAction({ name: 'Fireball' }, {});
  });
  return { props, setModalState };
}

describe('useSpellCastExecutor — modal key map routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(MODAL_ROUTE_MAP)(
    'routes every known modalName "%s" to setModalState key "%s" exactly once (payload unchanged, popup silent)',
    async (modalName, expectedKey) => {
      const payload = { data: 'payloadData' };
      const { props, setModalState } = await castWithModalNameResult({ modalName, payload });

      // times(1) + exact single-key argument = full dispatch census: no second
      // call, no extra modal keys, no popup leak.
      expect(setModalState).toHaveBeenCalledTimes(1);
      expect(setModalState).toHaveBeenCalledWith({ [expectedKey]: payload });
      expect(props.setPopupHtml).not.toHaveBeenCalled();
    },
  );

  // A missing payload field still routes (pass-through, not skip-if-empty):
  // the only shape-distinguishing case — object pass-through is already proven
  // by every route-table row above via the same single source line.
  it('routes an undefined payload through unchanged (no skip guard)', async () => {
    const { setModalState } = await castWithModalNameResult(
      { modalName: 'massHealTarget', payload: undefined },
    );

    expect(setModalState).toHaveBeenCalledTimes(1);
    expect(setModalState).toHaveBeenCalledWith({ massHealModal: undefined });
  });

  it('falls back to setPopupHtml when a bare modalName result arrives without setModalState', async () => {
    // fix#308: sample modalName switched 'fear' (retired) -> live 'sleep'; the
    // fallback seam is modalName-agnostic (:43-44 setPopupHtml without key lookup).
    const payload = { action: { name: 'Sleep' } };
    executeSpellCast.mockResolvedValue({ modalName: 'sleep', payload });
    const props = makeProps({ setModalState: undefined });
    const { result: hook } = renderHook(() => useSpellCastExecutor(props));

    await act(async () => {
      await hook.current.castAction({ name: 'Fireball' }, {});
    });

    expect(props.setPopupHtml).toHaveBeenCalledTimes(1);
    expect(props.setPopupHtml).toHaveBeenCalledWith(payload);
  });
});
