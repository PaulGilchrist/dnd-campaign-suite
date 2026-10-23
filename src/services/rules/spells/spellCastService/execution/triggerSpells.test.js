// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  Gate-mechanics lane for handleGenericAutomation (triggerSpells.js */
/*  :453-:469), called DIRECT — REAL module, zero vi.mock (#1475      */
/*  direct-path audit: the hub barrel ./index.js is never imported    */
/*  here; ./triggerSpells.js is the real file). Base roster per       */
/*  #1507 split: gate declines + effects arms + SERVICE_HANDLED       */
/*  exclusion + :462 arity-5 dispatch census + result-shaping         */
/*  three-state live HERE; metaCtx :460 fold internals stay           */
/*  triggerSpells.metaCtx.test.js (#1507); hub-side joins, caller-   */
/*  side purity and automation/name identity stay earlyReturns-      */
/*  generic (#1470, :385-:389 tuple pins via index.js:710).           */
/*                                                                     */
/*  Gate truth table (:455, arm -> name -> verdict), reconciled vs   */
/*  family census 44 consumed (5e) + 78 (2024) (#1470) and the        */
/*  hijack tables #1463/#1473/#1483/#1484 — no contradiction:          */
/*   automation ABSENT     -> compulsion (disk, both rulesets: NO    */
/*                            automation bytes — cited by                */
/*                            compulsionHandler.test.js:14)   DECLINE   */
/*   automation falsy      -> null / {} / undefined        DECLINE     */
/*                            (synthetic probes, disk-absent shapes     */
/*                            quantified below)                          */
/*   type falsy            -> '' / 0 / false / null / absent DECLINE  */
/*   effects.fail truthy  -> Color Spray (disk BOTH rulesets, real    */
/*                            row: type save_only + effects.fail) DECL  */
/*   effects.success      -> DECLINE arm is a DEAD TWIN on disk:      */
/*                            census pins 0 rows with automation        */
/*                            .effects.success in BOTH files (5e 331 /  */
/*                            2024 393 rows) — guarded synthetically    */
/*                            against future disk bytes (#1472 arm       */
/*                            class; early-chain-caught names never      */
/*                            reach this gate — earlyReturns :275        */
/*                            reachability census, cited not re-grown). */
/*   SERVICE_HANDLED      -> ALL 18 members REAL-imported set (:42-   */
/*                            :57, never retyped, #1473 canon) DECLINE; */
/*                            disk-truth map re-verified #1472/#1483    */
/*                            close (2026-10-23): otto's/otiluke's/     */
/*                            crown/tasha's/hex = 2024-only presence,   */
/*                            irresistible dance/resilient sphere/      */
/*                            hideous laughter = 5e-only, rest BOTH —   */
/*                            zero members match no disk row at all, so */
/*                            NO typo'd dead rows; shields over the 4   */
/*                            ottos_dance/resilient_sphere disk rows are */
/*                           LIVE shields, every other member is an     */
/*                            inert forward guard vs future disk        */
/*                            automation (its chain arm owns the cast). */
/*   everything else      -> dispatch (:462), CONSUME.                 */
/*   falsy-collapse        -> effects:{fail:''}/0/null and success     */
/*                            falsy PASS — the :455 arms test           */
/*                            TRUTHINESS, not key presence (#1352      */
/*                            falsy triples are this lane's bread).     */
/*   name fold (:454)     -> absent / null name collapses to '' (not */
/*                            in set) -> PASS with action.name carried  */
/*                            implicitly undefined, key set intact      */
/*                            (#1499 implicit-undefined key-carry).     */
/*   0-lowercase trail     -> :454 toLowerCase catches disk TitleCase */
/*                            spell names (#1489 census idiom: every    */
/*                            disk row here is TitleCase vs lowercase    */
/*                            set members).                              */
/*                                                                     */
/*  :462 arity-5 census OWNED here direct: (action, playerStats,      */
/*  campaignName, mapName, characters) — call length pinned 5 incl.    */
/*  undefined trailing args; hub-entry twin = #1470 :385-:389.         */
/*  Result shaping three-state: truthy -> {handled:true, result:{      */
/*  automationPopup:<verbatim identity>}} (:464); falsy [null,          */
/*  undefined, false, 0, ''] -> bare {handled:true} (:466) — the      */
/*  :0-swallow quantified: '0' and '' payloads evaporate at :463.     */
/*  Decline envelope bytes: {handled:false} exactly, never undefined   */
/*  (toStrictEqual + key-set census, #1470 three-state form).          */
/*                                                                     */
/*  Fixtures: REAL disk rows BOTH rulesets, existence-census-first    */
/*  load-drift-throw (#1503/#1504/#1507 — impersonation caught there, */
/*  so names are looked up, never hand-shaped). Synthetic gate probes  */
/*  use 'Synthetic Gateprobe' — non-impersonating, matches no disk     */
/*  name (#1492); fabrication-ban: zero canned automation attached to  */
/*  real disk rows; blade ward provenance lives on 2024 disk as type   */
/*  'blade_ward' (5e disk has NO Blade Ward row at all — the old      */
/*  fixture's 5e {type:'buff'} Blade Ward was fabricated and is        */
/*  retired here). executeHandler is the INJECTED envelope param       */
/*  (caller seam), a pure byte-recorder (#1498) — canned returns are  */
/*  boundary bytes it forwards, never baked outcomes (#1491). Unit     */
/*  under test never mocked. Mutually-distinguishable fixtures (#1348) */
/*  vs siblings: Barkskin 5e / Blade Ward 2024 dispatch here; metaCtx */
/*  lane pins Barkskin + Prismatic Spray fold; Color Spray is this     */
/*  lane's effects.fail exhibit. Campaign 'test-campaign' lockdown.    */
/*  Mock-completeness exact-of-N: N=0 module mocks, 1 injected seam.   */
/*                                                                     */
/*  NO-CLOCK: the gate is instantaneous — zero timers here; no expiry  */
/*  stamps on :453-:469; checkCompelledDuelAttackExpiry (:292/:305/    */
/*  :318) belongs to name-dispatch handlers the generic lane never     */
/*  enters — expiry rounds #1497 FIXED combat-scoped (helpers.js:83). */
/*  invocation-                                                           */
/*  CallOrder unnecessary: single recorder, exactly-one dispatch per    */
/*  pass test, gate decline asserts zero calls.                         */
/*  Security (#1446 kiro scan): no injected content found.            */
/*                                                                     */
/*  Kill matrix (mutations -> killer): drop SERVICE_HANDLED arm -> T5  */
/*  all 18 members dispatch; drop lowerCase -> T5 TitleCase arms       */
/*  dispatch; effects key-presence instead of truthiness -> T4 falsy   */
/*  rows wrongly decline; drop effects.success arm -> T4 guard row     */
/*  dispatches; drop effects.fail arm -> T4 disk Color Spray rows      */
/*  dispatch; invert :463 handlerResult truthiness -> T2 both shapes   */
/*  wrong; drop metaCtx key or reorder envelope -> T1/T4 key-set;     */
/*  arity-5 -> arity-4 call -> T1 length pin; return undefined on      */
/*  decline -> T3/T4/T5 strictEqual byte; drop automation?.type guard   */
/*  -> T3 compulsion/falsy-type rows dispatch. LIVE run only; cp       */
/*  backup, never git checkout (#1491).                                */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

