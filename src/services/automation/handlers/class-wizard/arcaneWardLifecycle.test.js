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

    it('sets ward active to false, HP and max to 0', async () => {
        const result = await onArcaneWardDestroy(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledTimes(3);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('destroyed');
        expect(result.payload.description).toContain('Long Rest');
    });
});

describe('onArcaneWardLevelUp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('computes correct max HP: 2 x level + INT modifier', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 10;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        });

        await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        // 2*5 + 3 = 13
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 13, campaignName);
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

    it('caps scaled HP at new max', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 12;
            if (key === 'arcaneWardMax') return 13;
            return undefined;
        });

        const level6Stats = makeWizardStats('TestWizard', 6, 3);

        await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            level6Stats,
            campaignName,
        );

        // ratio=15/13, newHp=round(12*15/13)=round(13.85)=14, capped at 15
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 14, campaignName);
    });

    it('returns info popup when ward is not active', async () => {
        setWardMocks(() => false);

        const result = await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('not active');
    });

    it.each([
        [{ name: 'TestWizard', rules: '2024', level: 5, abilities: [] }, 10],
        [{ name: 'TestWizard', rules: '2024', level: 5 }, 10],
    ])('handles missing Intelligence ability by using 0 modifier (stats: %j)', async (noAbilitiesStats, expectedMax) => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 5;
            if (key === 'arcaneWardMax') return 10;
            return undefined;
        });

        await onArcaneWardLevelUp(
            { name: 'Arcane Ward' },
            noAbilitiesStats,
            campaignName,
        );

        // 2*5 + 0 = 10
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', expectedMax, campaignName);
    });
});

describe('onAbjurationSpellCast', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a new ward when one is not active', async () => {
        setWardMocks(() => false);

        const result = await onAbjurationSpellCast(
            { name: 'Arcane Ward' },
            makeWizardStats('TestWizard', 5, 3),
            'Shield',
            1,
            campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledTimes(3);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('created');
        expect(result.payload.description).toContain('Shield');
    });

    it('creates ward with correct max HP for different wizard levels', async () => {
        setWardMocks(() => false);

        const level10Stats = makeWizardStats('TestWizard', 10, 4);

        await onAbjurationSpellCast(
            { name: 'Arcane Ward' },
            level10Stats,
            'Mage Armor',
            1,
            campaignName,
        );

        // 2*10 + 4 = 24
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 24, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 24, campaignName);
    });

    it('restores ward HP when ward is already active', async () => {
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

        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 10, campaignName);
        expect(result.payload.description).toContain('restored 2 HP');
    });

    it('restores more HP with a higher spell slot level', async () => {
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
