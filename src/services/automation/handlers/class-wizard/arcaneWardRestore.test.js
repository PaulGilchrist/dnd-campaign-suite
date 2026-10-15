// @maintained-by-ai
// Lane: onArcaneWardRestore — explicit-slot restore arithmetic authority:
// restoreAmount = Number(spellSlotLevel) || 1, then × 2; newHp = Math.min(max, current +
// restoreAmount); `?? 0` defaults for unset ward HP/max; NO slot scan, NO slot consumption
// (that is the bonus-action lane); RETHROWS on addEntry reject (the deliberate contrast with
// the orphan bonus-action lane's swallow — see arcaneWardBonusActionRestore.test.js).
// Sibling lanes (do not duplicate here):
//   arcaneWardHandler.test.js             — handle(): not-active guard, arcane_ward_bonus_action
//                                           → 'arcaneWardRestore' modal routing, projected_ward
//                                           absorption.
//   arcaneWardBonusActionRestore.test.js  — onArcaneWardBonusActionRestore lowest-slot
//                                           auto-select + slot consumption (CONFIRMED DEAD export).
//   arcaneWardLifecycle.test.js           — onArcaneWardDestroy / onArcaneWardLevelUp /
//                                           onAbjurationSpellCast (two of three also orphan-flagged).
// Liveness flag (2026-10-15, confirmed by grep): onArcaneWardRestore has NO production caller.
// automation/index.js maps arcane_ward_bonus_action to handle(), which opens the modal;
// ArcaneWardRestoreModal.jsx handleApply() applies the restore itself via setRuntimeBatch
// and neither mount site (CharReactions.jsx, CharActionModals.SecondaryModals.jsx) passes
// onConfirm. The modal re-implements this exact formula (selectedLevel * 2, min-cap) —
// three copies (here, modal, onAbjurationSpellCast) with drift risk. Pins kept as the
// arithmetic authority: if the exports are ever consolidated into the modal, repoint these
// pins at the unified path; if the export is deleted, delete this file with it.
import {
    onArcaneWardRestore,
} from './arcaneWardHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const campaignName = 'test-campaign';

function makeWizardStats(name) {
    return {
        name,
        rules: '2024',
        level: 5,
        abilities: [{ name: 'Intelligence', bonus: 3 }],
    };
}

function wardActive(wardHp, wardMax) {
    return (player, key) => {
        if (key === 'arcaneWardActive') return true;
        if (key === 'arcaneWardHp') return wardHp;
        if (key === 'arcaneWardMax') return wardMax;
        return undefined;
    };
}

function restore(action, playerStats, spellSlotLevel) {
    return onArcaneWardRestore(action, playerStats, spellSlotLevel, campaignName);
}

const wardAction = { name: 'Arcane Ward', automation: { type: 'passive_rule' } };

describe('onArcaneWardRestore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('explicit-slot restoration arithmetic', () => {
        it('restores 2 HP per slot level, writes the ward once without consuming slots, and logs the full composed messages', async () => {
            getRuntimeValue.mockImplementation(wardActive(5, 13));

            const result = await restore(wardAction, makeWizardStats('TestWizard'), 2);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 9, campaignName);
            // no-scan / no-consumption lane guard: spell slots are never read or written here
            expect(getRuntimeValue).not.toHaveBeenCalledWith('TestWizard', expect.stringContaining('spell_slots_level_'), campaignName);
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', expect.stringContaining('spell_slots_level_'), expect.any(Number), campaignName);
            // full-string own-composition pins
            expect(result.payload.description).toBe('Arcane Ward: Ward restored 4 HP (5 → 9/13). Expend spell slot level 2.');
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    abilityName: 'Arcane Ward',
                    description: 'TestWizard used Arcane Ward (Bonus Action) to restore 4 HP to the ward (5 → 9/13). Expend spell slot level 2.',
                }),
            );
        });

        it('caps ward HP at max when restoration would exceed it', async () => {
            getRuntimeValue.mockImplementation(wardActive(12, 13));

            const result = await restore(wardAction, makeWizardStats('TestWizard'), 3);

            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
            expect(result.payload.description).toContain('12 → 13/13');
        });
    });

    describe('spell slot level normalization (Number(x) || 1)', () => {
        it.each([
            ['undefined', undefined],
            ['NaN string', 'invalid'],
            ['0', 0],
        ])('defaults to level 1 (restores 2 HP) when slot level is %s', async (_label, slotLevel) => {
            getRuntimeValue.mockImplementation(wardActive(5, 13));

            const result = await restore(wardAction, makeWizardStats('TestWizard'), slotLevel);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 7, campaignName);
            expect(result.payload.description).toContain('restored 2 HP');
            expect(result.payload.description).toContain('spell slot level 1');
        });
    });

    describe('unset ward values default via ?? 0', () => {
        it('treats unset ward HP as 0', async () => {
            getRuntimeValue.mockImplementation(wardActive(undefined, 13));

            const result = await restore(wardAction, makeWizardStats('TestWizard'), 1);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 2, campaignName);
            expect(result.payload.description).toContain('0 → 2/13');
        });

        it('treats unset ward max as 0 (restore pinned at 0)', async () => {
            getRuntimeValue.mockImplementation(wardActive(5, undefined));

            const result = await restore(wardAction, makeWizardStats('TestWizard'), 2);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 0, campaignName);
            expect(result.payload.description).toContain('5 → 0/0');
        });
    });

    describe('logging failure semantics', () => {
        it('throws when addEntry rejects (the bonus-action lane swallows; this lane rethrows)', async () => {
            getRuntimeValue.mockImplementation(wardActive(5, 13));
            addEntry.mockRejectedValueOnce(new Error('log failure'));

            await expect(
                restore(wardAction, makeWizardStats('TestWizard'), 2),
            ).rejects.toThrow('log failure');
        });
    });
});
