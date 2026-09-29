// MA-1581: Tarrasque legendary_actions[2] "Move" was plain text with zero
// affordance (FAIL(b)/DATA). Fix = advisory child stamp
// {advisory:"movement", advisory_message} after name, before description —
// the §MA-1456 nameless-advisory / MA-0957 gynosphinx byte-twin of the
// MA-0058/0270/0271 legendary advisory seam: the row keeps riding the
// single gated "Expend Legendary" chip (MA-0021 economy, header uses:3
// MA-1579 verified — never re-added), the spend is adjudicated by the
// shared gate, then resolveLegendaryRowMechanic's advisory leg
// (MonsterCardModal.jsx:691, advisory checked BEFORE the numeric leg
// §MA-1457) lands an honest adjudication record (popup + ability_use log)
// instead of a console.error dead-end. Movement-distance (half of walk
// 40 ft. = 20 ft.) stays GM-enforced: no movement-distance consumer
// app-wide (§70), token-drag residual by design precedent.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  legendaryHeaderAction,
  legendaryExpendGate,
  expendLegendaryUse,
  regainLegendaryUses,
  buildLegendaryAdvisoryPopup,
  buildLegendaryAdvisoryLog,
  hasLegendaryCooldownClause,
} from './monsterLegendaryUses.js';
import { isMonsterActionAdvisoryRow } from './monsterActionAdvisory.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const tarrasque = monstersData.find(m => m.index === 'tarrasque');
const move = tarrasque.legendary_actions[2];

describe('MA-1581 monsters.json data: Tarrasque legendary "Move" advisory stamp', () => {
  it('legendary_actions[2] is Move with advisory + advisory_message after name, before description', () => {
    expect(move.name).toBe('Move');
    expect(Object.keys(move)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(move.advisory).toBe('movement');
    expect(move.advisory_message).toBe('moves up to half its speed (40 ft.) — advisory record: GM moves the token; no movement-distance consumer (MA-1581). Movement-distance is GM-enforced and the spend is already adjudicated by the legendary gate.');
    expect(move.description).toBe('The tarrasque moves up to half its speed.');
  });

  it('row authors no numeric/mechanic fields: advisory child never rolls (§168 child template)', () => {
    expect(move.attack_bonus).toBeUndefined();
    expect(move.save_dc).toBeUndefined();
    expect(move.damage_dice_primary).toBeUndefined();
    expect(move.delegates_to).toBeUndefined();
    expect(move.uses).toBeUndefined();
    // No per-action cooldown clause on this row — boundary economy only.
    expect(hasLegendaryCooldownClause(move)).toBe(false);
  });

  it('advisory arm recognized: predicate true, advisory_message twin wins over MA-0058 invisible copy', () => {
    expect(isMonsterActionAdvisoryRow(move)).toBe(true);
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'Tarrasque 1', action: move });
    expect(html).toContain('<div class="mc-prerequisite-refusal">');
    expect(html).toContain('<h3>Legendary Action — Move</h3>');
    expect(html).toContain('Tarrasque 1 moves up to half its speed (40 ft.) — advisory record: GM moves the token; no movement-distance consumer (MA-1581).');
    expect(html).toContain('Movement-distance is GM-enforced and the spend is already adjudicated by the legendary gate.');
    // MA-0058 fallback copy must NOT leak onto rows carrying advisory_message.
    expect(html).not.toContain('casts movement on itself');
  });

  it('advisory log is an honest ability_use record naming the row and residual', () => {
    const entry = buildLegendaryAdvisoryLog({ monsterName: 'Tarrasque 1', action: move });
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Tarrasque 1');
    expect(entry.abilityName).toBe('Move');
    expect(entry.description).toBe('Tarrasque 1 legendary action Move: Tarrasque 1 moves up to half its speed (40 ft.) — advisory record: GM moves the token; no movement-distance consumer (MA-1581). Movement-distance is GM-enforced and the spend is already adjudicated by the legendary gate.');
  });
});

