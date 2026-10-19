// @maintained-by-ai
// SP-094: monster-attack attacker-type lookup must resolve the real monsterType
// (EB combatSummary monsters carry type:'npc' with the real D&D type in monsterType).
// Lane: attack-chip click → real findCreatureByName/getTargetFromAttacker →
// applyProtectionFromEvilPenalty → isCreatureWarded(resolveCreatureType(attacker)) →
// REAL combineAttackModes folds targetDisadvantageCount → rollAttack opts.forcedMode.
// Resolver unit bytes live in services/combat/creatureTypeResolver.test.js —
// this lane locks the consumer wiring end-to-end, not the resolver itself.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

// Capture seam: rollAttack's options carry the resolved forcedMode.
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

// PfE handler mocked only where runtime-store reads must be steered; the mock's
// ward check mirrors the real case-insensitive type comparison (:190-195).
vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn((type) => ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead']
    .some(t => t.toLowerCase() === String(type).toLowerCase())),
  handle: vi.fn(),
}));

// Runtime-store stub: no SSE/fetch on this lane (null → every active-buff/te fold inert).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
}));

import { _rollAttack } from '../../hooks/combat/useLoggedDiceRoll.js';
import * as pfeg from '../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js';

const CASES = [
  {
    desc: 'warded Undead attacker vs PfE-protected target → forcedMode disadvantage',
    pfActive: true, attacker: 'Wight 1', monsterType: 'Undead',
    wardedArg: 'Undead', forcedMode: 'disadvantage',
  },
  {
    desc: 'PfE inactive on target → warded check skipped, no forcedMode',
    pfActive: false, attacker: 'Wight 1', monsterType: 'Undead',
    wardedArg: null, forcedMode: undefined,
  },
  {
    desc: 'non-warded Giant attacker vs PfE-protected target → no forcedMode',
    pfActive: true, attacker: 'Ogre 1', monsterType: 'Giant',
    wardedArg: 'Giant', forcedMode: undefined,
  },
];

describe('MonsterCardModal - SP-094 PfE attacker-type lookup on the attack-roll lane', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // clears call history; factory implementations persist
    pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(false);
  });

  it.each(CASES)('$desc', ({ pfActive, attacker, monsterType, wardedArg, forcedMode }) => {
    pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(pfActive);
    // EB combatSummary row shape: type 'npc', real D&D type in monsterType.
    const creatures = [
      { name: attacker, type: 'npc', monsterType, targetName: 'HexWarlock' },
      { name: 'HexWarlock', type: 'player' },
    ];
    const m = makeMonster({ actions: [{ name: 'Necrotic Sword', attack_bonus: 4, description: 'Melee Attack.' }] });
    render(<MonsterCardModal {...makeProps(m, {
      monsterName: attacker, creatureName: attacker, creatures,
    })} />);

    const link = Array.from(document.querySelectorAll('.mc-dice-link'))
      .find(el => el.textContent.trim() === '+4');
    expect(link, 'attack link "+4"').toBeTruthy();
    fireEvent.click(link);

    // Gate queries the PfE-protected target by name.
    expect(pfeg.isProtectionFromEvilAndGoodActive).toHaveBeenCalledWith('HexWarlock', 'test-campaign');
    if (wardedArg === null) {
      expect(pfeg.isCreatureWarded).not.toHaveBeenCalled();
    } else {
      // SP-094 byte lock: real monsterType reaches the ward check, never 'npc'.
      expect(pfeg.isCreatureWarded).toHaveBeenCalledTimes(1);
      expect(pfeg.isCreatureWarded).toHaveBeenCalledWith(wardedArg, 'HexWarlock', 'test-campaign');
    }
    expect(_rollAttack).toHaveBeenCalledTimes(1);
    expect(_rollAttack.mock.calls[0][0]).toBe('Necrotic Sword');
    expect(_rollAttack.mock.calls[0][1]).toBe(4);
    expect(_rollAttack.mock.calls[0][2].forcedMode).toBe(forcedMode);
  });
});
