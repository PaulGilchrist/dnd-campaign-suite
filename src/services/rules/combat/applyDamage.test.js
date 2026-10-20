// @maintained-by-ai
// LANE — applyDamageToTarget base lane: entry guards, player + monster HP bookkeeping
// canon, computedStats/static defenses, damage-triggered condition removal, drop-to-0
// death-save handling, hp_change log + threshold bytes, concentration DC recalculation
// canon (applyDamage.js:901-905), and the projectedWardDamage RECORD seam (:513-525).
// Owned elsewhere, never re-driven here:
//   - generic arithmetic CANON → applyDamage.helpers.test.js :53-86/:88-104/:106-166/:168-182/:184-196 (#1196)
//   - NPC concentration auto-roll (fail + pass golden bytes) → applyDamage.npcConcentrationAdvanced.test.js
//     (absorbs old :252-262/:264-274 — pending rec #1200: fail leg asserted only the
//     player-lane prompt handoff and the pass leg was bare-notNull; the monster lane owns both)
//   - player concentration prompt payload + Relentless Hunter exemption → applyDamage.relentlessHunter.test.js
//   - buff/aura/chooser/silence/dc-'full'/dominate/hypnotic/zero-HP-feature seams → their lanes
//   - Projected Ward reaction CLICK producer (arms arcaneWardActive/arcaneWardHp) → arcaneWardHandler.test.js
// Honest note (#1185): applyDamage.js:451 reads currentHitPoints WITHOUT campaignName.
// The keyed store stub below does not model campaign boundaries, so no leg here can
// discriminate that defect — runtime-store lanes own the campaign-keying contract.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

// ── Imports ─────────────────────────────────────────────────────

import { applyDamageToTarget } from './applyDamage.js';

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from '../../combat/conditions/savePromptService.js';

// ── Globals / helpers ──────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

function makeCs(creature) {
  return { round: 1, creatures: [creature] };
}

function makeCreature(name, over = {}) {
  return {
    name,
    type: 'player',
    maxHp: 45,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...over,
  };
}

function makeMonster(name, over = {}) {
  return { ...makeCreature(name, over), type: over.type || 'monster' };
}

function makeCharacter(name, extra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      ...extra,
    },
  };
}

// Runtime store stub keyed `${name}.${key}` (#1057/#1186): reads and writes mirror
// one Map so multi-apply sequences and absence checks are observable. Unlisted keys
// return undefined — every consumer guards them (|| [], Array.isArray, ?? 0).
function stubStore(initial = {}) {
  const store = new Map(Object.entries(initial));
  getRuntimeValue.mockImplementation((name, key) => store.get(`${name}.${key}`));
  setRuntimeValue.mockImplementation((name, key, value) => { store.set(`${name}.${key}`, value); });
  return store;
}

function applyDamage(cs, targetName, rawDamage, damageTypes, options = {}) {
  return applyDamageToTarget(cs, targetName, rawDamage, damageTypes, {
    campaignName: CAMPAIGN,
    characters: [makeCharacter(targetName)],
    ...options,
  });
}

function logPosts() {
  return global.fetch.mock.calls
    .filter(c => String(c[0]).includes('/log'))
    .map(c => JSON.parse(c[1].body));
}

function hpLog(name) {
  return logPosts().find(b => b.type === 'hp_change' && b.targetName === name);
}

