// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Lane: spellResolution.js LOG face — logGenericSpellCast           */
/*                                                                      */
/*  Module-alive (exporter -> importer):                              */
/*   - getActiveBuffs re-export (:216)  -> blockChecks.js:27 dynamic */
/*     import (LIVE; blockChecks pair re-run on every change here)  */
/*   - logGenericSpellCast (:191)       -> NO production importer.  */
/*     LIVE twin is index.js:225 (called :698); entry body is        */
/*     byte-identical except the console prefix: this mirror logs    */
/*     '[spellResolution:log-error]', index logs '[index:log-error]' */
/*     and adds 2 extra early-returns (_deferChooserSlotPayment,     */
/*     _shapechangeFormChange) the mirror lacks. Header :11-14        */
/*     self-declares 'this mirror stays byte-shape for CLA-391'.    */
/*   - resolveSpellResolution (:216)    -> tests-only runners        */
/*     spellResolution.test.js / spellResolution.complex.test.js     */
/*   - isInnateSorceryActive re-export  -> dead (no importer reads it */
/*     from here; consumers import buffService directly). REPORTED.  */
/*  This file is the ONLY direct runner of the mirror's log bytes —  */
/*  kept as cannot-regress pin per CLA-391 byte-shape mandate.       */
/* ------------------------------------------------------------------ */

/* Mocks: full import surface of spellResolution.js (:1-9), line-by-
   line complete. Only logService.addEntry is behaviorally coupled to
   logGenericSpellCast; the rest is import-graph isolation for the
   untested resolve-face. castingTimeUtils (:9) stays REAL — pure
   string util, untouched by logGenericSpellCast, no side effects. */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_playerName, _key, _campaignName) => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/class-warlock/psychicSpellsHandler.js', () => ({
  getPsychicSpellsConfig: vi.fn(() => null),
}));

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => null),
}));

import { logGenericSpellCast } from './spellResolution.js';
import { addEntry } from '../../../../ui/logService.js';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

const CAMPAIGN = 'test-campaign';

/* REAL disk rows (load-existence-census: throws on drift). */
function diskRow(rows, name, file) {
  const row = rows.find(s => s.name === name);
  if (!row) throw new Error(`disk drift: '${name}' missing from ${file}`);
  return row;
}
const fireball5e = diskRow(spells5e, 'Fireball', 'public/data/spells.json');
const fireball2024 = diskRow(spells2024, 'Fireball', 'public/data/2024/spells.json');
const hex2024 = diskRow(spells2024, 'Hex', 'public/data/2024/spells.json');

/* Caller boundary: logGenericSpellCast reads ONLY playerStats.name. */
const caster = { name: 'TestWizard' };

/* The 12-key static key-set of the log entry (cannot-regress: a
   rename/add/remove breaks Object.keys; undefined-valued keys stay
   present pre-stringify, dropped by JSON.stringify downstream). */
const ENTRY_KEYS = ['type', 'characterName', 'targetName', 'spellName', 'spellLevel',
  'castingTime', 'damageType', 'damageFormula', 'saveDC', 'concentration',
  'description', 'timestamp'];

/* Exact campaign + all entries logged so far, entry pulled past its
   legitimate Date.now() log-stamp (stamp-only, no clock arithmetic). */
function loggedBodies(expectedCalls) {
  expect(addEntry).toHaveBeenCalledTimes(expectedCalls);
  return addEntry.mock.calls.map(([campaign, entry], i) => {
    expect(campaign).toBe(CAMPAIGN);
    expect(addEntry.mock.calls[i]).toHaveLength(2); // arity vs real
    expect(Object.keys(entry)).toEqual(ENTRY_KEYS);  // exact key-set + order
    expect(typeof entry.timestamp).toBe('number');
    expect(Number.isFinite(entry.timestamp)).toBe(true);
    // log-stamp-only Date.now() (legit per no-clock policy); body pinned without it
    // eslint-disable-next-line no-unused-vars
    const { timestamp, ...body } = entry;
    return body;
  });
}

