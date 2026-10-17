// @maintained-by-ai
// CharSpecialActions autoDamageRoll seam map (family opener):
// - THIS FILE pins ONLY the component seam in CharSpecialActions.jsx (~L719-733):
//   the autoDamageRoll callback handed to useLoggedDiceRoll — its wiring/delegation
//   (normalizeAutoDamage + resolveAttackDamageStandalone args, isCrit passthrough,
//   rollDamage/setPopupHtml identity) and the component-local ripostePopup →
//   setPopupHtml rendering.
// - Damage-application internals (formula → dice roll, crit doubling, ctx assembly,
//   pipeline steps) are owned by the damage lanes: useAttackDamageResolution.standalone.test.js,
//   useAttackDamageResolution.*.test.js, normalizeAutoDamage.test.js,
//   src/services/combat/steps/attackRollDamageSteps-*.test.js. Do not duplicate here.
// - CharSpecialActions sibling lanes (same folder): automationClickHandlers, combatHandlers,
//   craftingHandlers, elementalEffects, featureChoice, gnomishLineage, handlers, modals,
//   modalsInline, modalOnClose.{elemental,weapons}, twinklingConstellations, uncovered.handlers,
//   useMagicDevice — they honor this map: never re-pin the autoDamageRoll seam there.
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';
import { normalizeAutoDamage, resolveAttackDamageStandalone } from './useAttackDamageResolution.js';

// Capture the autoDamageRoll callback + rollDamage that the component wires into the hook.
let capturedOptions = null;
let capturedRollDamage = null;
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn((_name, _campaign, options) => {
    capturedOptions = options;
    capturedRollDamage = vi.fn();
    return { rollAttack: vi.fn(), rollDamage: capturedRollDamage };
  }),
}));

// Capture popup writes (real context default is an inert no-op setter).
let capturedSetPopupHtml = null;
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: capturedSetPopupHtml })),
}));

// Isolate the component seam: damage-resolution internals are owned by the damage lanes.
vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: { name: 'Longsword' }, ctx: {} })),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

// Avoid loading the automation handler hub and fighting-styles fetch (irrelevant to this seam).
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
}));

const playerStats = {
  name: 'TestCharacter',
  specialActions: [],
  class: { fightingStyles: [] },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
};

const autoDamage = {
  name: 'Longsword Attack',
  formula: '2d6+3',
  damageType: 'Slashing',
  targetName: 'Goblin',
  attackerName: 'TestCharacter',
};

function renderAndCaptureAutoDamageRoll() {
  render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" characters={[]} />);
  expect(capturedOptions?.autoDamageRoll).toBeTypeOf('function');
  return capturedOptions.autoDamageRoll;
}

describe('CharSpecialActions - autoDamageRoll seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOptions = null;
    capturedRollDamage = null;
    capturedSetPopupHtml = vi.fn();
    normalizeAutoDamage.mockReturnValue({ attack: { name: 'Longsword' }, ctx: {} });
  });

  it('delegates to normalizeAutoDamage + resolveAttackDamageStandalone, forwarding isCrit and the hook rollDamage', async () => {
    const autoDamageRoll = renderAndCaptureAutoDamageRoll();

    await autoDamageRoll(autoDamage, false);
    await autoDamageRoll(autoDamage, true);

    // Normalization receives the raw autoDamage, per-click isCrit, and the acting stats.
    expect(normalizeAutoDamage.mock.calls.map(c => [c[0], c[1], c[2]]))
      .toEqual([[autoDamage, false, playerStats], [autoDamage, true, playerStats]]);

    // Resolution is triggered once per click with the normalized attack/ctx and the
    // hook's rollDamage + popup setter (the roll-trigger the popup depends on).
    expect(resolveAttackDamageStandalone).toHaveBeenCalledTimes(2);
    expect(capturedRollDamage).not.toHaveBeenCalled();
    const normalized = normalizeAutoDamage.mock.results[0].value;
    for (const [, , deps] of resolveAttackDamageStandalone.mock.calls) {
      expect(deps.playerStats).toBe(playerStats);
      expect(deps.campaignName).toBe('test-campaign');
      expect(deps.rollDamage).toBe(capturedRollDamage);
      expect(deps.setPopupHtml).toBe(capturedSetPopupHtml);
    }
    expect(resolveAttackDamageStandalone.mock.calls.map(([attack, ctx]) => [attack, ctx]))
      .toEqual([[normalized.attack, normalized.ctx], [normalized.attack, normalized.ctx]]);
    // Crit flag reaches the normalized ctx untouched (2nd click only).
    expect(normalizeAutoDamage.mock.calls[1][1]).toBe(true);
    // No ripostePopup on these payloads → no popup fired by the component itself.
    expect(capturedSetPopupHtml).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: 'string payload passes through verbatim',
      payload: '<b>Counterattack!</b> You deal extra damage.',
      expected: '<b>Counterattack!</b> You deal extra damage.',
    },
    {
      description: 'object payload renders name and description',
      payload: { name: 'Riposte', description: 'You strike back at the attacker.' },
      expectedContains: ['Riposte', 'You strike back at the attacker.'],
    },
    {
      description: 'object payload without name falls back to Combat Superiority',
      payload: { description: 'Some riposte effect.' },
      expectedContains: ['Combat Superiority', 'Some riposte effect.'],
    },
  ])('sets riposte popup for $description', async ({ payload, expected, expectedContains }) => {
    const autoDamageRoll = renderAndCaptureAutoDamageRoll();

    await autoDamageRoll({ ...autoDamage, ripostePopup: payload }, false);

    expect(capturedSetPopupHtml).toHaveBeenCalledTimes(1);
    const html = capturedSetPopupHtml.mock.calls[0][0];
    if (expected) {
      expect(html).toBe(expected);
    } else {
      for (const text of expectedContains) {
        expect(html).toContain(text);
      }
    }
  });
});
