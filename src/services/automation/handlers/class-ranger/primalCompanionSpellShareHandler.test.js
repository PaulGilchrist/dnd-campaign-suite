// @maintained-by-ai 2026-11-26
// Spell-share HANDLER lane: owns the handler-direct branches of primalCompanionSpellShareHandler.js —
// guard popups (type gate > strict-alive gate > spell gate), the 30-ft range-gate refusal with a
// zero-spend census, the caster-effect match window (spellEffectKey normalization + `${spellKey}_`
// guard, unpinned by the service/chain siblings), full write-envelope pins, seeded dedupe, and the
// applySpellShare modal-confirm entry. Service trigger gates live in
// primalCompanionSpellShareService.test.js; the service->handler composition seam (real rangeToFeet,
// read/write order census, chain re-share) lives in primalCompanionSpellShare.share-chain.test.js —
// never re-grow those here (ownership split ratified #1395).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applySpellShare } from './primalCompanionSpellShareHandler.js';

const store = {};

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => store[`${name}.${key}`]),
    setRuntimeValue: vi.fn(async (name, key, value) => { store[`${name}.${key}`] = value; }),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');

const PLAYER = 'RangerBoy';
const COMPANION = 'Primal Companion (Beast of the Land)';

function makePlayerStats(overrides = {}) {
    return {
        name: PLAYER,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Share Spells',
        automation: {
            type: 'primal_companion_spell_share',
            range: '30_ft',
            casting_time: 'passive',
            ...overrides.automation,
        },
        spell: { name: 'Pass Without Trace', level: 2, range: 'Self' },
        spellSlotLevel: 2,
        ...overrides,
    };
}

// Live companion with the caster's Pass Without Trace te landed (shaped as passWithoutTraceService writes it).
function seedLiveCaster(targetEffects = [{ ...PWT_TE }]) {
    store[`${PLAYER}.primalCompanionType`] = 'Beast of the Land';
    store[`${PLAYER}.primalCompanionAlive`] = true;
    store['campaign.targetEffects'] = targetEffects;
}

const PWT_TE = {
    target: PLAYER,
    effect: 'pass_without_trace_bonus',
    source: PLAYER,
    slotLevel: 2,
    duration: 'concentration',
    bonusExpression: '+10',
};
// The handler's mirror: caster row verbatim, retargeted, with the Share Spells provenance flag.
const SHARED_TE = { ...PWT_TE, target: COMPANION, sharedBy: 'Share Spells' };

