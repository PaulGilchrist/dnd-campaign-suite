// @maintained-by-ai
// ── webAreaSave QUINTET #1993 (.zone) — handle() ZONE PERSISTENCE canonical ──
// (full seam map: webAreaSaveHandler.areaSave.test.js header #1989; quintet
// closes HERE — 1990 .edgeCases / 1991 .errors / 1992 .test main / this .zone,
// plus .areaSave recurring lane). Closes SP-126: pre-fix handler never produced
// `_web_<caster>` tracking, never wrote the `web` zone te, and registered two
// racing condition expirations. All three locked here.
// THIS lane (handle() only — processWebAreaSave content lives in .areaSave):
//   • exact `_web_<caster>` tracking-store write (:171-181): whitespace→_
//     key transform, saveDc/saveType/radius/mapName pass-through — the
//     consumer processWebAreaSave reads this store every turn start via
//     expireStaleEffects Phase 5 (WIRED, .areaSave map verified 2026-10-16).
//   • web zone te stamped for EVERY target, fail AND success legs
//     (stampWebZoneEffects :54-75 runs once before saves at :189 — te is
//     area-membership, not save-outcome); 4-arg marker write
//     setRuntimeValue('campaign','targetEffects', tes, campaignName) —
//     campaignName LAST, no skipSync (skipSync belongs to setRuntimeObject
//     SSE-echo paths; handle() uses neither API — arity verified at source).
//   • ONE merged zone expiration at 600 rounds (:197-202) and ONE Restrained
//     condition expiration per failed target (:118-120) — canonical homes of
//     the old weak main-lane pins (main header SHED list).
//   • registry 'web' definition (targetEffectDefinitions.js:1180 — re-verified
//     2026-10-16). Cross-pin: handler :186-188 console.error guard is
//     UNREACHABLE while this definition exists (.errors lane header:17-19
//     'no test written' — this test is the existence pin it points at).
// ⚠️ POLICY VIOLATION #1906 family — pinned as-shipped, NOT sanitized:
//   parseWebDurationRounds :77-86 encodes '1 hour' → 600 via RETIRED
//   hours×600 recipe; addExpiration (expirationQueue.js:16-31, imported via
//   expirations.js barrel) stores expiryRounds:600 with NO until:'combat'
//   flag and expirationQueue.js:47-49 CONSUMES it as a live round countdown
//   (expired when currentRound >= appliedRound + expiryRounds). AGENTS.md
//   no-timers mandate: ≥1-minute durations are combat-scoped — cleared at
//   new-initiative/short-rest/long-rest seams — NEVER round countdowns;
//   concentration stays concentration. Web joins the shapechange #1954 /
//   wardingBond 600-round live-countdown family (polymorphService #1937
//   sibling latches Infinity instead — compliant). Fix belongs to the
//   expiration-lane owner; these pins fail loudly when prod is fixed.
//   Timestamp contrast (stinkingCloud #1974 precedent): the tracking-store
//   `timestamp: Date.now()` :179 and log-row timestamp :129 are
//   write-metadata / log rows, not game clocks — nothing reads them to
//   advance state — excluded from pins, not defects.
// SHED to closed siblings (verified present at new homes 2026-10-16):
//   • Restrained fail-leg apply + ability_use/save_result/condition cast-row
//     logs + mixed-target orchestration → #1992 .test main (:286-338 exact
//     activeConditions/activeConditionMeta writes, log composition order,
//     :343 multi-target full-string summary). The former zone :134
//     'applies Restrained on the failed DEX leg only and logs...' test is
//     removed as a duplicate of main :251/:286/:307/:359.
//   • guards/fallback DCs → #1990 .edgeCases; [web] addEntry rejections →
//     #1991 .errors; recurring STR re-forces → #1989 .areaSave.
// Liveness (verified at source 2026-10-16): automation/index.js:271 import,
//   :557 web_area_save → handle dispatch.
// No timers in lane or subject (guard:no-timers allowlist carries zero
//   webAreaSave entries — none needed): saves resolve via captured
//   createSaveListener promises; addExpiration/addConcentration/
//   spellNoticePopup/resolveSelectedSpellTargets run UNMOCKED (popup is a
//   pure object return; areaSpellUtils concentration write goes through the
//   mocked concentrationService + storage).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