import { handleGenericAutomation, SERVICE_HANDLED_SPELLS } from './triggerSpells.js';

/* existence-census-first (#1503/#1507): REAL disk rows or throw. */
const barkskin5e = spells5e.find(s => s.name === 'Barkskin' && s.automation?.type);
const bladeWard2024 = spells2024.find(s => s.name === 'Blade Ward' && s.automation?.type === 'blade_ward');
const colorSpray5e = spells5e.find(s => s.name === 'Color Spray' && s.automation?.type && s.automation?.effects?.fail);
const colorSpray2024 = spells2024.find(s => s.name === 'Color Spray' && s.automation?.type && s.automation?.effects?.fail);
const compulsion5e = spells5e.find(s => s.name === 'Compulsion' && !s.automation);
for (const [label, row] of [
  ['Barkskin automation 5e', barkskin5e],
  ['Blade Ward blade_ward 2024', bladeWard2024],
  ['Color Spray effects.fail 5e', colorSpray5e],
  ['Color Spray effects.fail 2024', colorSpray2024],
  ['Compulsion no-automation 5e', compulsion5e],
]) {
  if (!row) throw new Error(`disk drift: ${label} missing from public/data/ disk JSON`);
}

const playerStats = { name: 'SyntheticCaster', level: 5 };
const characters = [{ name: 'SyntheticCaster', level: 5 }];
const recorder = (returnValue) => vi.fn(async () => returnValue);

