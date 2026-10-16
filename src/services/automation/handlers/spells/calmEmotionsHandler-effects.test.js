// @maintained-by-ai
/**
 * calmEmotions TRIO seam map — three hyphen-suffix lanes share calmEmotionsHandler.js
 * (note: hyphen-suffix convention here, dot-suffix elsewhere — map by content, not naming):
 *  - #1880 calmEmotionsHandler-eligibility.test.js — resolveCalmEmotionsHumanoid /
 *        readSphereTokens / resolveCalmEmotionsEligibility (L31-111): Humanoid-only gate,
 *        20-ft sphere math, lenient-geometry advisories, plus the CALM_EMOTIONS_DURATION_ROUNDS
 *        constant pin. Zero overlap with this lane — eligibility never writes te/conditions.
 *  - #1881 calmEmotionsHandler-handle.test.js — handle() core (L266-380): no-creatures popup,
 *        save-prompt creation (CHA, dcSuccess 'none', metamagicHeighten→disadvantage),
 *        concentration registration + storage/event, storeSpellLastAttack, addTargetResult,
 *        popup summary strings, and registerCalmEmotionsExpiration via the handle route
 *        ('B5: registers a 10-round calm_emotions_end expiration clock on the caster').
 *        The duration CLOCK is theirs to keep — this lane deliberately does not duplicate it
 *        (a clock is not a te write).
 *  - THIS LANE (effects) — the two exported appliers, the effects-side content of a failed
 *        save, reached directly (production callers: CalmEmotionsModal.jsx L58-61/193-196
 *        choice routing per target; handle() default-immunity leg L351 — verified live
 *        2026-10-16; handle itself dispatched via automation/index.js L578
 *        `calm_emotions: handleCalmEmotions`):
 *        applyCalmEmotionsImmunity L163-240 — ONE merged per-target patch (conditions+buff,
 *            merge-not-replace L193), exact buff shape (consumer removal matchers read
 *            name 'Calm Emotions' + sourceCharacter — clearExpirationEffects L322,
 *            concentrationService.removeCalmEmotionsBuffs L225), campaign te written via
 *            DIRECT 4-arg setRuntimeValue (no skipSync) with replace-on-target+effect-ANY-source
 *            semantics L199-215 (deliberately pinned: a rival caster's same-target te is
 *            OVERWRITTEN), mode:'immunity' + lowercase suppressedConditions = the restore
 *            latch consumed by concentrationService.restoreSuppressedConditions L207-218
 *            (gate: effect==='calm_emotions' && mode==='immunity', L208)
 *            at both expiration and concentration-break seams;
 *        applyCalmEmotionsIndifferent L248-262 — delegation exists HERE (unlike banishment):
 *            pinned as a fingerprint of registerTargetEffect (L1492-1506) — 5-arg
 *            setRuntimeValue(..., campaignName, true) skipSync write, registry default
 *            duration 'concentration', extraProps {dc} merged — NOT registry table internals,
 *            which targetEffectDefinitions.test.js describe('registerTargetEffect') L476+ owns.
 *        Plus: full-string own-composition log pins both immunity branches + the indifferent
 *        ends-on-damage advisory, and addEntry-rejection resilience via mockRejectedValueOnce.
 *
 * Overlap flags for later lanes (exact test names):
 *  - #1881 'should apply immunity effects on failed save' loose-rewalks this te through
 *        handle() (arrayContaining + objectContaining {target, effect, mode, dc}). te SHAPE
 *        and latch CONTENT are owned here — trim #1881's pin to a reaches-apply smoke if
 *        the duo must dedupe.
 *  - Modal lanes CalmEmotionsModal.test.jsx / .cast-flow.test.jsx mock these appliers
 *        wholesale to test choice routing; the appliers' internals are honestly unit-tested
 *        here. Consumers owned elsewhere: clearExpirationEffects.calm-emotions-end.test.js,
 *        cleanupConcentrationEffects.test.js, targetEffectDefinitions.test.js,
 *        useInitiativeEffects.* lanes (read calm_emotions te by source).
 *
 * Reassignment notes (verified at source 2026-10-16):
 *  - Old 'should handle case-insensitive condition removal' only asserted the empty survivors
 *        array; strengthened to pin survivor casing preservation AND the lowercase
 *        suppressedConditions contract (restoreSuppressedConditions re-adds the te's casing,
 *        so stored 'CHARMED' comes back as 'charmed').
 *  - Old 'should track calm_emotions in targetEffects' used arrayContaining; upgraded to a
 *        strict full-array/full-object toEqual incl. the 4-arg arity that distinguishes the
 *        direct immunity write from registerTargetEffect's skipSync write.
 *  - registerTargetEffect is spied via importOriginal-partial mock: the REAL registry code
 *        runs (writes land in the mocked runtime store) so delegation is proven end-to-end,
 *        not stubbed.
 *
 * Turn-based: 'concentration' on te/buffs is a latch string cleared at concentration-break
 * and expiration-clock seams, never a wall-clock; no timers in this file (Date.now() inside
 * the mocked logService is a benign timestamp).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

// Real registry stays live (importOriginal) so the indifferent delegation writes through the
// mocked runtime store; only a spy is layered on to prove which appliers delegate.
vi.mock('../../../combat/conditions/targetEffectDefinitions.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, registerTargetEffect: vi.fn(actual.registerTargetEffect) };
});

// Full import surface of calmEmotionsHandler.js — inert for the appliers but mocked so the
// no-side-effect guards can assert they are never touched from this lane.
vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));
vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));
vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));
vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));
vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: { set: vi.fn() },
}));
vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));
vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));
vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn(),
}));

import {
  applyCalmEmotionsImmunity,
  applyCalmEmotionsIndifferent,
} from './calmEmotionsHandler.js';
import {
  getRuntimeValue,
  setRuntimeValue,
  setRuntimeObject,
} from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';
import {
  storeSpellLastAttack,
  addTargetResult,
} from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';

const campaignName = 'TestCampaign';
const TARGET = 'EnemyGoblin';
const CASTER = 'TestWizard';

const CALM_BUFF = {
  name: 'Calm Emotions',
  effect: 'calm_emotions',
  conditionImmunity: ['Charmed', 'Frightened'],
  sourceCharacter: CASTER,
  duration: 'concentration',
};

function runtimeRouter(stored = {}) {
  getRuntimeValue.mockImplementation((entity, key) => {
    if (key in stored) return stored[key];
    return undefined;
  });
}

function immunityPatchCalls() {
  return setRuntimeObject.mock.calls.filter(call => call[0] === TARGET);
}

function campaignTeWrites() {
  return setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks keeps implementations: the importOriginal-wrapped registerTargetEffect
  // stays functional, addEntry stays resolved.
  getRuntimeValue.mockReturnValue(undefined);
});

describe('applyCalmEmotionsImmunity — merged per-target write (SP-020)', () => {
  it('emits ONE merged patch: exact calm_emotions buff plus survivor conditions', async () => {
    runtimeRouter({
      activeConditions: ['charmed', 'frightened', 'poisoned'],
      activeBuffs: [{ name: 'Blessing', effect: 'blessing' }],
      targetEffects: [],
    });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    const calls = immunityPatchCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({
      activeConditions: ['poisoned'],
      activeBuffs: [
        { name: 'Blessing', effect: 'blessing' },
        CALM_BUFF,
      ],
    });
  });

  it('buff name/sourceCharacter match the consumer removal matchers exactly', async () => {
    // clearExpirationEffects L322 removes by b.name === 'Calm Emotions' &&
    // b.sourceCharacter === caster; concentrationService L225 by name alone.
    runtimeRouter({ activeConditions: [], activeBuffs: [], targetEffects: [] });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    const buff = immunityPatchCalls()[0][1].activeBuffs.at(-1);
    expect(buff).toEqual(CALM_BUFF);
    expect(buff.name).toBe('Calm Emotions');
    expect(buff.sourceCharacter).toBe(CASTER);
    expect(buff.duration).toBe('concentration');
  });

  it('omits activeConditions from the patch when nothing was suppressed (merge-not-replace)', async () => {
    runtimeRouter({
      activeConditions: ['poisoned', 'blinded'],
      activeBuffs: [],
      targetEffects: [],
    });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    expect(immunityPatchCalls()[0][1]).not.toHaveProperty('activeConditions');
  });

  it('removes charmed/frightened case-insensitively; survivors keep casing, latch stores lowercase', async () => {
    runtimeRouter({
      activeConditions: ['CHARMED', 'Frightened', 'Poisoned'],
      activeBuffs: [],
      targetEffects: [],
    });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    expect(immunityPatchCalls()[0][1].activeConditions).toEqual(['Poisoned']);
    // restoreSuppressedConditions re-adds the te's casing — lowercase by contract
    const te = campaignTeWrites()[0][2].find(
      e => e.target === TARGET && e.effect === 'calm_emotions',
    );
    expect(te.suppressedConditions).toEqual(['charmed', 'frightened']);
  });

  it('non-array stored activeConditions never echoes back into the patch', async () => {
    runtimeRouter({ activeConditions: 'charmed', activeBuffs: [], targetEffects: [] });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    const patch = immunityPatchCalls()[0][1];
    expect(patch).not.toHaveProperty('activeConditions');
    const te = campaignTeWrites()[0][2].find(
      e => e.target === TARGET && e.effect === 'calm_emotions',
    );
    expect(te.suppressedConditions).toEqual([]);
  });

  it('never per-key writes, delegates, arms clocks, or touches rollback', async () => {
    runtimeRouter({ activeConditions: ['charmed'], activeBuffs: [], targetEffects: [] });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    const perKey = setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeBuffs' || call[1] === 'activeConditions',
    );
    expect(perKey).toHaveLength(0);
    expect(immunityPatchCalls()).toHaveLength(1);
    // immunity te is a DIRECT write — no registerTargetEffect delegation on this path
    expect(registerTargetEffect).not.toHaveBeenCalled();
    expect(addExpiration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(storeSpellLastAttack).not.toHaveBeenCalled();
    expect(addTargetResult).not.toHaveBeenCalled();
  });
});

describe('applyCalmEmotionsImmunity — campaign targetEffects concentration latch', () => {
  it('writes the exact immunity te via a direct 4-arg write (no skipSync)', async () => {
    runtimeRouter({ activeConditions: ['charmed'], activeBuffs: [], targetEffects: [] });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    const te = {
      target: TARGET,
      effect: 'calm_emotions',
      mode: 'immunity',
      source: CASTER,
      suppressedConditions: ['charmed'],
      dc: 13,
      duration: 'concentration',
    };
    // mode 'immunity' + duration 'concentration' are load-bearing: concentrationService
    // restore gate L208 and the break-sweep filter (source + duration) read them.
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [te], campaignName);
    // arity asymmetry vs registerTargetEffect (which appends skipSync=true) — intentional pin
    expect(setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects')).toHaveLength(4);
  });

  it('replaces same target+effect regardless of source; unrelated tes survive', async () => {
    const rivalCalm = {
      target: TARGET, effect: 'calm_emotions', mode: 'charmed', source: 'OldCaster',
    };
    const untouched = {
      target: 'OtherGuy', effect: 'indifferent', source: 'SomeoneElse', duration: 'concentration',
    };
    runtimeRouter({
      activeConditions: ['charmed', 'frightened'],
      activeBuffs: [],
      targetEffects: [rivalCalm, untouched],
    });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 15,
    });

    const effects = campaignTeWrites()[0][2];
    const calmEntries = effects.filter(e => e.target === TARGET && e.effect === 'calm_emotions');
    expect(calmEntries).toHaveLength(1);
    expect(calmEntries[0]).toEqual({
      target: TARGET,
      effect: 'calm_emotions',
      mode: 'immunity',
      source: CASTER,
      suppressedConditions: ['charmed', 'frightened'],
      dc: 15,
      duration: 'concentration',
    });
    // documented quirk: rival caster's same-target te is overwritten, not appended
    expect(effects).toHaveLength(2);
    expect(effects).toContainEqual(untouched);
  });

  it('treats null stored targetEffects as empty', async () => {
    runtimeRouter({ activeConditions: ['charmed'], activeBuffs: [], targetEffects: null });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    expect(campaignTeWrites()).toHaveLength(1);
    expect(campaignTeWrites()[0][2]).toHaveLength(1);
    expect(campaignTeWrites()[0][2][0].mode).toBe('immunity');
  });
});

describe('applyCalmEmotionsImmunity — logging', () => {
  it('logs the suppression branch with full-string condition and note', async () => {
    runtimeRouter({ activeConditions: ['charmed', 'frightened'], activeBuffs: [], targetEffects: [] });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'condition',
      action: 'applied',
      characterName: TARGET,
      condition: 'Calm Emotions (Suppressed: charmed, frightened)',
      reason: 'Calm Emotions spell',
      note: "EnemyGoblin's charmed, frightened condition(s) are suppressed and immune to Charmed/Frightened.",
      timestamp: expect.any(Number),
    });
  });

  it('logs the immunity-only branch with full-string condition and note', async () => {
    runtimeRouter({ activeConditions: ['poisoned'], activeBuffs: [], targetEffects: [] });

    await applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'condition',
      action: 'applied',
      characterName: TARGET,
      condition: 'Calm Emotions (Immune to Charmed/Frightened)',
      reason: 'Calm Emotions spell',
      note: 'EnemyGoblin is immune to Charmed and Frightened.',
      timestamp: expect.any(Number),
    });
  });

  it('resolves even when addEntry rejects (state written before the log, .catch guard)', async () => {
    runtimeRouter({ activeConditions: ['charmed'], activeBuffs: [], targetEffects: [] });
    addEntry.mockRejectedValueOnce(new Error('log down'));

    await expect(applyCalmEmotionsImmunity({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    })).resolves.toBeUndefined();

    expect(immunityPatchCalls()).toHaveLength(1);
    expect(campaignTeWrites()).toHaveLength(1);
  });
});

describe('applyCalmEmotionsIndifferent — delegated advisory te (SP-020 B3)', () => {
  it('delegates to registerTargetEffect: dc passthrough, registry duration, skipSync write', async () => {
    runtimeRouter({ targetEffects: [] });

    await applyCalmEmotionsIndifferent({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    expect(registerTargetEffect).toHaveBeenCalledWith(
      campaignName, TARGET, 'indifferent', CASTER, { dc: 13 },
    );
    // delegation fingerprint: registry appends skipSync=true (5-arg), unlike the immunity path
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ target: TARGET, effect: 'indifferent', source: CASTER, duration: 'concentration', dc: 13 }],
      campaignName,
      true,
    );
  });

  it('keeps other-source indifferent entries; updates same-source via the delegation chain', async () => {
    const otherSource = {
      target: TARGET, effect: 'indifferent', source: 'OtherCaster',
      duration: 'concentration', dc: 9,
    };
    const staleSameSource = {
      target: TARGET, effect: 'indifferent', source: CASTER,
      duration: 'concentration', dc: 9,
    };
    runtimeRouter({ targetEffects: [otherSource, staleSameSource] });

    await applyCalmEmotionsIndifferent({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    const effects = campaignTeWrites()[0][2];
    expect(effects).toHaveLength(2);
    expect(effects).toContainEqual(otherSource);
    expect(effects.find(e => e.source === CASTER).dc).toBe(13);
  });

  it('touches no conditions, buffs, merged writes, calm_emotions tes, clocks, or rollback', async () => {
    runtimeRouter({ targetEffects: [] });

    await applyCalmEmotionsIndifferent({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    expect(setRuntimeObject).not.toHaveBeenCalled();
    const stateWrites = setRuntimeValue.mock.calls.filter(
      call => ['activeConditions', 'activeBuffs'].includes(call[1]),
    );
    expect(stateWrites).toHaveLength(0);
    expect(campaignTeWrites()[0][2].every(te => te.effect === 'indifferent')).toBe(true);
    expect(addExpiration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(storeSpellLastAttack).not.toHaveBeenCalled();
    expect(addTargetResult).not.toHaveBeenCalled();
    expect(registerTargetEffect).toHaveBeenCalledTimes(1);
  });

  it('logs the advisory with the full ends-on-damage clause', async () => {
    runtimeRouter({ targetEffects: [] });

    await applyCalmEmotionsIndifferent({
      targetName: TARGET, casterName: CASTER, campaignName, dc: 13,
    });

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'condition',
      action: 'applied',
      characterName: TARGET,
      condition: 'Indifferent (Calm Emotions)',
      reason: 'Calm Emotions spell',
      note: 'EnemyGoblin is Indifferent toward creatures it was hostile toward (GM-enforced advisory — no attitude consumer). Indifference ends if EnemyGoblin takes damage or witnesses an ally take damage; attitude returns to normal when the spell ends.',
      timestamp: expect.any(Number),
    });
  });
});
