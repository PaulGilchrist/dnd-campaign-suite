// @maintained-by-ai
// MA-0399 Black Pudding Split + MA-1249 Ochre Jelly arming/species prose.
// Row carries automation {type:'reaction', trigger:'bloodied_or_lightning_slashing',
// effect:'split'}; the gate reads live combatSummary HP (bloodied: ≤ floor(maxHp/2)
// with 10+ HP) and the campaign lastAttack damageTypes (case-insensitive
// lightning/slashing, "subjected to" — immunity-zeroed damage still counts,
// actualDamage is never read). Response is a GM-executed duplication advisory
// (CLA-325/MA-0006 record-only precedent): popup + ability_use log carry
// one-size-smaller + floor(hp/2). Refusals log split_refused with zero writes;
// At Will sentinel never spends MONSTER_REACTION_USES; 1/round latch
// (_split_usedRound) + lastAttack.splitResolved event stamp gate re-fires.
// Consumers (MonsterCardModal.jsx / MonsterAction.jsx chip threading) and the
// other gated effects of getGatedMonsterReaction/monsterReactionUsesRemaining
// are sibling producer lanes (MonsterCardHelpers.gated-reaction.test.js) —
// not re-tested here.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  oneSizeSmaller,
  splitTriggerEvidence,
  splitGate,
  monsterReactionUsesRemaining,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const PUDDING = {
  name: 'Split',
  description: 'Trigger: While the pudding is Large or Medium and has 10+ Hit Points, it becomes <strong>Bloodied</strong> or is subjected to Lightning or Slashing damage. Response: The pudding splits into two new <strong>Black Puddings</strong>.',
  usage: 'At Will',
  uses: 999,
  maxUses: 999,
  automation: { type: 'reaction', trigger: 'bloodied_or_lightning_slashing', effect: 'split', minHp: 10, damageTypes: ['Lightning', 'Slashing'] },
};

const MONSTER = 'Black Pudding 1';
const OCHRE = 'Ochre Jelly 1';
const CAMPAIGN = 'test-campaign';

function combatant(overrides = {}) {
  return { name: MONSTER, type: 'npc', size: 'Large', maxHp: 68, currentHp: 68, ...overrides };
}

function slashingAttack(overrides = {}) {
  return { attackerName: 'ElderPaladin', targetName: MONSTER, attackName: 'Longsword', damageTypes: ['Slashing'], primaryDamageType: 'Slashing', actualDamage: 28, damageApplied: true, ...overrides };
}

function makeDeps({ lastAttack = null, round = 1, creatures = [], store = {} } = {}) {
  const state = { ...store };
  const logs = [];
  return {
    state,
    logs,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => ({ round, creatures })),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => { state[`${key}.${prop}`] = value; }),
      addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    },
  };
}

function ochreRow() {
  return monsters.find(m => m.index === 'ochre-jelly').reactions[0];
}
function puddingRow() {
  return monsters.find(m => m.index === 'black-pudding').reactions[0];
}

describe('MA-0399/MA-1249 split registry + disk fingerprints (BY-name #387)', () => {
  it('black-pudding + ochre-jelly disk rows arm split identically', () => {
    const pudding = puddingRow();
    const ochre = ochreRow();
    expect(getGatedMonsterReaction(pudding)?.effect).toBe('split');
    expect(getGatedMonsterReaction(ochre)?.effect).toBe('split');
    // Plain-row null-negative owned ONCE file-wide at owner gated-reaction.test.js:66 (#417/#508) — not re-pinned.
    // MA-1249: ochre armed with the Black Pudding block VERBATIM (zero-affordance fix)
    expect(pudding.automation).toEqual({ type: 'reaction', trigger: 'bloodied_or_lightning_slashing', effect: 'split', minHp: 10, damageTypes: ['Lightning', 'Slashing'] });
    expect(ochre.automation).toEqual(pudding.automation);
    for (const row of [pudding, ochre]) {
      expect(row.name).toBe('Split');
      expect(row.usage).toBe('At Will');
      expect(row.uses).toBe(999);
      expect(row.maxUses).toBe(999);
      expect(monsterReactionUsesRemaining(row, {})).toBe(999); // RAW-unlimited sentinel
    }
    expect(pudding.description).toMatch(/^Trigger: While the pudding is Large or Medium/);
    expect(ochre.description).toMatch(/^The jelly splits into two new <strong>Ochre Jellies<\/strong>/);
  });

  it('oneSizeSmaller walks the ladder; Tiny/unknown/null return null', () => {
    expect(oneSizeSmaller('Huge')).toBe('Large');
    expect(oneSizeSmaller('Large')).toBe('Medium');
    expect(oneSizeSmaller('Tiny')).toBeNull();
    expect(oneSizeSmaller('weird')).toBeNull();
    expect(oneSizeSmaller(null)).toBeNull();
  });
});

