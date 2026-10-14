import {
    onArcaneWardBonusActionRestore,
} from './arcaneWardHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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

describe('onArcaneWardBonusActionRestore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the lowest available spell slot to restore ward HP', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 5;
            if (key === 'arcaneWardMax') return 13;
            if (key === 'spell_slots_level_1') return 0;
            if (key === 'spell_slots_level_2') return 2;
            if (key === 'spell_slots_level_3') return 1;
            return undefined;
        });

        const result = await onArcaneWardBonusActionRestore(
            { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 9, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 1, campaignName);
        expect(result.payload.description).toContain('restored 4 HP');
        expect(result.payload.description).toContain('level 2');
    });

    it('falls back to level 1 when it is the only slot available', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 5;
            if (key === 'arcaneWardMax') return 13;
            if (key === 'spell_slots_level_1') return 3;
            if (key === 'spell_slots_level_2') return 0;
            if (key === 'spell_slots_level_3') return 0;
            return undefined;
        });

        const result = await onArcaneWardBonusActionRestore(
            { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 7, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_1', 2, campaignName);
        expect(result.payload.description).toContain('restored 2 HP');
        expect(result.payload.description).toContain('level 1');
    });

    it('returns info popup when no spell slots are available', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 5;
            if (key === 'arcaneWardMax') return 13;
            if (key.startsWith('spell_slots_level_')) return 0;
            return undefined;
        });

        const result = await onArcaneWardBonusActionRestore(
            { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No spell slots available');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns info popup when ward is not active', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return false;
            if (key === 'spell_slots_level_1') return 3;
            return undefined;
        });

        const result = await onArcaneWardBonusActionRestore(
            { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('not active');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('caps ward HP at max when restoration would exceed it', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 12;
            if (key === 'arcaneWardMax') return 13;
            if (key === 'spell_slots_level_1') return 3;
            return undefined;
        });

        const result = await onArcaneWardBonusActionRestore(
            { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
        expect(result.payload.description).toContain('13/13');
    });

    it('restores ward when active with 0 current HP', async () => {
        setWardMocks((player, key) => {
            if (key === 'arcaneWardActive') return true;
            if (key === 'arcaneWardHp') return 0;
            if (key === 'arcaneWardMax') return 13;
            if (key === 'spell_slots_level_1') return 3;
            return undefined;
        });

        const result = await onArcaneWardBonusActionRestore(
            { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 2, campaignName);
        expect(result.payload.description).toContain('0 → 2');
    });
});
