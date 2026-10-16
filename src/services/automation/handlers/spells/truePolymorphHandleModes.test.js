// truePolymorph HEXAD lane #1980 — .handleModes: mode DISPATCH inside handle().
// Owns: which automation.mode routes to which popup builder + the exact payload
// shape each mode branch emits (the payload-shape table below is canonical HERE).
// Delegation seam only: maxCR VALUE sourcing is pinned at route level here; the
// CR-cap math itself is canonical in #1982 (.ResolveMaxCR).
//
// ── truePolymorph HEXAD seam map (subjects: truePolymorphHandler.js + truePolymorphService.js) ──
// Queue (verified via sed on /tmp/test_maintain_queue.txt lines 1980-1986):
//   #1980 .handleModes            — handle() mode dispatch + popup payload shapes (THIS lane)
//   #1981 truePolymorphHandler    — full handler: combat/target guards, gate refusals
//                                     (already-transformed / 0HP / shapechanger), save flow,
//                                     ally skip, refusal logging
//   #1982 .ResolveMaxCR           — canonical resolveTruePolymorphMaxCR math + CR parsing
//   #1983 .apply                  — applyTruePolymorph gate/payload-builder (spell-name gate,
//                                     handler dispatch, DC fallback, throw-catch)
//   #1984 .queries                — getActiveTruePolymorphs / getActiveObjectTransforms /
//                                     getTruePolymorphCaster / getObjectTransformCaster
//   #1985 .summon-revert          — summonCreatureFromObject + revertTruePolymorph (+object
//                                     revert internals)
//   #1986 .transforms             — confirmTruePolymorphTransform + applyObjectTransform writes
//
// Payload-shape table (handle() branches, pinned strictly HERE; handler.js line refs):
//   mode absent/'creature_to_creature' + target → true_polymorph_select, maxCR DELEGATED
//     from resolveTruePolymorphMaxCR, mode:'creature_to_creature', no characters (:187-199)
//   'creature_to_object' + target → true_polymorph_object — NO mode key, no characters (:173-185)
//   'object_into_creature' + target FOUND → buildModePopup branch: maxCR hard-coded 9
//     (delegated value DISCARDED — see flags), mode key, NO characters key (:157-171)
//   'object_into_creature' + NO target → buildObjectIntoCreaturePopup: targetName null,
//     maxCR 9, mode key, characters passthrough — the ONLY popup carrying characters (:270-286)
//   unknown mode strings fall through the default branch and are LABELED 'creature_to_creature' (:223, :187-199)
//   guards (automation_info refusals: no creatures / no target non-object / no valid target) — #1981 lane
//
// Flags (recorded at source, NOT pinned here — action lands in the lanes named):
//   • abilities-ARRAY prod bug CONFIRMED same-class: truePolymorphService.js:88
//     `playerStats.abilities?.CON?.bonus ?? 0` — prod abilities is an ARRAY (cf.
//     polymorphService.js:60 twin, closed), so .CON is undefined and the CON bonus is
//     silently 0 in every concentration DC. Manifest corroborates ("conc-DC cosmetic
//     divergence 14v19", automations-manifest.json:7026). Handler never reads abilities
//     (only playerStats.name) — handler lane clean. Pin honest array shape in #1985/#1986.
//   • recast-snapshot-clobber (polymorph #1937 class): applyCreatureForm (service :98)
//     clobbers polymorphOriginal unconditionally — NO isFirstTransform guard. The
//     already-transformed gate lives in the HANDLER (:77-99); CharSheet's
//     handleTruePolymorphConfirm calls confirmTruePolymorphTransform directly, bypassing
//     it. Pin honest + flag in #1986.
//   • maxCR wasted await: resolveCreatureTargetMode computes maxCR (:215) even for
//     object_into_creature, where buildModePopup hard-codes 9 (:163) — the computed
//     value is discarded. Literal 9 duplicated at :163 and :277. Test 3 pins the
//     discard honestly; mainline may opt to skip the compute.
//   • dead-export tally (both subjects): service getActiveTruePolymorphs /
//     getActiveObjectTransforms / getTruePolymorphCaster / getObjectTransformCaster have
//     ZERO prod consumers (grep incl. index.js + dynamic dispatch — tests only);
//     summonCreatureFromObject exported but only consumed in-module (:142).
//     Handler exports: handle LIVE (index.js:539 true_polymorph dispatch),
//     resolveTruePolymorphMaxCR internal LIVE + test-only externally (#1982 canonical).
//   • no timers in either module — duration 'concentration' + expiryRounds Infinity are
//     combat-scoped per no-timers policy; no minutes×N legacy (#1906 family NOT present).
//   • arity: real getRuntimeValue signature is 2-arg (characterKey, propertyName);
//     handler :25 and all service reads pass a 3rd campaignName arg that is silently
//     ignored. Benign for the in-memory store; mocks here must NOT depend on arg 3.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { getName: (fullName) => fullName || 'Unknown' },
}));

import { handle } from './truePolymorphHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

const SPELL = { name: 'True Polymorph', level: 9 };

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