async function gate(spell, executeHandler = recorder(null)) {
  const result = await handleGenericAutomation({
    spell, executeHandler, playerStats,
    campaignName: 'test-campaign', mapName: 'test-map', characters,
  });
  return { result, executeHandler };
}

describe('handleGenericAutomation — :455 gate truth table + :462 arity (direct lane)', () => {

  it('consumes REAL gate-passing disk rows from BOTH rulesets via the exact arity-5 :462 tuple with 4-key envelope', async () => {
    for (const row of [barkskin5e, bladeWard2024]) {
      const executeHandler = recorder(null);
      const before = cloneDeep(row);

      const result = await handleGenericAutomation({
        spell: row, executeHandler, playerStats,
        campaignName: 'test-campaign', mapName: 'test-map', characters,
      });

      expect(executeHandler, row.name).toHaveBeenCalledTimes(1);
      const call = executeHandler.mock.calls[0];
      // :462 arity census (direct owner): exactly five positional args.
      expect(call, `${row.name} tuple arity`).toHaveLength(5);
      expect(Object.keys(call[0]).join('|'), `${row.name} envelope key census`).toBe('name|spell|automation|metaCtx');
      expect(call[0].name).toBe(row.name);
      expect(call[0].automation).toEqual(row.automation);
      expect(call[1]).toBe(playerStats);
      expect(call[2]).toBe('test-campaign');
      expect(call[3]).toBe('test-map');
      expect(call[4]).toBe(characters);
      expect(result).toStrictEqual({ handled: true });
      // purity: gate reads disk rows, never mutates them.
      expect(row).toStrictEqual(before);
    }
  });

  it('shapes handler return three-state: truthy wrapped verbatim under automationPopup (:464 identity), falsy triple collapses to bare {handled:true} (:466 :0-swallow)', async () => {
    // truthy leg (:464): verbatim identity, fresh outer envelopes.
    const popup = { type: 'popup', payload: { text: 'boundary bytes' } };
    const { result } = await gate(barkskin5e, recorder(popup));
    expect(result).toStrictEqual({ handled: true, result: { automationPopup: popup } });
    expect(result.result.automationPopup).toBe(popup);

    // falsy collapse leg (:463 arms): every falsy payload evaporates.
    for (const swallowed of [null, undefined, false, 0, '']) {
      const { result: r, executeHandler } = await gate(barkskin5e, recorder(swallowed));
      expect(executeHandler).toHaveBeenCalledTimes(1);
      expect(r, `handler returned ${JSON.stringify(swallowed)}`).toStrictEqual({ handled: true });
      expect(Object.keys(r)).toEqual(['handled']);
    }
  });

  it('declines every structural no-automation arm with exact {handled:false} bytes and zero dispatch — disk Compulsion (cited by compulsionHandler.test.js) + quantified falsy-type probes', async () => {
    const declineRows = [
      { label: 'disk Compulsion (automation absent, disk byte)', spell: compulsion5e },
      { label: 'disk Compulsion + nameless twin', spell: { automation: undefined } },
      { label: 'synthetic automation undefined', spell: { name: 'Synthetic Gateprobe', automation: undefined } },
      { label: 'synthetic automation null', spell: { name: 'Synthetic Gateprobe', automation: null } },
      { label: 'synthetic automation {} empty', spell: { name: 'Synthetic Gateprobe', automation: {} } },
      { label: 'synthetic automation present, type key absent', spell: { name: 'Synthetic Gateprobe', automation: { range: 'Touch' } } },
      { label: "synthetic type ''", spell: { name: 'Synthetic Gateprobe', automation: { type: '' } } },
      { label: 'synthetic type 0', spell: { name: 'Synthetic Gateprobe', automation: { type: 0 } } },
      { label: 'synthetic type false', spell: { name: 'Synthetic Gateprobe', automation: { type: false } } },
      { label: 'synthetic type null', spell: { name: 'Synthetic Gateprobe', automation: { type: null } } },
    ];
    for (const { label, spell } of declineRows) {
      const { result, executeHandler } = await gate(spell);
      expect(result, label).toStrictEqual({ handled: false });
      expect(Object.keys(result), label).toEqual(['handled']);
      expect(executeHandler, `${label} must not dispatch`).not.toHaveBeenCalled();
    }
  });

  it('effects arms: disk effects.fail rows decline BOTH rulesets; effects.success DECLINE is a disk-dead twin (0 rows, guarded synthetically); falsy effects collapse to PASS (truthiness not key presence); absent/null name carries undefined onto action (:454)', async () => {
    // census first: zero automation rows with effects.success on disk — the
    // arm is unreachable for current bytes; guard guards future disk.
    const successRows = [spells5e, spells2024].flatMap(rows =>
      rows.filter(r => r.automation?.type && r.automation.effects?.success));
    expect(successRows).toEqual([]);

    for (const row of [colorSpray5e, colorSpray2024]) {
      const { result, executeHandler } = await gate(row);
      expect(result, `${row.name} effects.fail decline`).toStrictEqual({ handled: false });
      expect(executeHandler).not.toHaveBeenCalled();
    }
    // truthy effects.success declines too — disk-dead twin arm guarded here.
    const guardRow = { name: 'Synthetic Gateprobe', automation: { type: 'buff', effects: { success: 'save-fail-popup' } } };
    {
      const { result, executeHandler } = await gate(guardRow);
      expect(result, 'effects.success truthy decline (dead-twin guard)').toStrictEqual({ handled: false });
      expect(executeHandler).not.toHaveBeenCalled();
    }
    expect(guardRow.automation.effects.success).toBeTruthy();

    const passRows = [
      { label: "effects.fail '' falsy", spell: { name: 'Synthetic Gateprobe', automation: { type: 'buff', effects: { fail: '' } } } },
      { label: "effects.fail '' falsy", spell: { name: 'Synthetic Gateprobe', automation: { type: 'buff', effects: { fail: '' } } } },
      { label: 'effects.fail 0 falsy', spell: { name: 'Synthetic Gateprobe', automation: { type: 'buff', effects: { fail: 0 } } } },
      { label: 'effects.fail null falsy', spell: { name: 'Synthetic Gateprobe', automation: { type: 'buff', effects: { fail: null } } } },
      { label: 'effects.success false falsy', spell: { name: 'Synthetic Gateprobe', automation: { type: 'buff', effects: { success: false } } } },
      { label: 'effects key neither fail nor success', spell: { name: 'Synthetic Gateprobe', automation: { type: 'buff', effects: { neutral: 'x' } } } },
      { label: 'name ABSENT — implicit undefined key-carry', spell: { automation: { type: 'buff' } } },
      { label: 'name null — :454 fold to empty string', spell: { name: null, automation: { type: 'buff' } } },
    ];
    for (const { label, spell } of passRows) {
      const { result, executeHandler } = await gate(spell, recorder(null));
      expect(executeHandler, `${label} must dispatch`).toHaveBeenCalledTimes(1);
      expect(result, label).toStrictEqual({ handled: true });
      const [action] = executeHandler.mock.calls[0];
      expect(Object.keys(action).join('|'), `${label} key-set carries name even when undefined`).toBe('name|spell|automation|metaCtx');
      expect(action.name).toBe(spell.name);
    }
  });

  it('SERVICE_HANDLED census via REAL import (never retyped): all 18 members decline lowercase AND TitleCase bytes, zero dispatch; non-member control consumes', async () => {
    // byte census of triggerSpells.js:42-:66 as of 2026-10-23 disk state —
    // 17 historical members + fix#132 'regenerate' live shield (#1483).
    // if the set rotates, update the count (members are iterated live, not
    // hand-listed, so coverage never rots).
    expect(SERVICE_HANDLED_SPELLS.size).toBe(18);

    const executeHandler = recorder({ popup: 'would-be-handled' });
    for (const member of SERVICE_HANDLED_SPELLS) {
      expect(member, `set bytes must be lowercase (:454 contract)`).toBe(member.toLowerCase());
      const lower = await handleGenericAutomation({ spell: { name: member, automation: { type: 'buff' } }, executeHandler, playerStats, campaignName: 'test-campaign', mapName: 'test-map', characters });
      expect(lower, member).toStrictEqual({ handled: false });
      const titleCase = member.charAt(0).toUpperCase() + member.slice(1);
      const tc = await handleGenericAutomation({ spell: { name: titleCase, automation: { type: 'buff' } }, executeHandler, playerStats, campaignName: 'test-campaign', mapName: 'test-map', characters });
      expect(tc, titleCase).toStrictEqual({ handled: false });
    }
    expect(executeHandler, 'zero dispatch across 36 gate declines').not.toHaveBeenCalled();

    // control: gate-passing non-member still consumes exactly once.
    expect(SERVICE_HANDLED_SPELLS.has('barkskin')).toBe(false);
    const control = recorder(null);
    const { result } = await gate(barkskin5e, control);
    expect(result).toStrictEqual({ handled: true });
    expect(control).toHaveBeenCalledTimes(1);
  });

  it('disk-alignment census (#1472/#1483 closing): EVERY SERVICE_HANDLED member matches an exactly-named disk row in >=1 edition — zero dead typo rows; shield live on real disk bytes where automation rides; zero-name-fold hijacks decline and route on; Regenerate lawful-generic', async () => {
    // Per-entry name census against REAL disk bytes, both editions.
    // Pre-fix#109 the 5e disk row was 'Hideous Laughter' vs the singleton
    // "tasha's hideous laughter" literal -> inert shield (#1423). Post-fix
    // dual-literals, every member must touch disk SOMEWHERE: a member with
    // zero rows in BOTH files is a typo'd dead row (delete-or-align per
    // verdict) — this pin goes red on any future such drift.
    for (const member of SERVICE_HANDLED_SPELLS) {
      const rows5e = spells5e.filter(s => (s.name || '').toLowerCase() === member);
      const rows24 = spells2024.filter(s => (s.name || '').toLowerCase() === member);
      expect(rows5e.length + rows24.length,
        `dead registry row: "${member}" matches no disk name in either edition`).toBeGreaterThan(0);
      // fix#109 law: edition-differing names must BOTH be listed — every
      // dual pair (otto's/irresistible dance, otiluke's/resilient sphere,
      // tasha's/hideous laughter) is disk-backed in its own edition.
      if (rows5e.length) expect(rows5e.every(r => r.name), `${member} 5e disk canonical TitleCase`).toBeTruthy();
      if (rows24.length) expect(rows24.every(r => r.name), `${member} 2024 disk canonical TitleCase`).toBeTruthy();

      // Live-shield leg: on a REAL automation-carrying disk row the shield
      // must decline :710 (this is what keeps ottos_dance/resilient_sphere
      // out of the generic handler lane; complements featureTriggers :439).
      for (const row of [...rows5e, ...rows24]) {
        if (row.automation?.type && !row.automation.effects?.fail && !row.automation.effects?.success) {
          const { result, executeHandler } = await gate(row);
          expect(result, `${row.name} REAL disk row shielded at :455`).toStrictEqual({ handled: false });
          expect(executeHandler, `${row.name} never generic-dispatched`).not.toHaveBeenCalled();
        }
      }
    }

    // Regenerate verdict (#1483/:278-era, FIXED fix#132): disk rows BOTH
    // rulesets carry automation.type 'healing_start_of_turn' but
    // HANDLER_MAP registers the regenerate lane under key 'regenerate'
    // (automation/index.js:614) — the unshielded :710 dispatch resolved
    // NULL, so pre-fix every disk-byte cast was consumed-and-discarded
    // (slot paid, zero heal, zero stamps, resolveHandler->null->
    // executeHandler null->:838 merge undefined). 'regenerate' is now a
    // LIVE shield routing to the documented arm :311 -> triggerSpells
    // handleRegenerate -> helpers.applyRegenerateSpell (initial 4d8+15
    // heal + regenerateActive/regenerateSource stamps + expiration + logs).
    expect(SERVICE_HANDLED_SPELLS.has('regenerate')).toBe(true);
    const regen5e = spells5e.find(s => s.name === 'Regenerate' && s.automation?.type === 'healing_start_of_turn');
    const regen24 = spells2024.find(s => s.name === 'Regenerate' && s.automation?.type === 'healing_start_of_turn');
    for (const row of [regen5e, regen24]) {
      if (!row) throw new Error('disk drift: Regenerate healing_start_of_turn automation row missing');
      const { result, executeHandler } = await gate(row);
      expect(result, `${row.name} shielded from the drop-dead generic dispatch`).toStrictEqual({ handled: false });
      expect(executeHandler, `${row.name} never generic-dispatched (map has no healing_start_of_turn key)`).not.toHaveBeenCalled();
    }

    // Zero-name-fold hijack census closing #1472's :316-:359 arm question:
    // EVERY disk automation row whose NAME folds onto a dedicated
    // no-damage-chain spell is either registry-shielded or its automation
    // type is dispatched by the registered HANDLER_MAP (lawful-generic,
    // fix#121(c) owner law) — nothing silently mis-routes to nowhere.
    const armNames = new Set([
      'see invisibility', 'flesh to stone', 'hold monster', 'hold person', 'banishment',
      'confusion', 'maze', 'hypnotic pattern', 'slow', 'bane', 'bless', 'beacon of hope',
      'mass suggestion', 'suggestion', 'command', 'animal friendship', 'dominate beast',
      'dominate monster', 'dominate person', 'ray of enfeeblement', 'compelled duel',
      'globe of invulnerability', 'forcecage', 'stinking cloud', 'sleet storm',
      'faerie fire', 'imprisonment', 'heroism', 'holy aura', 'longstrider',
      'spare the dying', 'enhance ability', 'protection from energy',
      'protection from poison', 'resistance', 'false life', 'remove curse',
      'mass cure wounds', 'regenerate',
    ]);
    // HANDLER_MAP is module-private in automation/index.js — read its
    // registered type keys straight off the module bytes (disk-census
    // idiom; no fabricated key list).
    const automationSrc = readFileSync(join(process.cwd(), 'src/services/automation/index.js'), 'utf8');
    const mapBody = automationSrc.slice(automationSrc.indexOf('const HANDLER_MAP'));
    const handlerKeys = new Set([...mapBody.matchAll(/^[ \t]+'?([a-z_0-9]+)'?:\s/gm)].map(m => m[1]));
    for (const [tag, rows] of [['5e', spells5e], ['2024', spells2024]]) {
      for (const row of rows) {
        const lower = (row.name || '').toLowerCase();
        if (!armNames.has(lower) || !row.automation?.type) continue;
        const eff = row.automation.effects || {};
        if (eff.fail || eff.success) continue; // gate-off already: routes to chain arm
        const shielded = SERVICE_HANDLED_SPELLS.has(lower);
        const lawfulGeneric = handlerKeys.has(row.automation.type);
        expect(shielded || lawfulGeneric,
          `${tag} "${row.name}" automation.type=${row.automation.type} hijacked at :710 with NO registered handler and NO shield — silently mis-routed`).toBe(true);
        if (shielded) {
          const { result } = await gate(row);
          expect(result, `${tag} "${row.name}" shield live`).toStrictEqual({ handled: false });
        } else {
          const { result } = await gate(row);
          expect(result, `${tag} "${row.name}" lawful-generic consumption`).toStrictEqual({ handled: true });
        }
      }
    }
  });

});
