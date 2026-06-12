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
  it('returns a playerStats object with default values', () => {
    const ps = makePlayerStats();

    expect(ps.name).toBe('Paladin');
    expect(ps.proficiency).toBe(2);
    expect(ps.level).toBe(3);
    expect(ps.speed).toBe(30);
  });

  it('includes all six ability scores with default bonuses', () => {
    const ps = makePlayerStats();

    expect(ps.abilities).toHaveLength(6);

    const abilityMap = {};
    for (const ability of ps.abilities) {
      abilityMap[ability.name] = ability;
    }

    expect(abilityMap.Strength.bonus).toBe(3);
    expect(abilityMap.Dexterity.bonus).toBe(1);
    expect(abilityMap.Constitution.bonus).toBe(2);
    expect(abilityMap.Intelligence.bonus).toBe(0);
    expect(abilityMap.Wisdom.bonus).toBe(1);
    expect(abilityMap.Charisma.bonus).toBe(3);
  });

  it('merges overrides into the base object', () => {
    const ps = makePlayerStats({ name: 'CustomBard', level: 7 });

    expect(ps.name).toBe('CustomBard');
    expect(ps.level).toBe(7);
    expect(ps.proficiency).toBe(2);
    expect(ps.speed).toBe(30);
  });

  it('overrides individual ability bonuses', () => {
    const ps = makePlayerStats({
      abilities: [
        { name: 'Strength', bonus: 5 },
        { name: 'Charisma', bonus: 6 },
      ],
    });

    expect(ps.abilities).toHaveLength(2);
    expect(ps.abilities[0].name).toBe('Strength');
    expect(ps.abilities[0].bonus).toBe(5);
    expect(ps.abilities[1].name).toBe('Charisma');
    expect(ps.abilities[1].bonus).toBe(6);
  });

  it('returns a fresh object per call (no shared reference)', () => {
    const ps1 = makePlayerStats();
    const ps2 = makePlayerStats();

    expect(ps1).not.toBe(ps2);
    expect(ps1.abilities).not.toBe(ps2.abilities);
  });

  it('allows overriding the abilities array entirely', () => {
    const ps = makePlayerStats({ abilities: [{ name: 'CustomStat', bonus: 4 }] });

    expect(ps.abilities).toHaveLength(1);
    expect(ps.abilities[0].name).toBe('CustomStat');
    expect(ps.abilities[0].bonus).toBe(4);
  });

  it('allows overriding proficiency', () => {
    const ps = makePlayerStats({ proficiency: 6 });

    expect(ps.proficiency).toBe(6);
  });

  it('allows overriding speed', () => {
    const ps = makePlayerStats({ speed: 40 });

    expect(ps.speed).toBe(40);
  });
});

// ── makeAction ───────────────────────────────────────────────────

describe('makeAction', () => {
  it('returns an action object with default automation values', () => {
    const action = makeAction();

    expect(action.name).toBe('Test Reaction');
    expect(action.automation.effect).toBe('');
    expect(action.automation.duration).toBe('');
    expect(action.automation.uses_expression).toBeNull();
    expect(action.automation.usesMax).toBeNull();
    expect(action.automation.uses).toBe(0);
    expect(action.automation.resourceKey).toBeNull();
    expect(action.automation.allyRange).toBe('30 ft');
    expect(action.automation.noOAs).toBe(false);
  });

  it('merges automation overrides into defaults', () => {
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

  it('does not support overriding the action name at top level', () => {
    const action = makeAction({ name: 'Divine Shield' });

    expect(action.name).toBe('Test Reaction');
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

  it('allows overriding allyRange', () => {
    const action = makeAction({ allyRange: '60 ft' });

    expect(action.automation.allyRange).toBe('60 ft');
  });

  it('handles partially overlapping automation overrides', () => {
    const action = makeAction({ effect: 'inspiring_movement' });

    expect(action.automation.effect).toBe('inspiring_movement');
    expect(action.automation.duration).toBe('');
    expect(action.automation.uses).toBe(0);
    expect(action.automation.allyRange).toBe('30 ft');
    expect(action.automation.noOAs).toBe(false);
  });
});

// ── Integration: makePlayerStats + makeAction together ───────────

describe('makePlayerStats + makeAction — integration', () => {
  it('creates a valid playerStats and action pair', () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ effect: 'miss_on_failed_save' });

    expect(ps.name).toBe('Paladin');
    expect(ps.abilities.length).toBeGreaterThan(0);
    expect(action.name).toBe('Test Reaction');
    expect(action.automation.effect).toBe('miss_on_failed_save');
  });

  it('creates a bard with inspiring_movement action', () => {
    const ps = makePlayerStats({
      name: 'Bard',
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const action = makeAction({
      effect: 'inspiring_movement',
      allyRange: '40 ft',
      noOAs: true,
    });

    expect(ps.name).toBe('Bard');
    expect(ps.abilities[0].bonus).toBe(5);
    expect(action.automation.effect).toBe('inspiring_movement');
    expect(action.automation.allyRange).toBe('40 ft');
    expect(action.automation.noOAs).toBe(true);
  });
});
