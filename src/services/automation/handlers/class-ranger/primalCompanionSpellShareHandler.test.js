// @maintained-by-ai — deterministic: runtime store, logService, rangeCheck all mocked at module;
// pins handler branch behaviour (guards, range gate, dedupe, share mirroring) and own-composition strings.
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

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'RangerBoy',
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

function seedCasterEffect(targetEffects) {
    store['campaign.targetEffects'] = targetEffects;
}

const PWT_TE = {
    target: 'RangerBoy',
    effect: 'pass_without_trace_bonus',
    source: 'RangerBoy',
    slotLevel: 2,
    duration: 'concentration',
    bonusExpression: '+10',
};

describe('primalCompanionSpellShareHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const k of Object.keys(store)) delete store[k];
        isWithinRange.mockResolvedValue(true);
    });

    describe('handle', () => {
        it('auto-applies the shared targetEffect to the companion and logs Share Spells', async () => {
            store['RangerBoy.primalCompanionType'] = 'Beast of the Land';
            store['RangerBoy.primalCompanionAlive'] = true;
            seedCasterEffect([{ ...PWT_TE }]);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const written = store['campaign.targetEffects'];
            const shared = written.find(
                te => te.target === 'Primal Companion (Beast of the Land)' && te.effect === 'pass_without_trace_bonus'
            );
            expect(shared).toBeDefined();
            expect(shared.sharedBy).toBe('Share Spells');
            expect(shared.bonusExpression).toBe('+10');
            expect(shared.slotLevel).toBe(2);
            expect(shared.duration).toBe('concentration');
            expect(store['RangerBoy.lastSpellShare']).toBe('Pass Without Trace');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'primal_companion_spell_share',
                name: 'Share Spells',
                spellName: 'Pass Without Trace',
                targetName: 'Primal Companion (Beast of the Land)',
                description: expect.stringContaining('Share Spells'),
            }));

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Pass Without Trace shared with Primal Companion (Beast of the Land).');
        });

        it('consults the 30-ft range gate and denies the share, writing nothing, when out of range', async () => {
            store['RangerBoy.primalCompanionType'] = 'Beast of the Land';
            store['RangerBoy.primalCompanionAlive'] = true;
            seedCasterEffect([{ ...PWT_TE }]);
            isWithinRange.mockResolvedValue(false);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(isWithinRange).toHaveBeenCalledWith('RangerBoy', 'Primal Companion (Beast of the Land)', 30);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('more than 30 feet');
            expect(store['campaign.targetEffects']).toHaveLength(1);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('is a silent no-op when the spell effect has not landed on the caster yet', async () => {
            store['RangerBoy.primalCompanionType'] = 'Beast of the Land';
            store['RangerBoy.primalCompanionAlive'] = true;
            seedCasterEffect([{ target: 'Primal Companion (Beast of the Land)', source: 'RangerBoy', effect: 'summoned' }]);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result).toBeNull();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns info popup when companion is not alive', async () => {
            store['RangerBoy.primalCompanionType'] = 'Beast of the Sea';
            store['RangerBoy.primalCompanionAlive'] = false;

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Share Spells');
            expect(result.payload.description).toBe('Primal companion is not alive.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        // fix#104(c) twin (#1348 four-arm table, mirroring the service alive-gate pin in
        // primalCompanionSpellShareService.test.js): alive is STRICT !== true refuse at the
        // handler too. Producer census: 'primalCompanionAlive' is written true only at
        // summon/restore (primalCompanionHandler.js:305/:533) — never false — so the old
        // `=== false` gate never armed for unknown-alive companions and the share dispatched.
        describe('alive gate: strict === true (false/null/undefined all refuse, handler-local infoPopup decline)', () => {
            it.each([
                ['false', false],
                ['null', null],
                ['undefined (key absent)', undefined],
            ])('%s refuses with the not-alive popup before the range gate, writing nothing', async (_label, alive) => {
                store['RangerBoy.primalCompanionType'] = 'Beast of the Land';
                if (alive === undefined) {
                    delete store['RangerBoy.primalCompanionAlive'];
                } else {
                    store['RangerBoy.primalCompanionAlive'] = alive;
                }
                seedCasterEffect([{ ...PWT_TE }]); // caster effect PRESENT: without the gate the share would land

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toBe('Primal companion is not alive.');
                expect(isWithinRange).not.toHaveBeenCalled(); // decline happens at the gate, not mid-apply
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
                expect(store['campaign.targetEffects']).toHaveLength(1); // only the caster's own te remains
                expect(store['RangerBoy.lastSpellShare']).toBeUndefined();
            });

            it('true is the ONLY dispatching alive state', async () => {
                store['RangerBoy.primalCompanionType'] = 'Beast of the Land';
                store['RangerBoy.primalCompanionAlive'] = true;
                seedCasterEffect([{ ...PWT_TE }]);

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('Pass Without Trace shared with Primal Companion (Beast of the Land).');
                expect(isWithinRange).toHaveBeenCalledWith('RangerBoy', 'Primal Companion (Beast of the Land)', 30);
            });

            it('alive key is consulted only after the companion-type gate (read-order parity with the service)', async () => {
                delete store['RangerBoy.primalCompanionType'];
                store['RangerBoy.primalCompanionAlive'] = true;

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.payload.description).toBe('No primal companion summoned.');
                const aliveReads = getRuntimeValue.mock.calls.filter(
                    ([, key]) => key === 'primalCompanionAlive'
                );
                expect(aliveReads).toHaveLength(0); // type-absent declines before the alive key is read
            });
        });

        it('returns info popup when no companion is summoned', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No primal companion summoned.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup when triggered without a cast spell', async () => {
            store['RangerBoy.primalCompanionType'] = 'Beast of the Land';
            store['RangerBoy.primalCompanionAlive'] = true;

            const result = await handle(makeAction({ spell: undefined }), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No spell cast to share.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('replaces an existing shared effect instead of duplicating it', async () => {
            store['RangerBoy.primalCompanionType'] = 'Beast of the Land';
            store['RangerBoy.primalCompanionAlive'] = true;
            seedCasterEffect([
                { ...PWT_TE },
                { target: 'Primal Companion (Beast of the Land)', effect: 'pass_without_trace_bonus', source: 'RangerBoy', slotLevel: 1, sharedBy: 'Share Spells' },
            ]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const shared = store['campaign.targetEffects'].filter(
                te => te.target === 'Primal Companion (Beast of the Land)' && te.effect === 'pass_without_trace_bonus'
            );
            expect(shared).toHaveLength(1);
            expect(shared[0].slotLevel).toBe(2);
        });
    });

    describe('applySpellShare', () => {
        it('confirmed share delegates to the same apply path (full pins live in the handle tests)', async () => {
            // applySpellShare is the modal-confirm entry (wired in automation/index.js);
            // the share-chain integration only exercises handle, so pin the confirmed delegation here.
            store['RangerBoy.primalCompanionType'] = 'Beast of the Land';
            seedCasterEffect([{ ...PWT_TE }]);

            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Pass Without Trace shared with Primal Companion (Beast of the Land).');
            expect(store['campaign.targetEffects'].some(
                te => te.target === 'Primal Companion (Beast of the Land)' && te.effect === 'pass_without_trace_bonus'
            )).toBe(true);
        });

        it('returns info popup when sharing is declined', async () => {
            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Spell not shared with primal companion.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup when no companion exists', async () => {
            seedCasterEffect([{ ...PWT_TE }]);

            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No primal companion to share spell with.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