// Prod-shaped action: automation.mode comes from metaCtx.truePolymorphPath via
// applyTruePolymorph (service :59); handle() reads auto.mode with default
// creature_to_creature (:223). Keys kept explicit — no leaked fixture noise.
function makeAction({ mode, truePolymorphTarget = null, characters } = {}) {
  return {
    name: 'True Polymorph',
    automation: { type: 'true_polymorph', saveType: 'WIS', saveDc: 15, ...(mode ? { mode } : {}) },
    spell: SPELL,
    spellSlotLevel: 9,
    metaCtx: { truePolymorphTarget, ...(characters ? { characters } : {}) },
  };
}

const baseCombatContext = {
  creatures: [
    { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
    { name: casterName, type: 'player' },
  ],
};

function setupMocks({ targetEffects = [], allies = [], monsterChallengeRating = '1/8' } = {}) {
  getCombatContext.mockResolvedValue(baseCombatContext);
  getAllyList.mockReturnValue(allies);
  getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: monsterChallengeRating });
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return targetEffects;
    return null; // real store returns null for missing keys
  });
  createSaveListener.mockReturnValue({
    promptId: 'tpolymorph-prompt',
    promise: Promise.resolve({ success: false }), // non-ally save fails: mode dispatch reached
  });
}

describe('truePolymorphHandler.handle - mode dispatch (#1980 handleModes lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creature_to_creature default: missing automation.mode routes to true_polymorph_select with delegated maxCR', async () => {
    setupMocks();

    const result = await handle(
      makeAction({ truePolymorphTarget: targetName }),
      makePlayerStats(),
      campaignName,
      null,
    );

    // maxCR 0.125 came from the delegation seam (getMonsterData CR), NOT hard-coded —
    // CR math is canonical in #1982, routing of its result is pinned here.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'true_polymorph_select',
        targetName,
        maxCR: 0.125,
        casterName,
        campaignName,
        spell: SPELL,
        spellLevel: 9,
        mode: 'creature_to_creature',
      },
    });
    expect(getMonsterData).toHaveBeenCalledWith(targetName, null);
  });

  it('creature_to_object routes to true_polymorph_object payload — no mode key, no characters', async () => {
    setupMocks();

    const result = await handle(
      makeAction({ mode: 'creature_to_object', truePolymorphTarget: targetName }),
      makePlayerStats(),
      campaignName,
      null,
    );

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'true_polymorph_object',
        targetName,
        casterName,
        campaignName,
        spell: SPELL,
        spellLevel: 9,
      },
    });
    // Shape asymmetry pinned: object popup carries neither mode nor characters.
    expect(result.payload).not.toHaveProperty('mode');
    expect(result.payload).not.toHaveProperty('characters');
  });

  it('object_into_creature with resolved target routes via buildModePopup: CR-9 cap wins over delegated maxCR, payload has NO characters key', async () => {
    setupMocks({ monsterChallengeRating: '1/8' });

    const result = await handle(
      makeAction({
        mode: 'object_into_creature',
        truePolymorphTarget: targetName,
        characters: [{ name: 'PC1' }],
      }),
      makePlayerStats(),
      campaignName,
      null,
    );

    // Delegated maxCR would be 0.125; the object_into_creature branch hard-codes the
    // RAW CR<=9 cap and DISCARDS it (handler :163 — flagged, see header).
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'true_polymorph_select',
        targetName,
        maxCR: 9,
        casterName,
        campaignName,
        spell: SPELL,
        spellLevel: 9,
        mode: 'object_into_creature',
      },
    });
    expect(result.payload).not.toHaveProperty('characters');
  });

  it('object_into_creature with NO target routes to buildObjectIntoCreaturePopup: null targetName + characters passthrough (prod path-select flow)', async () => {
    setupMocks();

    const characters = [{ name: 'PC1' }, { name: 'PC2' }];
    const result = await handle(
      makeAction({ mode: 'object_into_creature', characters }),
      makePlayerStats(),
      campaignName,
      null,
    );

    // The only popup shape that carries characters (see seam-map table).
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'true_polymorph_select',
        targetName: null,
        maxCR: 9,
        casterName,
        campaignName,
        spell: SPELL,
        spellLevel: 9,
        mode: 'object_into_creature',
        characters,
      },
    });
  });

  it('unrecognised mode string falls through the default branch and is labelled creature_to_creature', async () => {
    setupMocks();
    // PC in characters matches target: delegation prefers characters lookup over monster.
    getRuntimeValue.mockImplementation(() => null);

    const characters = [{ name: targetName, level: 7 }];
    const result = await handle(
      makeAction({ mode: 'object_to_tea_set', truePolymorphTarget: targetName, characters }),
      makePlayerStats(),
      campaignName,
      null,
    );

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'true_polymorph_select',
        targetName,
        maxCR: 7,
        casterName,
        campaignName,
        spell: SPELL,
        spellLevel: 9,
        mode: 'creature_to_creature',
      },
    });
    expect(getMonsterData).not.toHaveBeenCalled();
  });
});