describe('MA-0399 splitTriggerEvidence once-per-branch truth table', () => {
  const auto = PUDDING.automation;
  const ev = (lastAttack, monster) => splitTriggerEvidence({ lastAttack, monster, auto });

  it('bloodied + damage_type satisfy; size/combatant/trigger refuse', () => {
    // bloodied path (≤ floor(maxHp/2), ≥ minHp 10)
    expect(ev(null, combatant({ currentHp: 30 }))).toMatchObject({ satisfied: true, via: 'bloodied', hp: 30, maxHp: 68 });
    expect(ev(null, combatant({ currentHp: 34 })).satisfied).toBe(true); // boundary floor(68/2)
    expect(ev(null, combatant({ currentHp: 35 })).satisfied).toBe(false); // one above the boundary
    expect(ev(null, combatant({ maxHp: 16, currentHp: 8 }))).toMatchObject({ satisfied: false, reason: 'trigger' }); // below 10+ HP floor (RAW)
    // damage_type path — not-bloodied + case-insensitive match, immune 0-dealt still "subjected to"
    expect(ev(slashingAttack({ damageTypes: ['lightning'] }), combatant({ currentHp: 60 }))).toMatchObject({ satisfied: true, via: 'damage_type', damageType: 'lightning' });
    expect(ev(slashingAttack({ actualDamage: 0 }), combatant())).toMatchObject({ satisfied: true, via: 'damage_type', damageType: 'Slashing' });
    // refusals
    expect(ev(slashingAttack({ damageTypes: ['Piercing'], primaryDamageType: 'Piercing' }), combatant({ currentHp: 60 }))).toMatchObject({ satisfied: false, reason: 'trigger' });
    expect(ev(slashingAttack({ targetName: 'AasimarTest' }), combatant({ currentHp: 60 })).satisfied).toBe(false); // aimed at ANOTHER creature
    expect(ev(null, combatant({ size: 'Small', maxHp: 20, currentHp: 10 }))).toMatchObject({ satisfied: false, reason: 'size' });
    expect(ev(null, null).reason).toBe('combatant');
  });
});

describe('MA-0399 splitGate event stamps + floor(hp/2)', () => {
  const auto = PUDDING.automation;

  it('reacted stamp / round latch / trigger refuse; fresh allows with odd HP floored down', () => {
    expect(splitGate({ lastAttack: slashingAttack({ splitResolved: true, splitBy: MONSTER }), monster: combatant({ currentHp: 30 }), monsterName: MONSTER, currentRound: 4, usedRound: 0, auto }).reason).toBe('reacted');
    expect(splitGate({ lastAttack: slashingAttack(), monster: combatant({ currentHp: 30 }), monsterName: MONSTER, currentRound: 4, usedRound: 4, auto }).reason).toBe('round');
    expect(splitGate({ lastAttack: slashingAttack({ damageTypes: ['Piercing'] }), monster: combatant({ currentHp: 60 }), monsterName: MONSTER, currentRound: 4, usedRound: 0, auto }).reason).toBe('trigger');
    const gate = splitGate({ lastAttack: null, monster: combatant({ currentHp: 31 }), monsterName: MONSTER, currentRound: 5, usedRound: 4, auto });
    expect(gate.ok).toBe(true);
    expect(gate.eachHp).toBe(15); // floor(31/2)
  });
});

