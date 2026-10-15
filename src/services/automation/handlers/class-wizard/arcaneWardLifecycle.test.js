// @maintained-by-ai
// Lane: arcane-ward lifecycle seam — onArcaneWardDestroy (full reset to inactive/0/0),
// onArcaneWardLevelUp (max = 2 × level + INT, proportional current-HP scaling on level-up,
// capped at new max), and onAbjurationSpellCast (ward creation on first Abjuration cast,
// restore 2 HP per slot level when already active, rethrows on addEntry reject).
// Sibling lanes (do not duplicate here):
//   arcaneWardHandler.test.js             — handle(): not-active guard (this file's levelUp
//                                           not-active guard is a distinct-function twin, keep
//                                           both), arcane_ward_bonus_action → 'arcaneWardRestore'
//                                           modal routing, projected_ward absorption.
//   arcaneWardRestore.test.js             — onArcaneWardRestore explicit-slot arithmetic.
//   arcaneWardBonusActionRestore.test.js  — onArcaneWardBonusActionRestore lowest-slot
//                                           auto-select + slot consumption (CONFIRMED DEAD export).
// Orphan flag (2026-10-15): onArcaneWardDestroy / onArcaneWardLevelUp have no production
// call sites — production long-rest teardown lives in restRules-longRest.js (its own suite)
// and ward-max recompute lives in classRules.js/trackedResources.js (same 2 × level + INT
// formula, covered there). Pins kept per lane map; if the exports are deleted, drop this
// file's destroy/levelUp describes with them.
// Modal drift flag: ArcaneWardRestoreModal.jsx handleApply() re-implements the restore
// arithmetic (restoreAmount = selectedLevel * 2; newHp = Math.min(maxHp, currentHp +
// restoreAmount)) via setRuntimeBatch — duplicating onArcaneWardRestore and the restore
// path of onAbjurationSpellCast below. This file's restore pins cover the helpers.js
// spell-cast trigger path (not the modal), so they do NOT float with modal edits; a
// formula change must still be made in all three places.
import {
    onArcaneWardDestroy,
    onArcaneWardLevelUp,
    onAbjurationSpellCast,
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

function makeWizardStats(name, level, intBonus) {
    return {
        name,
        rules: '2024',
        level,
        abilities: [{ name: 'Intelligence', bonus: intBonus }],
    };
}

function setWardMocks(getRuntimeValueImpl) {
    getRuntimeValue.mockImplementation(getRuntimeValueImpl);
}

describe('onArcaneWardDestroy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resets ward to inactive with HP and max at 0 and reports destruction', async () => {
        const result = await onArcaneWardDestroy(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledTimes(3);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardActive', false, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 0, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 0, campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('destroyed');
        expect(result.payload.description).toContain('Long Rest');
    });
});

describe('onArcaneWardLevelUp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('recomputes max HP as 2 x level + INT modifier and keeps current HP when max is unchanged', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 10;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        });

        const result = await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        // 2*5 + 3 = 13 — equal to prevMax, so current HP stays 10 (no scaling branch)
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 13, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 10, campaignName);
        expect(result.type).toBe('popup');
    });

    it('scales current HP proportionally when max increases', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 10;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        });

        const level6Stats = makeWizardStats('TestWizard', 6, 3);

        await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            level6Stats,
            campaignName,
        );

        // prevMax=13, newMax=15, ratio=15/13, newHp=round(10*15/13)=round(11.54)=12
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 15, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 12, campaignName);
    });

    it('caps scaled current HP at new max', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 14;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        });

        const level6Stats = makeWizardStats('TestWizard', 6, 3);

        await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            level6Stats,
            campaignName,
        );

        // ratio=15/13, round(14*15/13)=round(16.15)=16, Math.min caps at newMax=15
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 15, campaignName);
    });

    it('returns info popup when ward is not active, writing nothing', async () => {
        setWardMocks(() => false);

        const result = await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('not active');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('treats a missing abilities array as 0 INT modifier', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 5;
            if (key === 'arcaneWardMax') return 10;
            return undefined;
        });

        await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            { name: 'TestWizard', rules: '2024', level: 5 },
            campaignName,
        );

        // 2*5 + 0 = 10
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 10, campaignName);
    });
});

describe('onAbjurationSpellCast', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a new ward at 2 x level + INT when one is not active', async () => {
        setWardMocks(() => false);

        const result = await onAbjurationSpellCast(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            'Shield',
            1,
            campaignName,
        );

        // 2*5 + 3 = 13
        expect(setRuntimeValue).toHaveBeenCalledTimes(3);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardActive', true, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 13, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('created');
        expect(result.payload.description).toContain('Shield');
    });

    it('restores ward HP when ward is already active, touching only ward HP', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 8;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        });

        const result = await onAbjurationSpellCast(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            'Mage Armor',
            1,
            campaignName,
        );

        // slot 1 -> restore 2; no max rewrite and no slot consumption on this path
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 10, campaignName);
        expect(result.payload.description).toContain('restored 2 HP');
    });

    it('restores more HP with a higher spell slot level, capped at max', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 8;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        });

        const result = await onAbjurationSpellCast(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            'Mage Armor',
            3,
            campaignName,
        );

        // 8 + (3*2) = 14, capped at 13
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
        expect(result.payload.description).toContain('restored 6 HP');
    });

    it.each([
        ['invalid', 10],
        [undefined, 10],
    ])('defaults to spell slot level 1 when value is %s', async (slotLevel, expectedHp) => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 8;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        });

        await onAbjurationSpellCast(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            'Shield',
            slotLevel,
            campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', expectedHp, campaignName);
    });

    it.each([
        ['creation', () => false],
        ['restoration', (player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 8;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        }],
    ])('throws when addEntry rejects during ward %s', async (_phase, wardSetup) => {
        setWardMocks(wardSetup);
        addEntry.mockRejectedValueOnce(new Error('log failure'));

        await expect(
            onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                'Shield',
                1,
                campaignName,
            ),
        ).rejects.toThrow('log failure');
    });

    it.each([
        ['creation', () => false, 'Shield'],
        ['restoration', (player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 8;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        }, 'Mage Armor'],
    ])('logs ward %s via addEntry', async (_phase, wardSetup, spellName) => {
        setWardMocks(wardSetup);

        await onAbjurationSpellCast(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            spellName,
            1,
            campaignName,
        );

        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWizard',
                abilityName: 'Arcane Ward',
                description: expect.stringContaining(spellName === 'Shield' ? 'created' : 'restored'),
            }),
        );
    });

    it('handles missing Intelligence ability when creating a new ward', async () => {
        setWardMocks(() => false);

        const noAbilitiesStats = {
            name: 'TestWizard',
            rules: '2024',
            level: 5,
        };

        await onAbjurationSpellCast(
            { name: 'Arcane Ward' },
            noAbilitiesStats,
            'Shield',
            1,
            campaignName,
        );

        // 2*5 + 0 = 10
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 10, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 10, campaignName);
    });
});
