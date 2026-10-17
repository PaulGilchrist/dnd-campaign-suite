// @maintained-by-ai
// @improved-by-ai
// SavePromptModal — shared test-utility contract.
// These fixtures and harness defaults feed EVERY SavePromptModal test lane
// (rendering / bonuses / actions / rolling / rerolls / evasion). This file
// pins the *contract* they owe the production code — verified by running the
// real, unmocked ability-save lookup against the fixtures — so fixture drift
// is pinpointed here instead of corrupting roll math elsewhere.
//
// Removed in this pass (and why):
//   - createMockSubscriber test: the factory was dead code (every lane mocks
//     ./Subscriber.jsx inline with its own triggers; nothing imported the
//     factory). Asserting that a mock renders its own hardcoded testids is a
//     tautology with zero signal, so the factory was deleted from
//     SavePromptModal.test-utils.jsx along with this test.
//   - Object-shape assertions restating the fixture literals: replaced by
//     behavior through the real getAbilitySaveBonus lookup, including
//     negative paths (unlisted abilities read 0, empty evasion/modifier
//     lists keep aura-sharing and Indomitable lanes closed).
//   - The rage fixture's reroll bonus is already verified end-to-end in
//     .rerolls.test.jsx; only the read-contract is pinned here.

import { describe, it, expect, vi } from 'vitest';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import {
  createCharacter,
  createRageCharacter,
  setupDefaults,
  cleanupDefaults,
} from './SavePromptModal.test-utils.jsx';

describe('createCharacter — contract with the modal save-bonus lookup', () => {
  it('resolves a distinct expected bonus for each of the six save types', () => {
    const char = createCharacter('TestChar');

    // SavePromptModal reads bonuses via getAbilitySaveBonus(computedStats, abbr).
    // Distinct per-ability values prove the lookup actually discriminates —
    // a fixture rename or shape drift breaks here, not silently in roll math.
    expect(getAbilitySaveBonus(char.computedStats, 'str')).toBe(2);
    expect(getAbilitySaveBonus(char.computedStats, 'dex')).toBe(1);
    expect(getAbilitySaveBonus(char.computedStats, 'con')).toBe(3);
    expect(getAbilitySaveBonus(char.computedStats, 'int')).toBe(0);
    expect(getAbilitySaveBonus(char.computedStats, 'wis')).toBe(1);
    expect(getAbilitySaveBonus(char.computedStats, 'cha')).toBe(4);
  });

  it('honours custom abilities passed through the same lookup, unlisted reading 0', () => {
    const char = createCharacter('TestChar', undefined, undefined, [
      { name: 'Dexterity', bonus: 5 },
    ]);

    expect(getAbilitySaveBonus(char.computedStats, 'dex')).toBe(5);
    // Overrides REPLACE the defaults — an unlisted ability must read 0,
    // never fall back to the default score (lanes rely on this separation).
    expect(getAbilitySaveBonus(char.computedStats, 'str')).toBe(0);
  });

  it('defaults modifier and evasion lists so aura-sharing lanes stay closed', () => {
    const char = createCharacter('TestChar');

    // hasShareableEvasionFor / modifierListGrantsAdvantage iterate these
    // lists — undefined would throw, so empties (not undefined) are the
    // contract the component depends on.
    expect(char.saveModifiers).toEqual([]);
    expect(char.computedStats.evasionEffects).toEqual([]);
  });

  it('routes custom saveModifiers and evasionEffects to their consumption sites', () => {
    const mods = [{ target: 'saving_throw', effect: 'advantage', condition: 'charmed' }];
    const evasions = [{ saveType: 'DEX', shareable: true, shareRange: 10 }];
    const char = createCharacter('TestChar', mods, evasions);

    expect(char.saveModifiers).toEqual(mods);
    expect(char.computedStats.evasionEffects).toEqual(evasions);
    // An unknown character in the same roster keeps neutral defaults.
    const untouched = createCharacter('OtherChar');
    expect(untouched.saveModifiers).toEqual([]);
  });
});

describe('createRageCharacter — contract with reroll-lane reads', () => {
  it('supplies the values the modal reads for rage reroll bonuses', () => {
    const char = createRageCharacter('Rager', 6);

    // SavePromptModal resolves the reroll bonus as
    // class.class_levels[(level || 1) - 1].rage_damage — pin the access
    // path, not the literal shape.
    expect(char.class.class_levels[(char.level || 1) - 1].rage_damage).toBe(6);
    expect(getAbilitySaveBonus(char.computedStats, 'con')).toBe(3);
    // Empty saveModifiers keeps the Indomitable lane switched off in reroll
    // suites that reuse this fixture.
    expect(char.saveModifiers).toEqual([]);
  });
});

describe('setupDefaults/cleanupDefaults — shared harness defaults', () => {
  it('resets consumer mocks to deterministic suite-wide defaults and provides an EventSource', async () => {
    // Stale-behaving mocks going in: setupDefaults must fully override both
    // return values and call history, which every lane's assertions assume.
    const rollD20 = vi.fn(() => 99);
    const computeAuraBonus = vi.fn(() => Promise.resolve({ bonus: 7, sourceName: 'Stale' }));
    const getRuntimeValue = vi.fn(() => 'stale');

    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);

    expect(rollD20()).toBe(15);
    await expect(computeAuraBonus()).resolves.toEqual({ bonus: 0, sourceName: null });
    expect(getRuntimeValue('anyTarget', 'anyKey', 'test-campaign')).toBeNull();
    // jsdom lacks EventSource; the global installed here keeps SSE-connecting
    // components renderable.
    expect(() => new EventSource('/subscribe')).not.toThrow();

    cleanupDefaults();
    expect(globalThis.EventSource).toBeUndefined();
  });
});