describe('logGenericSpellCast — spellResolution.js mirror log bytes (live twin: index.js:225)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs one full 5e Fireball entry: exact 12-key shape, dc-present saveDC pass-through, join-identity description, fresh object per call', async () => {
    expect(logGenericSpellCast).toHaveLength(1); // one destructured options object (proven arity vs real source :191)
    const target = { name: 'Goblin' }; // synthetic combat token, non-impersonating

    const result = logGenericSpellCast({
      spell: fireball5e, playerStats: caster, campaignName: CAMPAIGN,
      getTargetInfo: async () => target, fullSpell: fireball5e,
      damageType: 'Fire', formula: '8d6', spellSaveDc: 17,
    });
    expect(result).toBeInstanceOf(Promise);
    await result;

    const [body] = loggedBodies(1);
    expect(body).toStrictEqual({
      type: 'spell',
      characterName: 'TestWizard',
      targetName: 'Goblin',
      spellName: 'Fireball',
      spellLevel: 3,
      castingTime: '1 action',
      damageType: 'Fire',
      damageFormula: '8d6',
      saveDC: 17, // dc present on disk row ({dc_type:'DEX',dc_success:'half'}) -> passed DC verbatim
      concentration: false,
      description: fireball5e.description.join(' '), // format contract: join, never rewrite disk text
    });

    // purity: second cast gets a fresh entry object, same stable body
    await logGenericSpellCast({
      spell: fireball5e, playerStats: caster, campaignName: CAMPAIGN,
      getTargetInfo: async () => target, fullSpell: fireball5e,
      damageType: 'Fire', formula: '8d6', spellSaveDc: 17,
    });
    const bodies = loggedBodies(2);
    expect(bodies[1]).not.toBe(bodies[0]);
    expect(bodies[1]).toEqual(bodies[0]);
  });

  it('logs a real 2024 Fireball byte-faithfully: casting_time trail is 2024 raw "Action" (not normalized "1 action")', async () => {
    await logGenericSpellCast({
      spell: fireball2024, playerStats: caster, campaignName: CAMPAIGN,
      getTargetInfo: async () => ({ name: 'Goblin' }), fullSpell: fireball2024,
      damageType: 'Fire', formula: '8d6', spellSaveDc: 16,
    });

    const [body] = loggedBodies(1);
    expect(body).toStrictEqual({
      type: 'spell',
      characterName: 'TestWizard',
      targetName: 'Goblin',
      spellName: 'Fireball',
      spellLevel: 3,
      castingTime: 'Action', // raw disk bytes pass through — normalizeCastingTime never touches this face
      damageType: 'Fire',
      damageFormula: '8d6',
      saveDC: 16,
      concentration: false,
      description: fireball2024.description.join(' '),
    });
  });

  it('normalizes falsy/missing inputs to null and carries undefined-valued keys; joins multi-part description with single spaces', async () => {
    // synthetic partial record (name only) + synthetic 3-part description:
    // no disk row is name-only or multi-part (census: all 724 rows have
    // 1-element arrays), so the join delimiter can only be pinned here.
    const spell = { name: 'Mystery Bolt' };
    const fullSpell = { description: ['First part', 'Second part', 'third.'] };

    for (const resolved of [null, undefined, {}, { name: '' }]) { // falsy-target quadruple ('' kills ??-null mutants)
      await logGenericSpellCast({
        spell, playerStats: caster, campaignName: CAMPAIGN,
        getTargetInfo: async () => resolved, fullSpell,
        damageType: '', formula: null, spellSaveDc: 15,
      });
    }

    const bodies = loggedBodies(4);
    for (const body of bodies) {
      expect(body).toStrictEqual({
        type: 'spell',
        characterName: 'TestWizard',
        targetName: null, // resolvedTarget?.name || null — one arm for the whole quadruple
        spellName: 'Mystery Bolt',
        spellLevel: 0, // spell.level || 0
        castingTime: undefined, // key PRESENT with undefined value (dropped only by JSON.stringify)
        damageType: null,
        damageFormula: null,
        saveDC: null, // spell.dc falsy -> passed spellSaveDc is IGNORED
        concentration: false, // !!undefined
        description: 'First part Second part third.',
      });
    }
  });

  it('short-circuits exactly-case "Hex" (real 2024 disk row) without touching getTargetInfo; lowercase "hex" logs — guard is byte-exact', async () => {
    const getTargetInfo = vi.fn(async () => ({ name: 'Goblin' }));

    const result = logGenericSpellCast({
      spell: hex2024, playerStats: caster, campaignName: CAMPAIGN,
      getTargetInfo, fullSpell: hex2024, damageType: 'Necrotic',
      formula: '1d6', spellSaveDc: 0,
    });
    expect(result).toBeInstanceOf(Promise);
    await result;
    expect(getTargetInfo).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();

    // case-variance pin: guard is spell.name !== 'Hex' (case-sensitive)
    await logGenericSpellCast({
      spell: { ...hex2024, name: 'hex' }, playerStats: caster, campaignName: CAMPAIGN,
      getTargetInfo, fullSpell: hex2024, damageType: 'Necrotic',
      formula: '1d6', spellSaveDc: 0,
    });
    const [body] = loggedBodies(1);
    expect(body).toStrictEqual({
      type: 'spell',
      characterName: 'TestWizard',
      targetName: 'Goblin',
      spellName: 'hex',
      spellLevel: 1,
      castingTime: 'Bonus Action', // 2024 disk bytes
      damageType: 'Necrotic',
      damageFormula: '1d6',
      saveDC: null, // Hex has no dc on disk — spellSaveDc 0 dropped regardless
      concentration: true, // !!true coercion
      description: hex2024.description.join(' '),
    });
  });

  it('swallows addEntry rejection: cast resolves and console.error carries the exact mirror-only prefix tuple "[spellResolution:log-error]" + the error', async () => {
    const err = new Error('log-service-down');
    addEntry.mockRejectedValueOnce(err); // consumed by this single call
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(logGenericSpellCast({
        spell: fireball5e, playerStats: caster, campaignName: CAMPAIGN,
        getTargetInfo: async () => ({ name: 'Goblin' }), fullSpell: fireball5e,
        damageType: 'Fire', formula: '8d6', spellSaveDc: 17,
      })).resolves.toBeUndefined(); // rejection must never surface to the caster
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('[spellResolution:log-error]', err); // exact tuple; live twin's prefix is '[index:log-error]'
    } finally {
      spy.mockRestore();
    }
  });
});

/* Quirk census (documented, asserted above):
   - implicit-undefined vs explicit-null: castingTime survives as an
     undefined-valued key (#1488-class); damageType '' -> null.
   - ?. silent undefined (#1480-class): resolvedTarget?.name arm collapses
     null/undefined/no-name/''-name to one behavior — pinned by the quadruple.
   - dead arms for disk shapes: multi-part description join (0 disk rows)
     and name-only spells (0 disk rows) — pinned via labeled synthetic.
   - NO-CLOCK compliant: only Date.now() log-stamp, no expiry math. */
