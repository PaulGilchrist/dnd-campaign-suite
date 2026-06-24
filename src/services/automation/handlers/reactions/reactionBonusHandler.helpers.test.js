// @improved-by-ai
import { describe, it, expect } from 'vitest';

import { campaignName, mapName, makePlayerStats, makeAction } from './reactionBonusHandler.helpers.js';

// ── Constants ────────────────────────────────────────────────────

describe('reactionBonusHandler.helpers — constants', () => {
  it('exports campaignName as "TestCampaign"', () => {
    expect(campaignName).toBe('TestCampaign');
  });

  it('exports mapName as "DungeonMap"', () => {
    expect(mapName).toBe('DungeonMap');
  });
});

// ── makePlayerStats ──────────────────────────────────────────────

describe('makePlayerStats', () => {
  it('returns an object with the expected top-level keys', () => {
    const ps = makePlayerStats();

    expect(Object.keys(ps)).toEqual(
      expect.arrayContaining(['name', 'proficiency', 'level', 'speed', 'abilities']),
    );
  });

  it('returns default values when called with no arguments', () => {
    const ps = makePlayerStats();

    expect(ps).toMatchObject({
      name: 'Paladin',
      proficiency: 2,
      level: 3,
      speed: 30,
    });
  });

  it('includes all six ability scores with correct default bonuses', () => {
    const ps = makePlayerStats();

    expect(ps.abilities.length).toBe(6);

    const abilityMap = {};
    for (const ability of ps.abilities) {
      abilityMap[ability.name] = ability;
    }

    expect(abilityMap).toMatchObject({
      Strength: { bonus: 3 },
      Dexterity: { bonus: 1 },
      Constitution: { bonus: 2 },
      Intelligence: { bonus: 0 },
      Wisdom: { bonus: 1 },
      Charisma: { bonus: 3 },
    });
  });

  it('merges top-level overrides into defaults', () => {
    const ps = makePlayerStats({ name: 'CustomBard', level: 7 });

    expect(ps.name).toBe('CustomBard');
    expect(ps.level).toBe(7);
    expect(ps.proficiency).toBe(2);
    expect(ps.speed).toBe(30);
  });

  it('replaces the entire abilities array when overridden', () => {
    const ps = makePlayerStats({ abilities: [{ name: 'CustomStat', bonus: 4 }] });

    expect(ps.abilities).toEqual([{ name: 'CustomStat', bonus: 4 }]);
  });

  it('returns a fresh object per call (no shared reference)', () => {
    const ps1 = makePlayerStats();
    const ps2 = makePlayerStats();

    expect(ps1).not.toBe(ps2);
    expect(ps1.abilities).not.toBe(ps2.abilities);
  });

  it('still returns a fresh abilities array when merging', () => {
    const ps1 = makePlayerStats({ name: 'A' });
    const ps2 = makePlayerStats({ name: 'B' });

    expect(ps1.abilities).not.toBe(ps2.abilities);
  });
});

// ── makeAction ───────────────────────────────────────────────────

describe('makeAction', () => {
  it('returns an object with the expected top-level keys', () => {
    const action = makeAction();

    expect(Object.keys(action)).toEqual(expect.arrayContaining(['name', 'automation']));
    expect(Object.keys(action.automation)).toEqual(
      expect.arrayContaining([
        'effect',
        'duration',
        'uses_expression',
        'usesMax',
        'uses',
        'resourceKey',
        'allyRange',
        'noOAs',
      ]),
    );
  });

  it('returns default values when called with no arguments', () => {
    const action = makeAction();

    expect(action).toMatchObject({
      name: 'Test Reaction',
      automation: {
        effect: '',
        duration: '',
        uses_expression: null,
        usesMax: null,
        uses: 0,
        resourceKey: null,
        allyRange: '30 ft',
        noOAs: false,
      },
    });
  });

  it('merges automation overrides into the automation object', () => {
    const action = makeAction({
      effect: 'miss_on_failed_save',
      duration: '1_minute',
      allyRange: '50 ft',
    });

    expect(action.automation.effect).toBe('miss_on_failed_save');
    expect(action.automation.duration).toBe('1_minute');
    expect(action.automation.allyRange).toBe('50 ft');
    expect(action.automation.uses_expression).toBeNull();
    expect(action.automation.noOAs).toBe(false);
  });

  it('allows setting uses and usesMax', () => {
    const action = makeAction({ uses: 2, usesMax: 3 });

    expect(action.automation.uses).toBe(2);
    expect(action.automation.usesMax).toBe(3);
  });

  it('allows setting resourceKey', () => {
    const action = makeAction({ resourceKey: 'customResource' });

    expect(action.automation.resourceKey).toBe('customResource');
  });

  it('allows setting uses_expression', () => {
    const action = makeAction({ uses_expression: 'proficiency_bonus' });

    expect(action.automation.uses_expression).toBe('proficiency_bonus');
  });

  it('allows setting noOAs to true', () => {
    const action = makeAction({ noOAs: true });

    expect(action.automation.noOAs).toBe(true);
  });

  it('returns a fresh object per call (no shared reference)', () => {
    const action1 = makeAction();
    const action2 = makeAction();

    expect(action1).not.toBe(action2);
    expect(action1.automation).not.toBe(action2.automation);
  });

  it('still returns a fresh automation object when merging', () => {
    const action1 = makeAction({ effect: 'a' });
    const action2 = makeAction({ effect: 'b' });

    expect(action1.automation).not.toBe(action2.automation);
  });
});
