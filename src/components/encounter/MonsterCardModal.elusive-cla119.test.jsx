// @maintained-by-ai
// Trim pass (2026-10-18): sole REAL-combineAttackModes owner for the CLA-119
// Elusive fold — conditionEffects.js/elusiveFeature.js stay UNMOCKED here
// (mirrors the real adv=0 fold at conditionEffects.js:868-870 that the
// combineAttackModes→'normal' mocked siblings (attack-advanced #578,
// attack-logic #579, dodge-ba001 #594) delegate to at :180-212).
//
// Removed:
//   "is idempotent — pre-stamped flag never double-counts" (#580 vacuous)
//     → applyElusive stamps `noAdvantageAgainst = true` (MonsterCardModal.jsx:996);
//       a boolean assignment is structurally idempotent and the fn never touches
//       targetAdvantageCount — the assertion could never fail.
// Collapsed:
//   control / feature-less-stub / non-player inert legs → one it.each over the
//   three applyElusive guard branches (:991-992). Control leg is additionally
//   covered end-to-end by the owner integration block (:195-203).
// Dead mocks purged (fold stays REAL):
//   diceRoller.js — rollExpression only fires in handleDamage/spell lanes
//   (:2431/:2683), never behind the mocked rollAttack chip click;
//   shared/abilityLookup.js — not imported anywhere in this modal graph.
//
// CLA-119: Elusive (lv18+ Rogue, both rulesets) — EB monster attacks against an
// Elusive PC must cancel ALL attacker Advantage (noAdvantageAgainst fold consumed
// by combineAttackModes adv=0). Before the fix applyElusive read `targetComputed`
// from the feature-less combatSummary player stub (encounterToInitiative.js:57),
// so hasElusive was always false and e.g. Faerie Fire te advantage was never
// cancelled. The fold now sources the FULL rolled PlayerStats
// (characters[i].computedStats — rulesFactory.getPlayerStats output, same
// hasElusiveFeature seam the sheet lane uses), mirroring the sibling
// applyProtectionFromEvilPenalty / applyDodgePenalty defender-backed folds.
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { applyElusive } from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollAttack = vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollAttack };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures } = {}, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 5)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
    useRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

const MONSTER_NAME = 'Goblin 1';
const ROGUE = 'AasimarTest';
const CONTROL = 'EvasiveFighter';
const SCIMITAR_ACTION = {
  name: 'Scimitar',
  description: 'Melee Attack Roll: +4, reach 5 ft. <strong>Hit:</strong> 6 (2d6 + 2) Slashing damage.',
  attack_bonus: 4,
  reach: '5 ft.',
  damage_dice_primary: '2d6 + 2',
  damage_type_primary: 'Slashing',
};

// Full rolled PlayerStats the App-level rulesFactory.getPlayerStats produces:
// lv18+ Rogue carries the 'Elusive' class feature in specialActions
// (2024 classes.json:9843 / 5e twin classes.json:9601).
const elusiveStats = { specialActions: [{ name: 'Elusive' }] };
const plainStats = { specialActions: [{ name: 'Sneak Attack' }] };

function renderGoblin({ targetName, targetStats }) {
  runtime.store['campaign.targetEffects'] = [{ target: targetName, effect: 'faerie_fire' }];
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', targetName },
    { name: targetName, type: 'player', ac: 12 },
  ];
  const characters = [{ name: targetName, type: 'player', computedStats: targetStats }];
  const m = makeMonster({ name: 'Goblin', actions: [SCIMITAR_ACTION] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures, characters })} />);
}

function scimitarChip() {
  const row = [...document.querySelectorAll('.mc-action')].find(r => (r.querySelector('strong')?.textContent || '').trim().startsWith('Scimitar'));
  return row?.querySelector('span.mc-dice-link') || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('applyElusive — full playerStats fold (unit)', () => {
  const playerTarget = { name: ROGUE, type: 'player' };

  it('stamps noAdvantageAgainst when the defender playerStats carry Elusive', () => {
    const data = { targetAdvantageCount: 1 };
    applyElusive(data, playerTarget, [{ name: ROGUE, computedStats: elusiveStats }], 'test-campaign');
    expect(data.noAdvantageAgainst).toBe(true);
  });

  it('finds Elusive in any of the four rolled action buckets', () => {
    for (const bucket of ['actions', 'bonusActions', 'reactions', 'specialActions']) {
      const data = {};
      applyElusive(data, playerTarget, [{ name: ROGUE, computedStats: { [bucket]: [{ name: 'Elusive' }] } }], 'test-campaign');
      expect(data.noAdvantageAgainst).toBe(true);
    }
  });

  it('honors the Incapacitated exemption (CONDITIONS_THAT_CANNOT_ACT)', () => {
    for (const cond of ['incapacitated', 'paralyzed', 'stunned', 'unconscious', 'petrified']) {
      runtime.store[`${ROGUE}.activeConditions`] = [cond];
      const data = {};
      applyElusive(data, playerTarget, [{ name: ROGUE, computedStats: elusiveStats }], 'test-campaign');
      expect(data.noAdvantageAgainst ?? false).toBe(false);
    }
  });

  it.each([
    ['control defender without Elusive', { name: CONTROL, type: 'player' }, [{ name: CONTROL, computedStats: plainStats }]],
    ['feature-less stub lane (characters lack computedStats)', playerTarget, [{ name: ROGUE }]],
    ['non-player target', { name: 'Ogre', type: 'npc' }, [{ name: 'Ogre', computedStats: elusiveStats }]],
  ])('is inert for %s', (_label, target, characters) => {
    const data = { targetAdvantageCount: 1 };
    applyElusive(data, target, characters, 'test-campaign');
    expect(data.noAdvantageAgainst ?? false).toBe(false);
    expect(data.targetAdvantageCount).toBe(1);
  });
});

describe('CLA-119 MonsterCardModal — Scimitar vs Elusive PC', () => {
  it('cancels Faerie Fire advantage vs Elusive rogue → forcedMode stays normal', async () => {
    renderGoblin({ targetName: ROGUE, targetStats: elusiveStats });
    const chip = scimitarChip();
    expect(chip).toBeTruthy();
    await act(async () => { fireEvent.click(chip); });

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Scimitar');
    expect(bonus).toBe(4);
    expect(options.targetName).toBe(ROGUE);
    expect(options.forcedMode ?? 'normal').toBe('normal');
    expect(options.forcedMode).not.toBe('advantage');
  });

  it('control: non-Elusive PC with Faerie Fire te still rolls advantage', async () => {
    renderGoblin({ targetName: CONTROL, targetStats: plainStats });
    await act(async () => { fireEvent.click(scimitarChip()); });

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const options = rollAttack.mock.calls[0][2];
    expect(options.targetName).toBe(CONTROL);
    expect(options.forcedMode).toBe('advantage');
  });

  it('Elusive + Incapacitated exemption: advantage passes through when incapacitated', async () => {
    renderGoblin({ targetName: ROGUE, targetStats: elusiveStats });
    runtime.store[`${ROGUE}.activeConditions`] = ['incapacitated'];
    await act(async () => { fireEvent.click(scimitarChip()); });

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const options = rollAttack.mock.calls[0][2];
    expect(options.forcedMode).toBe('advantage');
  });
});
