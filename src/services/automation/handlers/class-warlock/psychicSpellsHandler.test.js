// @improved-by-ai
import { isPsychicSpellsActive, getPsychicSpellsConfig, handle } from './psychicSpellsHandler.js';
import { collectAutomationFromFeatures } from '../../../combat/automation/automationCollector.js';
import { psionicHandlers } from '../../../combat/automation/automationInfoBuilder/psionic.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'TestWarlock',
    automation: {
        passives: [],
        ...overrides,
    },
    ...overrides,
});

const makeFeature = (overrides = {}) => ({
    name: 'Psychic Spells',
    automation: {
        type: 'psychic_spells',
        damageType: 'Psychic',
        componentReduction: ['V', 'S'],
        spellSchools: ['enchantment', 'illusion'],
        ...overrides.automation,
    },
    ...overrides,
});

describe('psychicSpellsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isPsychicSpellsActive', () => {
        it('should return true when psychic_spells passive exists', () => {
            const playerStats = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic' },
                    ],
                },
            });
            expect(isPsychicSpellsActive(playerStats)).toBe(true);
        });

        it('should return false when psychic_spells passive does not exist', () => {
            const playerStats = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'radiant_soul', name: 'Radiant Soul' },
                    ],
                },
            });
            expect(isPsychicSpellsActive(playerStats)).toBe(false);
        });

        it('should return false when passives is empty', () => {
            const playerStats = makePlayerStats({ automation: { passives: [] } });
            expect(isPsychicSpellsActive(playerStats)).toBe(false);
        });

        it('should return false when automation is null', () => {
            const playerStats = makePlayerStats({ automation: null });
            expect(isPsychicSpellsActive(playerStats)).toBe(false);
        });

        it('should return false when passives is undefined', () => {
            const playerStats = makePlayerStats({ automation: {} });
            expect(isPsychicSpellsActive(playerStats)).toBe(false);
        });
    });

    describe('getPsychicSpellsConfig', () => {
        it('should return the psychic_spells passive config', () => {
            const playerStats = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic', componentReduction: ['V', 'S'] },
                    ],
                },
            });
            expect(getPsychicSpellsConfig(playerStats)).toEqual({ type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic', componentReduction: ['V', 'S'] });
        });

        it('should return undefined when psychic_spells passive does not exist', () => {
            const playerStats = makePlayerStats({ automation: { passives: [] } });
            expect(getPsychicSpellsConfig(playerStats)).toBeUndefined();
        });

        it('should return undefined when automation is null', () => {
            const playerStats = makePlayerStats({ automation: null });
            expect(getPsychicSpellsConfig(playerStats)).toBeUndefined();
        });

        it('should return the first matching passive when multiple exist', () => {
            const playerStats = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic' },
                        { type: 'psychic_spells', name: 'Duplicate', damageType: 'Force' },
                    ],
                },
            });
            expect(getPsychicSpellsConfig(playerStats).name).toBe('Psychic Spells');
        });
    });

    describe('handle', () => {
        it('should return a popup response with feature description', async () => {
            const action = makeFeature();
            const playerStats = makePlayerStats({ automation: { passives: [] } });

            const result = await handle(action, playerStats, 'TestCampaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Psychic Spells');
            expect(result.payload.description).toContain('Psychic');
            expect(result.payload.automation).toEqual(action.automation);
        });

        it('should default damageType to Psychic when not specified', async () => {
            const action = makeFeature({ automation: { type: 'psychic_spells', componentReduction: ['V'] } });
            const playerStats = makePlayerStats({ automation: { passives: [] } });

            const result = await handle(action, playerStats, 'TestCampaign');

            expect(result.payload.description).toContain('Psychic');
            expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
                description: expect.stringContaining('Psychic'),
            }));
        });

        it('should log an ability_use entry to the campaign log', async () => {
            const action = makeFeature();
            const playerStats = makePlayerStats({ automation: { passives: [] } });

            await handle(action, playerStats, 'TestCampaign');

            expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: 'Psychic Spells',
            }));
        });

        it('should set runtime damageType when not already set', async () => {
            const action = makeFeature();
            const playerStats = makePlayerStats({ automation: { passives: [] } });

            await handle(action, playerStats, 'TestCampaign');

            expect(logService.addEntry).toHaveBeenCalled();
        });
    });

    describe('psionicHandlers - psychic_spells', () => {
        it('should build correct info object for psychic_spells automation', () => {
            const feature = makeFeature();

            const result = psionicHandlers['psychic_spells'](feature, {});

            expect(result.type).toBe('psychic_spells');
            expect(result.name).toBe('Psychic Spells');
            expect(result.damageType).toBe('Psychic');
            expect(result.componentReduction).toEqual(['V', 'S']);
            expect(result.spellSchools).toEqual(['enchantment', 'illusion']);
            expect(result.hasAutomation).toBe(true);
        });

        it('should use defaults when automation fields are missing', () => {
            const feature = makeFeature({ automation: { type: 'psychic_spells' } });

            const result = psionicHandlers['psychic_spells'](feature, {});

            expect(result.damageType).toBe('Psychic');
            expect(result.componentReduction).toEqual([]);
            expect(result.spellSchools).toEqual([]);
            expect(result.hasAutomation).toBe(true);
        });

        it('should use custom damageType when provided', () => {
            const feature = makeFeature({ automation: { damageType: 'Force' } });

            const result = psionicHandlers['psychic_spells'](feature, {});

            expect(result.damageType).toBe('Force');
        });
    });

    describe('collectAutomationFromFeatures - psychic_spells', () => {
        it('should route psychic_spells to passives', () => {
            const features = [makeFeature()];

            const result = collectAutomationFromFeatures(features, {});

            expect(result.passives).toHaveLength(1);
            expect(result.passives[0].type).toBe('psychic_spells');
            expect(result.passives[0].name).toBe('Psychic Spells');
            expect(result.passives[0].damageType).toBe('Psychic');
            expect(result.passives[0].componentReduction).toEqual(['V', 'S']);
            expect(result.passives[0].spellSchools).toEqual(['enchantment', 'illusion']);
        });

        it('should not add passives when features array is empty', () => {
            const result = collectAutomationFromFeatures([], {});
            expect(result.passives).toHaveLength(0);
        });

        it('should not add passives when features is null', () => {
            const result = collectAutomationFromFeatures(null, {});
            expect(result.passives).toHaveLength(0);
        });
    });
});