import { handle } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import { getEffectDefinition } from '../../../combat/conditions/targetEffectDefinitions.js';

const KEY = 'pendingExpirations'; // turnStartEffects.js:17, exported :639
const campaignName = 'test-campaign';
// Exact-key pin: consumer reads `_web_<caster>` — whitespace→underscore
// transform at webAreaSaveHandler.js:171/:311 (sleetStorm `_sleetStorm_<c>`
// SP-108 pattern).
const TRACKING_KEY = '_web_TestCaster';

function makePlayerStats(name = 'TestCaster') {
  return { name, level: 20, proficiency: 6, spellAbilities: { saveDc: 19 } };
}

function makeAction(automation = {}) {
  return {
    name: 'Web',
    spell: { name: 'Web', level: 2, duration: 'Concentration, up to 1 hour' },
    automation: { type: 'web_area_save', saveType: 'DEX', saveDc: 19, ...automation },
    metaCtx: { targets: ['Zombie 1', 'Thug 1'] },
  };
}

const cs = {
  creatures: [
    { name: 'TestCaster', type: 'player' },
    { name: 'Zombie 1', type: 'monster' },
    { name: 'Thug 1', type: 'monster' },
  ],
};

// true-target fails, others succeed; default: every save fails.
function stubFailingDex(listenerIndexFail = () => true) {
  savePrompt.createSaveListener.mockImplementation((_campaign, cfg) => ({
    promptId: `p-${cfg.targetName}`,
    promise: Promise.resolve(
      listenerIndexFail(cfg.targetName)
        ? { success: false, roll: 5, total: 3 }
        : { success: true, roll: 14, total: 14 }
    ),
  }));
}

const keyWrites = () =>
  useRuntimeState.setRuntimeValue.mock.calls
    .filter(c => c[0] === 'TestCaster' && c[1] === KEY)
    .map(c => c[2]);

