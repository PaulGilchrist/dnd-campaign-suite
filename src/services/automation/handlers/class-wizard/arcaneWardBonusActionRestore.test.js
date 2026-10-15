// @maintained-by-ai
// Lane: bonus-action restore seam — onArcaneWardBonusActionRestore auto-selects the LOWEST
// available spell slot, restores 2 HP per slot level (capped at ward max), consumes the slot.
// Sibling lanes (do not duplicate here):
//   arcaneWardHandler.test.js   — handle(): not-active guard, arcane_ward_bonus_action →
//                                  'arcaneWardRestore' modal routing, projected-ward absorption.
//   arcaneWardRestore.test.js   — onArcaneWardRestore(): explicit spellSlotLevel (no scan,
//                                  no slot consumption, rethrows on addEntry reject).
//   arcaneWardLifecycle.test.js — onArcaneWardDestroy / onArcaneWardLevelUp /
//                                  onAbjurationSpellCast.
import {
    onArcaneWardBonusActionRestore,
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

function bonusAction() {
    return { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } };
}

function setWardMocks(getRuntimeValueImpl) {
    getRuntimeValue.mockImplementation(getRuntimeValueImpl);
}

function slotImpl(slots, wardHp, wardMax, active = true) {
    return (player, key) => {
        if (key === 'arcaneWardActive') return active;
        if (key === 'arcaneWardHp') return wardHp;
        if (key === 'arcaneWardMax') return wardMax;
        if (key.startsWith('spell_slots_level_')) {
            return slots[Number(key.replace('spell_slots_level_', ''))] ?? 0;
        }
        return undefined;
    };
}

describe('onArcaneWardBonusActionRestore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { label: 'level 1 when it is the only slot available', slots: { 1: 3 }, wardHp: 5, expectedSlotLevel: 1, expectedNewHp: 7 },
        { label: 'level 2 when level 1 is empty', slots: { 1: 0, 2: 2, 3: 1 }, wardHp: 5, expectedSlotLevel: 2, expectedNewHp: 9 },
        { label: 'highest-only slot from a zero-Hp ward', slots: { 3: 1 }, wardHp: 0, expectedSlotLevel: 3, expectedNewHp: 6 },
    ])('uses $label', async ({ slots, wardHp, expectedSlotLevel, expectedNewHp }) => {
        setWardMocks(slotImpl(slots, wardHp, 13));

        const result = await onArcaneWardBonusActionRestore(
            bonusAction(),
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.automationType).toBe('arcane_ward_bonus_action');
        const restoreAmount = expectedSlotLevel * 2;
        expect(result.payload.description).toBe(
            `Arcane Ward: Ward restored ${restoreAmount} HP (${wardHp} → ${expectedNewHp}/13). Expend spell slot level ${expectedSlotLevel}.`
        );
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', expectedNewHp, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', `spell_slots_level_${expectedSlotLevel}`, slots[expectedSlotLevel] - 1, campaignName);
    });

    it('caps ward HP at max when restoration would exceed it, still consuming the slot', async () => {
        setWardMocks(slotImpl({ 1: 3 }, 12, 13));

        const result = await onArcaneWardBonusActionRestore(
            bonusAction(),
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_1', 2, campaignName);
        expect(result.payload.description).toContain('12 → 13/13');
    });

    it('returns info popup and writes nothing when no spell slots are available', async () => {
        setWardMocks(slotImpl({}, 5, 13));

        const result = await onArcaneWardBonusActionRestore(
            bonusAction(),
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No spell slots available');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns info popup and writes nothing when ward is not active', async () => {
        setWardMocks(slotImpl({ 1: 3 }, 5, 13, false));

        const result = await onArcaneWardBonusActionRestore(
            bonusAction(),
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('not active');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('logs the restore via addEntry', async () => {
        setWardMocks(slotImpl({ 2: 1 }, 5, 13));

        await onArcaneWardBonusActionRestore(
            bonusAction(),
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

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

    it('resolves despite addEntry rejection (unlike onArcaneWardRestore, this seam swallows log failures)', async () => {
        setWardMocks(slotImpl({ 1: 2 }, 5, 13));
        addEntry.mockRejectedValueOnce(new Error('log failure'));

        const result = await onArcaneWardBonusActionRestore(
            bonusAction(),
            makeWizardStats('TestWizard', 5, 3),
            campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('restored 2 HP');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 7, campaignName);
    });
});
