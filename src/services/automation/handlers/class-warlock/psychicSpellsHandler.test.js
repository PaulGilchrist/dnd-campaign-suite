// @improved-by-ai
import { isPsychicSpellsActive, getPsychicSpellsConfig, handle } from './psychicSpellsHandler.js';
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

        it('should return false when passives is empty, null, or missing', () => {
            expect(isPsychicSpellsActive(makePlayerStats({ automation: { passives: [] } }))).toBe(false);
            expect(isPsychicSpellsActive(makePlayerStats({ automation: null }))).toBe(false);
            expect(isPsychicSpellsActive(makePlayerStats({ automation: {} }))).toBe(false);
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

        it('should return undefined when psychic_spells passive does not exist or automation is null', () => {
            expect(getPsychicSpellsConfig(makePlayerStats({ automation: { passives: [] } }))).toBeUndefined();
            expect(getPsychicSpellsConfig(makePlayerStats({ automation: null }))).toBeUndefined();
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
    });
});