function conditionLogs() {
  return logPosts().filter(b => b.type === 'condition');
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
  });

  it('returns null at every entry guard without touching the store or the log', async () => {
    const cs = makeCs(makeMonster('Orc'));
    expect(await applyDamage(null, 'Orc', 5, ['Bludgeoning'])).toBeNull();
    expect(await applyDamage(undefined, 'Orc', 5, ['Bludgeoning'])).toBeNull();
    expect(await applyDamage(cs, 'MissingTarget', 5, ['Slashing'])).toBeNull();
    expect(await applyDamage(cs, 'Orc', NaN, ['Slashing'])).toBeNull();
    expect(await applyDamage(cs, 'Orc', null, ['Slashing'])).toBeNull();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('applies player damage: result shape, runtime HP write, summary event, and full hp_change log bytes', async () => {
    // maxHp 45 on the creature vs 30 in the runtime store: the log must read
    // hitPoints from the runtime store (:1194-1195), not the creature object.
    const alchemist = makeCreature('Alchemist', { currentHp: 25 });
    stubStore({ 'Alchemist.currentHitPoints': 25, 'Alchemist.hitPoints': 30 });
    let dispatched = false;
    window.addEventListener('combat-summary-updated', () => { dispatched = true; });

    const result = await applyDamage(makeCs(alchemist), 'Alchemist', 8, ['Slashing']);

    expect(result).toMatchObject({ finalDamage: 8, oldHp: 25, newHp: 17, damageReduced: false, damageReducedByFeature: 0 });
    expect(setRuntimeValue).toHaveBeenCalledWith('Alchemist', 'currentHitPoints', 17, CAMPAIGN);
    expect(dispatched).toBe(true);
    expect(hpLog('Alchemist')).toEqual({
      type: 'hp_change', targetName: 'Alchemist', delta: -8, currentHp: 17, maxHp: 30,
      isHealing: false, isUnconscious: false,
    });
    expect(sendConcentrationPrompt).not.toHaveBeenCalled();
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Alchemist', 'deathSaves', expect.anything(), CAMPAIGN);
  });

  it('resolves player defenses from computedStats — resistance halves with floor, immunity zeroes and suppresses the hp_change log (delta 0)', async () => {
    const goliath = makeCreature('Goliath', { currentHp: 30 });
    const store = stubStore({ 'Goliath.currentHitPoints': 30, 'Goliath.hitPoints': 30 });
    const resistant = await applyDamage(makeCs(goliath), 'Goliath', 7, ['Cold'], {
      characters: [makeCharacter('Goliath', { resistances: ['cold'] })],
    });
    expect(resistant.finalDamage).toBe(3);
    expect(resistant.damageReduced).toBe(true);
    expect(store.get('Goliath.currentHitPoints')).toBe(27);

    vi.clearAllMocks();
    const celestial = makeCreature('Celestial', { currentHp: 30 });
    stubStore({ 'Celestial.currentHitPoints': 30, 'Celestial.hitPoints': 30 });
    const immune = await applyDamage(makeCs(celestial), 'Celestial', 15, ['Fire'], {
      characters: [makeCharacter('Celestial', { immunities: ['fire'] })],
    });
    expect(immune.finalDamage).toBe(0);
    expect(immune.damageReduced).toBe(true);
    expect(immune.newHp).toBe(30);
    expect(hpLog('Celestial')).toBeUndefined();
  });

  it('applies static resistances/immunities to monsters and mutates combatSummary.currentHp — never the player runtime HP store', async () => {
    const orc = makeMonster('Orc', { maxHp: 20, currentHp: 20, resistances: ['fire'] });
    stubStore();
    const resistant = await applyDamage(makeCs(orc), 'Orc', 9, ['Fire']);
    expect(resistant.finalDamage).toBe(4);
    expect(resistant.oldHp).toBe(20);
    expect(resistant.newHp).toBe(16);
    expect(orc.currentHp).toBe(16);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Orc', 'currentHitPoints', expect.anything(), CAMPAIGN);
    expect(hpLog('Orc')).toEqual({
      type: 'hp_change', targetName: 'Orc', delta: -4, currentHp: 16, maxHp: 20,
      isHealing: false, isUnconscious: false,
    });

    vi.clearAllMocks();
    const skeleton = makeMonster('Skeleton', { maxHp: 20, currentHp: 20, immunities: ['necrotic'] });
    stubStore();
    const immune = await applyDamage(makeCs(skeleton), 'Skeleton', 15, ['Necrotic']);
    expect(immune.finalDamage).toBe(0);
    expect(immune.damageReduced).toBe(true);
    expect(skeleton.currentHp).toBe(20);
    expect(hpLog('Skeleton')).toBeUndefined();
  });

  it('throws when runtime currentHitPoints is missing for a player target, before any log fires', async () => {
    stubStore();
    await expect(applyDamage(makeCs(makeCreature('Monk')), 'Monk', 5, ['Bludgeoning']))
      .rejects.toThrow('currentHitPoints not found for "Monk"');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('removes Frightened/Charmed on real damage with reason bytes per lane, preserving other conditions', async () => {
    // player: uppercase 'Frightened' stripped (case-insensitive match), 'poisoned' preserved
    const ranger = makeCreature('Ranger', { currentHp: 20 });
    let store = stubStore({ 'Ranger.currentHitPoints': 20, 'Ranger.hitPoints': 30, 'Ranger.activeConditions': ['Frightened', 'poisoned'] });
    await applyDamage(makeCs(ranger), 'Ranger', 5, ['Bludgeoning']);
    expect(setRuntimeValue).toHaveBeenCalledWith('Ranger', 'activeConditions', ['poisoned'], CAMPAIGN);
    expect(store.get('Ranger.activeConditions')).toEqual(['poisoned']);
    const frightLog = conditionLogs().find(b => b.condition === 'Frightened');
    expect(frightLog).toEqual(expect.objectContaining({ type: 'condition', action: 'removed', characterName: 'Ranger', reason: 'took damage' }));
    expect(conditionLogs().some(b => b.condition === 'Charmed')).toBe(false);

    // monster: 'charmed' stripped ('poisoned' preserved); NPC charm reason byte differs.
    // NOTE (reported, not pinned): frightened+charmed held TOGETHER resurrects frightened
    // — both removals filter the same single-read snapshot (:552-557, last-write-wins).
    vi.clearAllMocks();
    const wolf = makeMonster('Wolf', { maxHp: 10, currentHp: 10 });
    store = stubStore({ 'Wolf.activeConditions': ['charmed', 'poisoned'] });
    await applyDamage(makeCs(wolf), 'Wolf', 3, ['Piercing']);
    expect(store.get('Wolf.activeConditions')).toEqual(['poisoned']);
    const charmLog = conditionLogs().find(b => b.condition === 'Charmed');
    expect(charmLog).toEqual(expect.objectContaining({ action: 'removed', characterName: 'Wolf', reason: 'took damage (Charm)' }));

    // player charm reason byte differs from the NPC lane ('(Friends)')
    vi.clearAllMocks();
    const bard = makeCreature('Bard', { currentHp: 20 });
    store = stubStore({ 'Bard.currentHitPoints': 20, 'Bard.hitPoints': 30, 'Bard.activeConditions': ['charmed'] });
    await applyDamage(makeCs(bard), 'Bard', 4, ['Force']);
    expect(store.get('Bard.activeConditions')).toEqual([]);
    expect(conditionLogs().find(b => b.condition === 'Charmed')).toEqual(
      expect.objectContaining({ characterName: 'Bard', reason: 'took damage (Friends)' }),
    );
  });

  it('suppresses every damage-triggered effect when immunity zeroes the hit', async () => {
    const frosty = makeCreature('Frosty', { currentHp: 30, concentration: { spell: 'Haste', dc: 17 } });
    const store = stubStore({
      'Frosty.currentHitPoints': 30,
      'Frosty.hitPoints': 30,
      'Frosty.activeConditions': ['frightened'],
    });

    const result = await applyDamage(makeCs(frosty), 'Frosty', 5, ['Cold'], {
      characters: [makeCharacter('Frosty', { immunities: ['cold'] })],
    });

    expect(result.finalDamage).toBe(0);
    expect(result.damageReduced).toBe(true);
    expect(result.newHp).toBe(30);
    expect(store.get('Frosty.activeConditions')).toEqual(['frightened']);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Frosty', 'activeConditions', expect.anything(), CAMPAIGN);
    expect(sendConcentrationPrompt).not.toHaveBeenCalled();
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(frosty.concentration.dc).toBe(17);
    expect(hpLog('Frosty')).toBeUndefined();
  });

  it('drops a player to 0: HP clamps to 0, death prompt fires, deathSaves/deathFailures reset, log says dead', async () => {
    const fighter = makeCreature('Fighter', { currentHp: 5 });
    stubStore({ 'Fighter.currentHitPoints': 5, 'Fighter.hitPoints': 30 });

    const result = await applyDamage(makeCs(fighter), 'Fighter', 10, ['Slashing']);

    expect(result.newHp).toBe(0);
    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', 'currentHitPoints', 0, CAMPAIGN);
    expect(sendDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, { promptId: 'test-guid-001', targetName: 'Fighter' });
    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', 'deathSaves', [false, false, false], CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', 'deathFailures', [false, false, false], CAMPAIGN);
    expect(hpLog('Fighter')).toEqual({
      type: 'hp_change', targetName: 'Fighter', delta: -5, currentHp: 0, maxHp: 30,
      isHealing: false, isUnconscious: true, threshold: 'dead',
    });

    // already at 0: the HP write still happens, but prompt/deathSaves/log stay silent
    vi.clearAllMocks();
    const wounded = makeCreature('Wounded', { currentHp: 0 });
    stubStore({ 'Wounded.currentHitPoints': 0, 'Wounded.hitPoints': 30 });
    await applyDamage(makeCs(wounded), 'Wounded', 5, ['Slashing']);
    expect(setRuntimeValue).toHaveBeenCalledWith('Wounded', 'currentHitPoints', 0, CAMPAIGN);
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Wounded', 'deathSaves', expect.anything(), CAMPAIGN);
    expect(hpLog('Wounded')).toBeUndefined();
  });

  it('stamps threshold "bloodied" only on the crossing hit and omits threshold entirely once already bloodied', async () => {
    const orc = makeMonster('Orc', { maxHp: 40, currentHp: 30 });
    stubStore();
    await applyDamage(makeCs(orc), 'Orc', 15, ['Slashing']);
    expect(hpLog('Orc')).toEqual({
      type: 'hp_change', targetName: 'Orc', delta: -15, currentHp: 15, maxHp: 40,
      isHealing: false, isUnconscious: false, threshold: 'bloodied',
    });

    vi.clearAllMocks();
    const goblin = makeMonster('Goblin', { maxHp: 10, currentHp: 3 });
    stubStore();
    await applyDamage(makeCs(goblin), 'Goblin', 2, ['Slashing']);
    expect(hpLog('Goblin')).toEqual({
      type: 'hp_change', targetName: 'Goblin', delta: -2, currentHp: 1, maxHp: 10,
      isHealing: false, isUnconscious: false,
    });
  });

  it('recalculates concentration DC on damage — halves, clamps at 10, honors concentrationTotalDamage, and skipConcentration stays silent', async () => {
    // halve: dc 10 → 15 on 30 damage; the queued prompt carries the RECALCULATED dc
    const wizard = makeCreature('Wizard', { currentHp: 40, concentration: { spell: 'Haste', dc: 10 } });
    stubStore({ 'Wizard.currentHitPoints': 40, 'Wizard.hitPoints': 40 });
    await applyDamage(makeCs(wizard), 'Wizard', 30, ['Slashing']);
    expect(wizard.concentration.dc).toBe(15);
    expect(sendConcentrationPrompt).toHaveBeenCalledWith(CAMPAIGN, {
      promptId: 'test-guid-001', targetName: 'Wizard', spellName: 'Haste', dc: 15, attackerName: null,
    });

    // clamp: dc 17 → 10 (floor(8/2)=4 clamped to the 10 minimum)
    vi.clearAllMocks();
    const druid = makeCreature('Druid', { currentHp: 20, concentration: { spell: 'Speak with Animals', dc: 17 } });
    stubStore({ 'Druid.currentHitPoints': 20, 'Druid.hitPoints': 20 });
    await applyDamage(makeCs(druid), 'Druid', 8, ['Slashing']);
    expect(druid.concentration.dc).toBe(10);

    // sequence override: actual damage 4 but accumulated total 30 → dc from the total
    vi.clearAllMocks();
    const cleric = makeCreature('Cleric', { currentHp: 40, concentration: { spell: 'Spirit Guardians', dc: 10 } });
    stubStore({ 'Cleric.currentHitPoints': 40, 'Cleric.hitPoints': 40 });
    await applyDamage(makeCs(cleric), 'Cleric', 4, ['Slashing'], { concentrationTotalDamage: 30 });
    expect(cleric.concentration.dc).toBe(15);

    // skipConcentration: dc untouched, no prompt — but damage still lands
    vi.clearAllMocks();
    const barbarian = makeCreature('Barbarian', { currentHp: 20, concentration: { spell: 'Haste', dc: 17 } });
    stubStore({ 'Barbarian.currentHitPoints': 20, 'Barbarian.hitPoints': 20 });
    await applyDamage(makeCs(barbarian), 'Barbarian', 8, ['Slashing'], { skipConcentration: true });
    expect(barbarian.concentration.dc).toBe(17);
    expect(sendConcentrationPrompt).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('Barbarian', 'currentHitPoints', 12, CAMPAIGN);
  });

  describe('Projected Ward recent-damage writer', () => {
    it('records projectedWardDamage on a damaged non-warden player', async () => {
      const store = stubStore({ 'HexWarlock.currentHitPoints': 73, 'HexWarlock.hitPoints': 73 });
      await applyDamage(makeCs(makeCreature('HexWarlock', { currentHp: 73 })), 'HexWarlock', 13, ['Slashing'], { attackerName: 'Wight 1' });
      expect(store.get('HexWarlock.projectedWardDamage')).toEqual(expect.objectContaining({
        rawDamage: 13, damageType: 'Slashing', attackerName: 'Wight 1',
      }));
    });

    it('does not record projectedWardDamage when the damaged player is an active warden (self-absorbed)', async () => {
      const store = stubStore({
        'DivinationWizard.currentHitPoints': 73,
        'DivinationWizard.hitPoints': 73,
        'DivinationWizard.arcaneWardActive': true,
      });
      await applyDamage(makeCs(makeCreature('DivinationWizard', { currentHp: 73 })), 'DivinationWizard', 10, ['Necrotic'], { attackerName: 'Wight 1' });
      expect(store.has('DivinationWizard.projectedWardDamage')).toBe(false);
      expect(store.get('DivinationWizard.currentHitPoints')).toBe(63); // damage flow continued past the guard
    });

    it('does not record projectedWardDamage for zero damage', async () => {
      const store = stubStore({ 'HexWarlock.currentHitPoints': 73, 'HexWarlock.hitPoints': 73 });
      await applyDamage(makeCs(makeCreature('HexWarlock', { currentHp: 73 })), 'HexWarlock', 0, ['Slashing'], { attackerName: 'Wight 1' });
      expect(store.has('HexWarlock.projectedWardDamage')).toBe(false);
    });

    it('accumulates multi-part damage from the same attacker sequence', async () => {
      const store = stubStore({ 'HexWarlock.currentHitPoints': 73, 'HexWarlock.hitPoints': 73 });
      const cs = makeCs(makeCreature('HexWarlock', { currentHp: 73 }));
      await applyDamage(cs, 'HexWarlock', 7, ['Slashing'], { attackerName: 'Wight 1' });
      await applyDamage(cs, 'HexWarlock', 6, ['Necrotic'], { attackerName: 'Wight 1' });
      expect(store.get('HexWarlock.projectedWardDamage').rawDamage).toBe(13);
      expect(store.get('HexWarlock.currentHitPoints')).toBe(60);
    });

    it('does not record projectedWardDamage on monster targets', async () => {
      const store = stubStore();
      const wight = makeMonster('Wight 1', { maxHp: 55, currentHp: 55 });
      await applyDamage(makeCs(wight), 'Wight 1', 12, ['Slashing'], { attackerName: 'HexWarlock' });
      expect(store.has('Wight 1.projectedWardDamage')).toBe(false);
      expect(wight.currentHp).toBe(43);
    });
  });
});
