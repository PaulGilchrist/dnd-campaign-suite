// @improved-by-ai
import { handle } from './concentrationBonusAttackHandler.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

describe('concentrationBonusAttackHandler', () => {
    const campaignName = 'test-campaign';
    const mockPlayerStats = { name: 'TestCharacter' };

    const baseAction = {
        name: 'Telekinetic Master',
        description: 'Always have Telekinesis spell prepared. Cast without spell slot. On each turn while maintaining Concentration, make one weapon attack as Bonus Action.',
        automation: {
            type: 'concentration_bonus_attack',
            concentrationSpell: 'Telekinesis',
            action: 'bonus_action',
        },
    };

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('concentration check', () => {
        it('sets concentration on Telekinesis at DC 10 when no concentration is active', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: null }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(addConcentration).toHaveBeenCalledWith(
                expect.objectContaining({ creatures: expect.any(Array) }),
                'TestCharacter',
                'Telekinesis',
                10,
            );
            expect(storage.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.objectContaining({ creatures: expect.any(Array) }),
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Telekinetic Master',
            }));
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Telekinetic Master',
                    automationType: 'concentration_bonus_attack',
                    description: expect.stringContaining('Concentrating on'),
                    automation: baseAction.automation,
                },
            });
        });

        it('overwrites existing concentration when on a different spell', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: { spell: 'Bless', dc: 10 } }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(addConcentration).toHaveBeenCalledWith(
                expect.any(Object),
                'TestCharacter',
                'Telekinesis',
                10,
            );
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
            expect(result.payload.description).toContain('Concentrating on');
        });

        it('overwrites existing concentration when concentration object has no spell field', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: {} }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(addConcentration).toHaveBeenCalledWith(
                expect.any(Object),
                'TestCharacter',
                'Telekinesis',
                10,
            );
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
            expect(result.payload.description).toContain('Concentrating on');
        });

        it('does not set concentration when already concentrating on Telekinesis', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: { spell: 'Telekinesis', dc: 12 } }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(result.payload.description).toContain('Concentrating on');
        });
    });

    describe('default concentration spell', () => {
        const actionWithoutSpell = {
            name: 'Test Feature',
            description: 'Test description.',
            automation: {
                type: 'concentration_bonus_attack',
                action: 'bonus_action',
            },
        };

        it('uses Telekinesis as default and does not set concentration when creature already has it', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: { spell: 'Telekinesis', dc: 12 } }],
            });

            const result = await handle(actionWithoutSpell, mockPlayerStats, campaignName);

            expect(addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(result.payload.description).toContain('Concentrating on');
        });

        it('uses Telekinesis as default and sets concentration when creature lacks it', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: { spell: 'Bless', dc: 10 } }],
            });

            const result = await handle(actionWithoutSpell, mockPlayerStats, campaignName);

            expect(addConcentration).toHaveBeenCalledWith(
                expect.any(Object),
                'TestCharacter',
                'Telekinesis',
                10,
            );
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
            expect(result.payload.description).toContain('Concentrating on');
        });
    });

    describe('missing data handling', () => {
        it('still adds campaign log entry when combat summary is null', async () => {
            getCombatSummary.mockReturnValue(null);

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Telekinetic Master',
            }));
            expect(result.payload.description).toContain('Concentrating on');
        });

        it('calls addConcentration when creatures array is undefined (no-op internally)', async () => {
            getCombatSummary.mockReturnValue({});

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(addConcentration).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
            expect(result.payload.description).toContain('Concentrating on');
        });

        it('calls addConcentration when creatures array is empty (no-op internally)', async () => {
            getCombatSummary.mockReturnValue({ creatures: [] });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(addConcentration).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
            expect(result.payload.description).toContain('Concentrating on');
        });

        it('calls addConcentration when creature is not found in combat summary (no-op internally)', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'OtherCharacter', concentration: { spell: 'Telekinesis', dc: 12 } }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(addConcentration).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
            expect(result.payload.description).toContain('Concentrating on');
        });
    });

    describe('dependency invocation', () => {
        it('passes campaignName to getCombatSummary', async () => {
            getCombatSummary.mockReturnValue({ creatures: [] });

            await handle(baseAction, mockPlayerStats, campaignName);

            expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
            expect(addConcentration).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
        });

        it('passes campaignName to getCombatSummary even when creature not found', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'OtherCharacter', concentration: null }],
            });

            await handle(baseAction, mockPlayerStats, campaignName);

            expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
            expect(addConcentration).toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalled();
        });
    });
});