describe('MA-0399 resolveMonsterGatedReaction split wiring', () => {
  it('bloodied accept: latch stamped, At Will spends NO uses, ability_use + popup carry Medium 15/15 duplication instruction', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: null, round: 3, creatures: [combatant({ currentHp: 30 })] });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${MONSTER}._split_usedRound`]).toBe(3);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Split');
    expect(spend.description).toMatch(/Bloodied at 30\/68/);
    expect(spend.description).toMatch(/two Medium Black Puddings at 15\/15 HP each/);
    expect(result.eachHp).toBe(15);
    expect(result.newSize).toBe('Medium');
    expect(result.popupHtml).toMatch(/GM-Executed Duplication/);
    expect(result.popupHtml).toMatch(/15\/15 HP each/);
  });

  it('damage-event accept (immune, 0 dealt): stamps lastAttack splitResolved + splitBy + splitIntoHp', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: slashingAttack({ actualDamage: 0 }), round: 2, creatures: [combatant({ currentHp: 68 })] });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.eachHp).toBe(34);
    const stamped = state['campaign.lastAttack'];
    expect(stamped.splitResolved).toBe(true);
    expect(stamped.splitBy).toBe(MONSTER);
    expect(stamped.splitIntoHp).toBe(34);
    expect(logs.find(l => l.type === 'ability_use').description).toMatch(/subjected to Slashing damage/);
  });

  it('refusals (round latch re-click, not-in-encounter) log split_refused with zero writes + refusal popup', async () => {
    const { state, logs, deps } = makeDeps({
      lastAttack: null,
      round: 6,
      creatures: [combatant({ currentHp: 30 })],
      store: { [`${MONSTER}._split_usedRound`]: 6 },
    });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(result.popupHtml).toMatch(/Split Refused/);
    expect(logs[0].automationType).toBe('split_refused');
    expect(logs[0].description).toMatch(/round/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();

    const absent = makeDeps({ lastAttack: null, creatures: [] });
    const result2 = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps: absent.deps });
    expect(result2.ok).toBe(false);
    expect(absent.logs[0].automationType).toBe('split_refused');
    expect(absent.logs[0].description).toMatch(/combatant/);
    expect(absent.deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('MA-1249 species-threaded Split prose (MA-0869 lineage)', () => {
  it('bloodied ochre press prints OCHRE JELLY prose (popup + spend log), never Black Puddings', async () => {
    const { state, logs, deps } = makeDeps({
      lastAttack: null,
      round: 2,
      creatures: [{ name: OCHRE, type: 'npc', size: 'Large', maxHp: 52, currentHp: 26 }],
    });
    const result = await resolveMonsterGatedReaction({ action: ochreRow(), monsterName: OCHRE, campaignName: CAMPAIGN, species: OCHRE, deps });
    expect(result.ok).toBe(true);
    expect(result.eachHp).toBe(13);
    expect(state[`${OCHRE}._split_usedRound`]).toBe(2);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toMatch(/two Medium Ochre Jellies at 13\/13 HP each/);
    expect(spend.description).not.toMatch(/pudding/i);
    expect(result.popupHtml).toMatch(/two Medium Ochre Jellies/);
    expect(result.popupHtml).toMatch(/add the two jellies via the Encounter Builder/);
    expect(result.popupHtml).not.toMatch(/pudding/i);
  });

  it('EB-suffixed species "Black Pudding 1" strips the suffix to BYTE-IDENTICAL default pudding prose', async () => {
    const { logs, deps } = makeDeps({ lastAttack: null, round: 3, creatures: [combatant({ currentHp: 30 })] });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, species: 'Black Pudding 1', deps });
    expect(result.ok).toBe(true);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toBe(`${MONSTER} uses Split (Bloodied at 30/68 HP) — GM duplication instruction: replace ${MONSTER} with two Medium Black Puddings at 15/15 HP each (floor(30/2)), each on its own Initiative. No monster-duplication subsystem — add via Encounter Builder + stamp HP (GM-enforced, advisory record). At Will — unlimited, 1 Reaction per round.`);
    expect(result.popupHtml).toContain('two Medium Black Puddings');
    expect(result.popupHtml).toContain('add the two puddings via the Encounter Builder');
  });
});