describe('primalCompanionSpellShareHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const k of Object.keys(store)) delete store[k];
        isWithinRange.mockResolvedValue(true);
    });

    describe('handle', () => {
        // Positive control for the alive-gate family below: alive === true is the ONLY
        // dispatching state (the old `=== false` gate detail lives in the fix#104(c) table).
        it('auto-applies the shared targetEffect with full commit envelopes and logs Share Spells', async () => {
            seedLiveCaster();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            // Full-shape pin: caster row untouched, mirror appended verbatim (no stray fields).
            expect(store['campaign.targetEffects']).toEqual([PWT_TE, SHARED_TE]);
            expect(store[`${PLAYER}.lastSpellShare`]).toBe('Pass Without Trace');
            // Ordered commit census: targetEffects first, lastSpellShare second, nothing else.
            expect(setRuntimeValue.mock.calls).toEqual([
                ['campaign', 'targetEffects', expect.any(Array), 'test-campaign'],
                [PLAYER, 'lastSpellShare', 'Pass Without Trace', 'test-campaign'],
            ]);

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'automation',
                characterName: PLAYER,
                automationType: 'primal_companion_spell_share',
                name: 'Share Spells',
                spellName: 'Pass Without Trace',
                spellLevel: 2,
                targetName: COMPANION,
                description: `Share Spells: ${PLAYER} shares Pass Without Trace with ${COMPANION}.`,
                timestamp: expect.any(Number),
            });

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Share Spells',
                    description: `Pass Without Trace shared with ${COMPANION}.`,
                }),
            });
        });

        it('consults the 30-ft range gate and denies the share, writing nothing, when out of range', async () => {
            seedLiveCaster();
            isWithinRange.mockResolvedValue(false);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(isWithinRange).toHaveBeenCalledWith(PLAYER, COMPANION, 30);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(`${COMPANION} is more than 30 feet away. Spell not shared.`);
            // Zero-spend census: refusal leaves the store and log untouched.
            expect(store['campaign.targetEffects']).toEqual([PWT_TE]);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('is a silent no-op when the spell effect has not landed on the caster yet', async () => {
            seedLiveCaster([{ target: COMPANION, source: PLAYER, effect: 'summoned' }]);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result).toBeNull();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        // Caster-effect match window: spellEffectKey strips apostrophes (straight AND curly) and
        // non-alphanumerics, and only the exact key or the `${spellKey}_` prefix shares. This
        // branch is unpinned in the service and chain siblings (both use apostrophe-free PWT).
        it.each([
            ['straight apostrophe', "Melf's Minute Meteors"],
            ['curly apostrophe', 'Melf\u2019s Minute Meteors'],
        ])('normalizes a %s spell name and mirrors only the matching caster row', async (_label, spellName) => {
            seedLiveCaster([
                { target: PLAYER, source: PLAYER, effect: 'melfs_minute_meteors_bonus', slotLevel: 9 },
                // Near-miss (one char short of the key + '_'): must NOT share.
                { target: PLAYER, source: PLAYER, effect: 'melfs_minute_meteor_bonus', slotLevel: 9 },
            ]);

            const result = await handle(
                makeAction({ spell: { name: spellName, level: 9, range: 'Self' }, spellSlotLevel: 9 }),
                makePlayerStats(),
                'test-campaign',
            );

            expect(result.payload.description).toBe(`${spellName} shared with ${COMPANION}.`);
            expect(store['campaign.targetEffects']).toEqual([
                { target: PLAYER, source: PLAYER, effect: 'melfs_minute_meteors_bonus', slotLevel: 9 },
                { target: PLAYER, source: PLAYER, effect: 'melfs_minute_meteor_bonus', slotLevel: 9 },
                { target: COMPANION, source: PLAYER, effect: 'melfs_minute_meteors_bonus', slotLevel: 9, sharedBy: 'Share Spells' },
            ]);
            expect(store[`${PLAYER}.lastSpellShare`]).toBe(spellName);
        });

        it('replaces an existing shared effect in place instead of duplicating it', async () => {
            seedLiveCaster([
                { ...PWT_TE },
                { target: COMPANION, effect: 'pass_without_trace_bonus', source: PLAYER, slotLevel: 1, sharedBy: 'Share Spells' },
            ]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            // Full-array pin: stale slotLevel-1 row upgraded to 2 at its original index, no push.
            expect(store['campaign.targetEffects']).toEqual([PWT_TE, SHARED_TE]);
        });

        // fix#104(c) twin (#1348 four-arm table, mirroring the service alive-gate pin in
        // primalCompanionSpellShareService.test.js): alive is STRICT !== true refuse at the
        // handler too. Producer census: 'primalCompanionAlive' is written true only at
        // summon/restore (primalCompanionHandler.js:305/:533) — never false — so the old
        // `=== false` gate never armed for unknown-alive companions and the share dispatched.
        // The true-dispatch arm is the top positive-control test above.
        it.each([
            ['false', false],
            ['null', null],
            ['undefined (key absent)', undefined],
        ])('alive=%s refuses with the not-alive popup before the range gate, writing nothing', async (_label, alive) => {
            store[`${PLAYER}.primalCompanionType`] = 'Beast of the Land';
            if (alive === undefined) {
                delete store[`${PLAYER}.primalCompanionAlive`];
            } else {
                store[`${PLAYER}.primalCompanionAlive`] = alive;
            }
            store['campaign.targetEffects'] = [{ ...PWT_TE }]; // caster effect PRESENT: without the gate the share would land

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Share Spells',
                    description: 'Primal companion is not alive.',
                }),
            });
            expect(isWithinRange).not.toHaveBeenCalled(); // decline happens at the gate, not mid-apply
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(store['campaign.targetEffects']).toHaveLength(1); // only the caster's own te remains
            expect(store[`${PLAYER}.lastSpellShare`]).toBeUndefined();
        });

        // Read-order pin (type gate strictly before alive gate) via popup identity: with
        // alive=true but no type, a swapped guard order would fall through to applyShareEffects'
        // DIFFERENT 'No primal companion to share spell with.' message — no mock census needed.
        it('declines with the summoned-popup when no companion type is set, even while alive=true', async () => {
            store[`${PLAYER}.primalCompanionAlive`] = true;
            store['campaign.targetEffects'] = [{ ...PWT_TE }];

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No primal companion summoned.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns info popup when triggered without a cast spell', async () => {
            seedLiveCaster();

            const result = await handle(makeAction({ spell: undefined }), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No spell cast to share.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('applySpellShare', () => {
        it('confirmed share delegates to the same apply path, skipping the handle alive gate', async () => {
            // applySpellShare is the modal-confirm entry (wired in automation/index.js); the share-chain
            // integration only exercises handle, so pin the confirmed delegation here. NOTE the seam
            // behavior: alive is deliberately NOT seeded — the confirmed entry checks type only.
            store[`${PLAYER}.primalCompanionType`] = 'Beast of the Land';
            store['campaign.targetEffects'] = [{ ...PWT_TE }];

            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(`Pass Without Trace shared with ${COMPANION}.`);
            expect(store['campaign.targetEffects']).toEqual([PWT_TE, SHARED_TE]);
        });

        it('returns info popup when sharing is declined', async () => {
            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Spell not shared with primal companion.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup when no companion exists', async () => {
            store['campaign.targetEffects'] = [{ ...PWT_TE }];

            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', true);

            expect(result.type).toBe('popup');
            // Handler-local applyShareEffects vocabulary, distinct from handle's '...summoned.' popup.
            expect(result.payload.description).toBe('No primal companion to share spell with.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