describe('webAreaSaveHandler.handle — SP-126 zone persistence (#1993)', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // preserves factory mockReturnValue(1) above
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    savePrompt.buildSaveDc.mockReturnValue(19);
    combatData.getCombatSummary.mockReturnValue({});
    stubFailingDex();
  });

  it('produces the _web_<caster> zone tracking key', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    // 4-arg arity, campaignName last. timestamp (:179) is write-metadata,
    // not a game clock — excluded (#1974 stinkingCloud precedent). mapName
    // is pass-through of handle's 4th arg (:174) — cast lane never calls
    // isWithinRange; the recurring lane consumes it (.areaSave).
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCaster',
      TRACKING_KEY,
      expect.objectContaining({
        caster: 'TestCaster',
        saveDc: 19,
        saveType: 'DEX',
        radius: 20, // 20-foot cube (:178)
        mapName: null,
        campaignName,
        duration: 'Concentration, up to 1 hour',
      }),
      campaignName,
    );
  });

  it('whitespace caster names key the tracking store as _web_<under_scored>', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Fred Flint', type: 'player' },
        { name: 'Zombie 1', type: 'monster' },
      ],
    });

    await handle(
      { ...makeAction(), metaCtx: { targets: ['Zombie 1'] } },
      makePlayerStats('Fred Flint'),
      campaignName,
      null,
    );

    // Regex transform :171 — consumer re-derives the identical key at :311.
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Fred Flint',
      '_web_Fred_Flint',
      expect.objectContaining({ caster: 'Fred Flint' }),
      campaignName,
    );
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Fred Flint',
      '_web_Fred Flint',
      expect.anything(),
      campaignName,
    );
  });

  it('writes the web zone te for EVERY target in the area (fail and success legs)', async () => {
    stubFailingDex(target => target === 'Zombie 1'); // mixed outcomes

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    // te stamped once BEFORE the save loop (:189) — area membership, not
    // outcome: the saved Thug 1 carries the same zone te as failed Zombie 1.
    const teWrite = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[0] === 'campaign' && c[1] === 'targetEffects' && Array.isArray(c[2]),
    );
    expect(teWrite).toBeDefined();
    expect(teWrite[3]).toBe(campaignName); // 4-arg marker write, no skipSync
    // getRuntimeValue mocked null → store starts empty → strict table in
    // cs.creatures order (resolveSelectedSpellTargets filters cs, areaSpellUtils.js:20).
    expect(teWrite[2]).toEqual([
      { target: 'Zombie 1', effect: 'web', source: 'TestCaster', dc: 19, duration: 'concentration' },
      { target: 'Thug 1', effect: 'web', source: 'TestCaster', dc: 19, duration: 'concentration' },
    ]);
  });

  it('registers ONE merged zone expiration (tracking clear + web te removal) at 600 rounds', async () => {
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    // ⚠️ POLICY VIOLATION marker (#1906 family) — expiryRounds:600 below is
    // the RETIRED hours×600 recipe (:80) consumed live as a round countdown
    // (expirationQueue.js:47-49); compliant path (until:'combat', addExpiration
    // :16/:24) not taken. Pinned as-shipped, NOT sanitized; fails on fix.
    const zoneEntry = {
      target: 'TestCaster',
      effects: [
        { type: 'clear_runtime_value', creatureName: 'TestCaster', key: TRACKING_KEY },
        { type: 'remove_target_effect', effectKey: 'web', source: 'TestCaster' },
      ],
      appliedRound: 1, // getCurrentCombatRound mocked → 1
      expiryRounds: 600,
      expireOnCreatureName: null,
    };
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCaster', KEY, [zoneEntry], campaignName,
    );
    // ONE merged addExpiration: exactly ONE entry carries the web te removal
    // (the former pre-fix second, racing zone write would appear here as 2).
    expect(keyWrites().flat()
      .filter(e => (e.effects || []).some(x => x.type === 'remove_target_effect' && x.effectKey === 'web')))
      .toEqual([zoneEntry]);
  });

  it('registers ONE Restrained condition expiration per failed target (no racing double write)', async () => {
    stubFailingDex();

    await handle(
      { ...makeAction(), metaCtx: { targets: ['Zombie 1'] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    // restrainWebTarget :118 — ONE condition expiration per failed target
    // (two sequential addExpiration calls race server-side, playbook 42ab).
    // Same ⚠️ #1906 family 600 as the zone entry above — pinned honestly.
    const restrainedEntry = {
      target: 'Zombie 1',
      effects: [{ type: 'condition', condition: 'restrained' }],
      appliedRound: 1,
      expiryRounds: 600,
      expireOnCreatureName: null,
    };
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCaster', KEY, [restrainedEntry], campaignName,
    );
    // Full queue accounting: zone entry (pre-loop) + ONE restrained entry =
    // exactly TWO pendingExpirations entries for this single-target cast.
    expect(keyWrites().flat()).toHaveLength(2);
    expect(keyWrites().flat()
      .filter(e => (e.effects || []).some(x => x.type === 'condition' && x.condition === 'restrained')))
      .toEqual([restrainedEntry]);
  });

  it('registers the web effect key in the targetEffectDefinitions registry', () => {
    // :1180 strict pin. Cross-pin: while this holds, handler :186-188
    // console.error('[webAreaSaveHandler] ...') guard is UNREACHABLE
    // (.errors lane #1991 writes no test for it, per its header).
    const def = getEffectDefinition('web');
    expect(def).toBeDefined();
    expect(def.effect).toBe('web');
    expect(def.label).toBe('Web');
    expect(def.icon).toBe('fa-spider');
    expect(def.cls).toBe('effect-debuff');
    expect(def.group).toBe('Spells');
    expect(def.fields).toEqual(['source', 'dc']);
  });
});
