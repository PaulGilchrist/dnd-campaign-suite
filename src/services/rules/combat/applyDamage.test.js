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
// Honest note (#1185 FIXED): applyDamage.js:451 now passes campaignName like
// siblings :432/:443/:753 (consistency only — getRuntimeValue is arity-2,
// useRuntimeState.js:63, the 3rd arg is structurally discarded store-wide;
// true campaign isolation is deferred infra #1520). Parity-by-code-review;
// arg-shape pinned in applyDamage.auraWarding.test.js T1b.
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
import { rollD20 } from '../../dice/diceRoller.js';

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

  // DAMAGE-LANE ADMISSION LAW (#1229 fix#113-upstream, owner lane): applyDamage.js:973+
  // admits NON-NEGATIVE FINITE NUMBERS ONLY, loud-refuse shape mirrors
  // wardingBondService.js:36-43. PRE-FIX captures (live probe, pre-fix bytes
  // !isNaN(x) && x != null): monster -10 RAISED HP 30->40, player -10 RAISED
  // store 25->35, hp_change log rode delta:+10 isHealing:false; '5' returned
  // finalDamage:'5' (string) and leaked into campaign lastAttack.actualDamage
  // concatenated ('-1057' captured); Infinity admitted, instant-killed (30->0).
  describe('rawDamage admission gate (finite non-negative numbers only)', () => {
    it('-10 REFUSES LOUD: null result, HP never raised, zero writes, zero log (both lanes)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const orc = makeMonster('Orc', { currentHp: 30 });
        expect(await applyDamage(makeCs(orc), 'Orc', -10, ['Slashing'])).toBeNull();
        expect(orc.currentHp).toBe(30);

        const al = makeCreature('Alchemist', { currentHp: 25 });
        const store = stubStore({ 'Alchemist.currentHitPoints': 25, 'Alchemist.hitPoints': 25 });
        expect(await applyDamage(makeCs(al), 'Alchemist', -10, ['Slashing'])).toBeNull();
        expect(store.get('Alchemist.currentHitPoints')).toBe(25);

        expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('negative damage is not damage'));
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        errSpy.mockRestore();
      }
    });

    it('numeric string "5" REFUSES LOUD (census: no legit string wire at this seam): null, zero writes', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const orc = makeMonster('Orc', { currentHp: 30 });
        expect(await applyDamage(makeCs(orc), 'Orc', '5', ['Bludgeoning'])).toBeNull();
        expect(orc.currentHp).toBe(30);
        expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('finite numbers only'));
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        errSpy.mockRestore();
      }
    });

    it('garbage REFUSES LOUD (#1348): NaN/null/undefined/Infinity/-Infinity/object/array — null, zero writes', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const cs = makeCs(makeMonster('Orc', { currentHp: 30 }));
        for (const garbage of [NaN, null, undefined, Infinity, -Infinity, {}, [], true]) {
          expect(await applyDamage(cs, 'Orc', garbage, ['Slashing'])).toBeNull();
        }
        expect(cs.creatures[0].currentHp).toBe(30);
        expect(errSpy).toHaveBeenCalledTimes(8);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        errSpy.mockRestore();
      }
    });

    it('positive numbers and the zero/-0 contract stay admitted verbatim (MA-1400 zero-damage riders)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const orc = makeMonster('Orc', { currentHp: 30 });
        const hit = await applyDamage(makeCs(orc), 'Orc', 8, ['Slashing']);
        expect(hit).toMatchObject({ finalDamage: 8, oldHp: 30, newHp: 22 });

        const zero = await applyDamage(makeCs(orc), 'Orc', 0, ['Slashing']);
        expect(zero).not.toBeNull();
        expect(zero.finalDamage).toBe(0);
        expect(orc.currentHp).toBe(22);

        const negZero = await applyDamage(makeCs(orc), 'Orc', -0, ['Slashing']);
        expect(negZero).not.toBeNull();
        expect(orc.currentHp).toBe(22);

        expect(errSpy).not.toHaveBeenCalled();
      } finally {
        errSpy.mockRestore();
      }
    });

    it('target HP NEVER increases through the damage lane — every hostile arm lands at-or-below oldHp', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const al = makeCreature('Alchemist', { currentHp: 25 });
        const store = stubStore({ 'Alchemist.currentHitPoints': 25, 'Alchemist.hitPoints': 25 });
        for (const raw of [10, '5', -10, '-10', NaN, Infinity, null]) {
          const before = store.get('Alchemist.currentHitPoints');
          const r = await applyDamage(makeCs(al), 'Alchemist', raw, ['Slashing']);
          const after = store.get('Alchemist.currentHitPoints');
          expect(after).toBeLessThanOrEqual(before);
          if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) expect(r).not.toBeNull();
          else expect(r).toBeNull();
        }
        expect(store.get('Alchemist.currentHitPoints')).toBe(15);
      } finally {
        errSpy.mockRestore();
      }
    });
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
    // Single-condition arms only here — the frightened+charmed COEXIST arm (former
    // #1207 resurrect defect, FIXED by the fix#27 §39 merged write at
    // removeCombatConditionsOnDamage) is pinned in its own it() below.
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

  it('#1207 coexist: one hit breaking frightened AND charmed lands ONE merged write — neither condition resurrects', async () => {
    // fix#27 §39 canon (mirrors useInitiativeEffects.js:178-184 / concentrationService.js:221-227):
    // both removals accumulate off the SINGLE :558 snapshot into ONE activeConditions write.
    // Pre-fix bytes: the frightened-write put ['charmed','poisoned'] down, then the charmed-write
    // re-filtered the SAME stale snapshot and wrote ['Frightened','poisoned'] last — resurrecting
    // Frightened (last-writer-wins on stale base, found live by falsifier, was commented not pinned).
    // #1348 distinguishable fixture: fresh name/bytes vs sibling arms (Ranger/Wolf/Bard/Frosty).
    vi.clearAllMocks();
    const ghast = makeMonster('Ghast', { maxHp: 26, currentHp: 26 });
    const store = stubStore({
      'Ghast.currentHitPoints': 26,
      'Ghast.hitPoints': 26,
      'Ghast.activeConditions': ['Frightened', 'charmed', 'poisoned'],
    });

    await applyDamage(makeCs(ghast), 'Ghast', 7, ['Slashing']);

    // Exactly ONE condition-array write, fully filtered by both keys — byte-exact tuple.
    const conditionWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
    expect(conditionWrites).toEqual([['Ghast', 'activeConditions', ['poisoned'], CAMPAIGN]]);
    // Read-your-write parity on the Map-backed stub (#1517-faithful): final store byte
    // contains NEITHER broken condition — no resurrection.
    expect(store.get('Ghast.activeConditions')).toEqual(['poisoned']);
    expect(store.get('Ghast.activeConditions')).not.toContain('Frightened');
    expect(store.get('Ghast.activeConditions')).not.toContain('charmed');
    // Per-condition removal logs stay SEPARATE facts (per-condition keys, honest split),
    // in the source's frightened-then-charmed decision order.
    const logs = conditionLogs();
    expect(logs).toEqual([
      expect.objectContaining({ type: 'condition', action: 'removed', characterName: 'Ghast', condition: 'Frightened', reason: 'took damage' }),
      expect.objectContaining({ type: 'condition', action: 'removed', characterName: 'Ghast', condition: 'Charmed', reason: 'took damage (Charm)' }),
    ]);
  });

  it('#1207 dominated coexist: frightened strips (charmed arm guarded off) — single write, charmed retained', async () => {
    // The !domination guard (:560) is UNTOUCHED by the merge: a dominated target takes
    // the repeat-save lane for its charm (SP-037), but damage still ends Frightened
    // unconditionally (:547). The merged write must carry the frighten strip ALONE —
    // 'charmed' survives verbatim in the written bytes.
    vi.clearAllMocks();
    const domina = makeCreature('Domina', { concentration: { id: 'c1', spell: 'Dominate Person', dc: null } });
    const crawler = makeMonster('Crawler', { maxHp: 22, currentHp: 22 });
    const store = stubStore({
      'Crawler.currentHitPoints': 22,
      'Crawler.activeConditions': ['frightened', 'charmed'],
      'Domina.pendingExpirations': [{ target: 'Crawler', effects: [{ type: 'dominated' }] }],
    });
    rollD20.mockReturnValue(2); // repeat WIS save vs DC 17 fails — domination latches

    await applyDamage({ round: 1, creatures: [domina, crawler] }, 'Crawler', 4, ['Bludgeoning'], {
      characters: [makeCharacter('Crawler'), { name: 'Domina', computedStats: { spellAbilities: { saveDc: 17 } } }],
    });

    const conditionWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
    expect(conditionWrites).toEqual([['Crawler', 'activeConditions', ['charmed'], CAMPAIGN]]);
    expect(store.get('Crawler.activeConditions')).toEqual(['charmed']);
    expect(conditionLogs().map(b => [b.condition, b.action])).toEqual([['Frightened', 'removed']]);
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
