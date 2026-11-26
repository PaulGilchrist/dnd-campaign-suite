// @maintained-by-ai 2026-11-15
// RB-1115 (2026-11-15): the bonus-action sheet row lanes that used to return
// SILENTLY on a cannotAct press now route through the shared assertCanAct
// setPopupHtml lane with the canTakeAction copy ("You cannot take actions
// while incapacitated."). Each press must stay WRITE-HONEST: zero runtime
// writes, zero campaign-log rows, zero executor/service dispatch.
// Harness mirrors CharBonusActions.edgeCases.test.jsx (same mock family).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';
import { CANNOT_ACT_REASON } from '../../services/combat/canTakeAction.js';

const captured = vi.hoisted(() => ({ html: null, setPopupHtml: (html) => { captured.html = html; } }));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: captured.setPopupHtml })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingBarkskin: null, handleBarkskinConfirm: vi.fn(), handleBarkskinSkip: vi.fn(),
    pendingHealingWord: null, handleHealingWordConfirm: vi.fn(), handleHealingWordSkip: vi.fn(),
    pendingSanctuary: null, handleSanctuaryConfirm: vi.fn(), handleSanctuarySkip: vi.fn(),
    pendingLesserRestoration: null, handleLesserRestorationConfirm: vi.fn(), handleLesserRestorationSkip: vi.fn(),
    pendingHex: null, handleHexConfirm: vi.fn(), handleHexSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));

vi.mock('../../hooks/combat/useSimpleDamageRoll.js', () => ({
  useSimpleDamageRoll: vi.fn(() => vi.fn()),
}));

vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn(), cachedPosRef: {} })),
}));

vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn(() => null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getActiveCreatureName: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 2),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn(() => null),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn(() => ''),
}));

vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getBonusActionSpellNames: vi.fn(() => new Set()),
  applyPotentSpellcasting: vi.fn((d) => d),
}));

vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: ['Spellcasting'] })),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((range) => range || ''),
  signFormatter: { format: (n) => (n >= 0 ? `+${n}` : `${n}`) },
  getAttackSpellLevel: vi.fn(() => null),
}));

vi.mock('../../services/rules/features/spiritualWeaponService.js', () => ({
  resolveSpiritualWeaponMoveAndAttack: vi.fn(),
}));

vi.mock('./modals/weapon-kind-mastery-cache.js', () => ({
  loadWeapons: vi.fn(() => Promise.resolve([])),
}));

import { useRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { useSimpleDamageRoll } from '../../hooks/combat/useSimpleDamageRoll.js';
import { addEntry } from '../../services/ui/logService.js';
import { resolveSpiritualWeaponMoveAndAttack } from '../../services/rules/features/spiritualWeaponService.js';

const CAMPAIGN = 'test-campaign';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '2024',
  level: 5,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [], toHit: 5 },
  abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Intelligence', bonus: 0 }],
  proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

const bonusAttack = {
  name: 'Main Gauche',
  range: 5,
  hitBonus: 5,
  damage: '1d4+3',
  damageType: 'Piercing',
  type: 'Bonus Action',
};

beforeEach(() => {
  vi.resetAllMocks();
  captured.html = null;
  vi.mocked(useRuntimeValue).mockImplementation(() => null);
  vi.mocked(useSimpleDamageRoll).mockReturnValue(vi.fn());
});

describe('CharBonusActions — cannotAct rows pop the shared reason (RB-1115)', () => {
  it('attack-damage cell press pops the reason and skips the damage roll', () => {
    const roll = vi.fn();
    vi.mocked(useSimpleDamageRoll).mockReturnValue(roll);
    render(
      <CharBonusActions
        playerStats={createStats({ attacks: [bonusAttack] })}
        campaignName={CAMPAIGN}
        cannotAct
        exhaustionPenalty={0}
        onAttackClick={vi.fn()}
        onResolveSpellDamage={vi.fn()}
        onAutomationAction={vi.fn()}
        rollAttack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('1d4+3'));

    expect(captured.html).toBe(CANNOT_ACT_REASON);
    expect(roll).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('Spiritual Weapon move row press pops the reason before the move/attack service', () => {
    vi.mocked(useRuntimeValue).mockImplementation((_key, runtimeKey) => (
      runtimeKey === 'activeBuffs'
        ? [{ effect: 'spiritual_weapon_force', activatedRound: 1, damageFormula: '1d8+3' }]
        : null
    ));
    const rollAttack = vi.fn();
    render(
      <CharBonusActions
        playerStats={createStats({ bonusActions: [{ name: 'Occupied', description: 'Keeps the section mounted.' }] })}
        campaignName={CAMPAIGN}
        cannotAct
        exhaustionPenalty={0}
        onAttackClick={vi.fn()}
        onResolveSpellDamage={vi.fn()}
        onAutomationAction={vi.fn()}
        rollAttack={rollAttack}
      />
    );

    fireEvent.click(screen.getByText(/Spiritual Weapon: Move 20 ft/));

    expect(captured.html).toBe(CANNOT_ACT_REASON);
    expect(resolveSpiritualWeaponMoveAndAttack).not.toHaveBeenCalled();
    expect(rollAttack).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('Invoke Duplicity transposition row press pops the reason and dispatches nothing', () => {
    vi.mocked(useRuntimeValue).mockImplementation((_key, runtimeKey) => (
      runtimeKey === 'activeBuffs'
        ? [{ name: 'Invoke Duplicity', effect: 'create_illusion', duration: '1_minute' }]
        : null
    ));
    const onAutomationAction = vi.fn();
    render(
      <CharBonusActions
        playerStats={createStats({ bonusActions: [{ name: 'Occupied', description: 'Keeps the section mounted.' }] })}
        campaignName={CAMPAIGN}
        cannotAct
        exhaustionPenalty={0}
        onAttackClick={vi.fn()}
        onResolveSpellDamage={vi.fn()}
        onAutomationAction={onAutomationAction}
        rollAttack={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/Move Invoke Duplicity \(Transposition\):/));

    expect(captured.html).toBe(CANNOT_ACT_REASON);
    expect(onAutomationAction).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
