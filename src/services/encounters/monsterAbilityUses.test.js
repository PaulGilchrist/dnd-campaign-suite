// MA-0020: Aboleth "Dominate Mind (2/Day)" — N/Day ability-save-row
// enforcement helpers. Reuses the MA-0005 monsterSpellUses runtime map.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MONSTER_SPELL_USES_KEY,
  abilitySaveUseKey,
  abilitySaveMaxUses,
  monsterAbilitySaveUsesGate,
  buildAbilitySaveRefusalLog,
  buildAbilitySaveRefusalPopup,
  spendMonsterAbilityUse,
  extractConditionDurationNote,
} from './monsterAbilityUses.js';

const DOMINATE_MIND = {
  name: 'Dominate Mind (2/Day)',
  save_dc: 16,
  save_type: 'Wisdom',
  save_effect: 'Failure: The target has the Charmed condition until the aboleth dies or is on a different plane of existence from the target',
  usage: '2/Day',
  uses: 2,
  maxUses: 2,
};

describe('MA-0020 ability save uses gate', () => {
  it('keys the counter off the action name with the (N/Day) suffix stripped, in the MA-0005 monsterSpellUses map', () => {
    expect(abilitySaveUseKey(DOMINATE_MIND)).toBe('Dominate Mind');
    expect(MONSTER_SPELL_USES_KEY).toBe('monsterSpellUses');
    expect(abilitySaveMaxUses(DOMINATE_MIND)).toBe(2);
  });

  it('reports remaining 2 fresh, 1 after one use, exhausted at 2', () => {
    expect(monsterAbilitySaveUsesGate(DOMINATE_MIND, {})).toMatchObject({ useKey: 'Dominate Mind', maxUses: 2, used: 0, remaining: 2, exhausted: false });
    expect(monsterAbilitySaveUsesGate(DOMINATE_MIND, { 'Dominate Mind': 1 })).toMatchObject({ used: 1, remaining: 1, exhausted: false });
    expect(monsterAbilitySaveUsesGate(DOMINATE_MIND, { 'Dominate Mind': 2 })).toMatchObject({ used: 2, remaining: 0, exhausted: true });
  });

  it('unlimited rows (no authored uses) return null', () => {
    expect(monsterAbilitySaveUsesGate({ name: 'Tentacle', save_dc: 14 }, {})).toBeNull();
    expect(abilitySaveMaxUses({ name: 'Tentacle' })).toBeNull();
  });
});

describe('MA-0020 refusal log + popup', () => {
  it('refusal log is dominate_mind_refused with zero-spend wording', () => {
    const entry = buildAbilitySaveRefusalLog({ monsterName: 'Aboleth 1', useKey: 'Dominate Mind', maxUses: 2 });
    expect(entry.automationType).toBe('dominate_mind_refused');
    expect(entry.characterName).toBe('Aboleth 1');
    expect(entry.description).toMatch(/already used Dominate Mind today \(2\/Day\)/);
    expect(entry.description).toMatch(/refused/);
    expect(entry.description).toMatch(/GM-enforced/);
  });

  it('refusal popup reuses the mc-prerequisite-refusal block', () => {
    expect(buildAbilitySaveRefusalPopup({ monsterName: 'Aboleth 1', useKey: 'Dominate Mind', maxUses: 2 })).toMatch(/mc-prerequisite-refusal/);
  });
});

describe('MA-0020 spend at prompt-confirm', () => {
  let store;
  let logs;
  let deps;
  beforeEach(() => {
    store = {};
    logs = [];
    deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
    };
  });

  it('spends 1 of 2, increments the monsterSpellUses counter, logs ability_use with X left today', async () => {
    const use = { useKey: 'Dominate Mind', maxUses: 2, actionName: 'Dominate Mind (2/Day)' };
    const remaining = await spendMonsterAbilityUse({ monsterName: 'Aboleth 1', use, targetName: 'AberrantSorcerer', campaignName: 'test-campaign', deps });

    expect(remaining).toBe(1);
    expect(store['Aboleth 1.monsterSpellUses']).toEqual({ 'Dominate Mind': 1 });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend).toBeTruthy();
    expect(spend.characterName).toBe('Aboleth 1');
    expect(spend.abilityName).toBe('Dominate Mind (2/Day)');
    expect(spend.description).toMatch(/on AberrantSorcerer — 1 use spent, 1 left today/);

    const remaining2 = await spendMonsterAbilityUse({ monsterName: 'Aboleth 1', use, targetName: 'Other', campaignName: 'test-campaign', deps });
    expect(remaining2).toBe(0);
    expect(store['Aboleth 1.monsterSpellUses']).toEqual({ 'Dominate Mind': 2 });
  });

  it('double-spend guard at max: nothing increments, refusal logged', async () => {
    store['Aboleth 1.monsterSpellUses'] = { 'Dominate Mind': 2 };
    const use = { useKey: 'Dominate Mind', maxUses: 2, actionName: 'Dominate Mind (2/Day)' };
    const remaining = await spendMonsterAbilityUse({ monsterName: 'Aboleth 1', use, targetName: 'AberrantSorcerer', campaignName: 'test-campaign', deps });

    expect(remaining).toBeNull();
    expect(store['Aboleth 1.monsterSpellUses']).toEqual({ 'Dominate Mind': 2 });
    expect(logs.some(e => e.automationType === 'dominate_mind_refused')).toBe(true);
    expect(logs.some(e => e.type === 'ability_use')).toBe(false);
  });
});

describe('MA-0020 duration note (CLA-325 advisory)', () => {
  it('extracts the authored until-clause, GM-enforced tagged', () => {
    expect(extractConditionDurationNote(DOMINATE_MIND.save_effect)).toBe('until the aboleth dies or is on a different plane of existence from the target (GM-enforced)');
  });

  it('returns null for rows without an until-clause', () => {
    expect(extractConditionDurationNote('Failure: 10 (3d6) Psychic damage. Success: Half damage.')).toBeNull();
    expect(extractConditionDurationNote(null)).toBeNull();
  });
});