describe('MA-1581 advisory Move rides the shared legendary economy (uses:3 intact)', () => {
  let store;
  let logs;
  let deps;
  let cs;
  beforeEach(() => {
    store = {};
    logs = [];
    cs = { round: 1, activeCreatureName: 'Bandit 1' };
    deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve(cs)),
    };
  });

  it('header byte-locked MA-1579: uses:3 counter arms; press at end-of-other-turn spends 3→2', async () => {
    const header = legendaryHeaderAction(tarrasque);
    expect(header.name).toBe('General');
    expect(header.uses).toBe(3);
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', action: move, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(logs.some(e => e.type === 'ability_use' && /expends a legendary use for Move .* 2 of 3 left/.test(e.description))).toBe(true);
  });

  it('second press same boundary refuses turn-latch with ZERO extra spend', async () => {
    await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', action: move, campaignName: 'test-campaign', deps });
    const refused = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', action: move, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(refused.reason).toBe('turn');
    expect(refused.popupHtml).toMatch(/Only one legendary action can be expended immediately after each creature's turn/);
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });

  it('full pool walk spends 3→2→1→0 then exhausted refuses; turn-start regain refills to 3', async () => {
    const first = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', action: move, campaignName: 'test-campaign', deps });
    expect(first.remaining).toBe(2);
    cs.activeCreatureName = 'Bandit 2';
    const second = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', action: move, campaignName: 'test-campaign', deps });
    expect(second.remaining).toBe(1);
    cs.activeCreatureName = 'ElderPaladin';
    const third = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', action: move, campaignName: 'test-campaign', deps });
    expect(third.remaining).toBe(0);
    cs.activeCreatureName = 'Bandit 3';
    const exhausted = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', action: move, campaignName: 'test-campaign', deps });
    expect(exhausted.reason).toBe('exhausted');
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    const regain = await regainLegendaryUses({ monsterName: 'Tarrasque 1', campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: true, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses'].used).toBe(0);
  });

  it('gate fingerprint: latch tokens turn/exhausted/own-turn honest for the Move child (§MA-1456)', () => {
    const header = legendaryHeaderAction(tarrasque);
    expect(legendaryExpendGate({ header, storedUses: {}, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Tarrasque 1', latch: null })).toEqual({ allowed: true, remaining: 3, max: 3 });
    expect(legendaryExpendGate({ header, storedUses: { max: 3, used: 3 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Tarrasque 1', latch: null }).reason).toBe('exhausted');
    expect(legendaryExpendGate({ header, storedUses: { max: 3, used: 1 }, round: 1, activeCreatureName: 'Tarrasque 1', monsterName: 'Tarrasque 1', latch: null }).reason).toBe('own-turn');
    expect(legendaryExpendGate({ header, storedUses: { max: 3, used: 1 }, round: 2, activeCreatureName: 'Bandit 1', monsterName: 'Tarrasque 1', latch: { round: 2, activeCreature: 'Bandit 1' } }).reason).toBe('turn');
  });
});

describe('MA-1581 block siblings intact', () => {
  it('Attack delegate + Chomp cost-2 byte-locked (MA-1580 verified, not re-added)', () => {
    const attack = tarrasque.legendary_actions[1];
    expect(Object.keys(attack)).toEqual(['name', 'delegates_to', 'description']);
    expect(attack.delegates_to).toBe('Claw');
    const chomp = tarrasque.legendary_actions[3];
    expect(chomp.name).toBe('Chomp (Costs 2 Actions)');
    expect(Object.keys(chomp)).toEqual(['name', 'description']);
    expect(chomp.description).toBe('The tarrasque makes one bite attack or uses its Swallow.');
  });

  it('androsphinx advisory twin byte-locked: Teleport (Costs 2 Actions) advisory + advisory_message (CLA-320 copy)', () => {
    const andro = monstersData.find(m => m.index === 'androsphinx');
    expect(andro.legendary_actions[0].uses).toBe(3);
    const tp = andro.legendary_actions.find(a => a.name === 'Teleport (Costs 2 Actions)');
    expect(Object.keys(tp)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(tp.advisory).toBe('sphinx_teleport');
    expect(tp.advisory_message).toContain('no position consumer (CLA-320)');
    expect(tp.advisory_message).toContain('the engine spends 1 per click');
  });

  it('arch-hag advisory twin byte-locked: Malicious Magic advisory + advisory_message (spellcast-choice copy)', () => {
    const hag = monstersData.find(m => m.index === 'arch-hag');
    expect(hag.legendary_actions[0].uses).toBe(3);
    const mm = hag.legendary_actions.find(a => a.name === 'Malicious Magic');
    expect(Object.keys(mm)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(mm.advisory).toBe('malicious_magic');
    expect(mm.advisory_message).toContain('GM adjudicates spell choice');
    // arch-hag twin per-action cooldown clause stays honest: refused via cooldown arm
    expect(hasLegendaryCooldownClause(mm)).toBe(true);
  });
});
