import { isPsychicSpellsActive, getPsychicSpellsConfig, handle } from './psychicSpellsHandler.js';
import { collectAutomationFromFeatures } from '../../../combat/automation/automationCollector.js';
import { psionicHandlers } from '../../../combat/automation/automationInfoBuilder/psionic.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

describe('psychicSpellsHandler', () => {
    describe('isPsychicSpellsActive', () => {
        it('should return true when psychic_spells passive exists', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic' }
                    ]
                }
            };
            expect(isPsychicSpellsActive(playerStats)).toBe(true);
        });

        it('should return false when psychic_spells passive does not exist', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'radiant_soul', name: 'Radiant Soul' }
                    ]
                }
            };
            expect(isPsychicSpellsActive(playerStats)).toBe(false);
        });

        it('should return false when passives is empty', () => {
            const playerStats = {
                automation: {
                    passives: []
                }
            };
            expect(isPsychicSpellsActive(playerStats)).toBe(false);
        });

        it('should return false when automation is null', () => {
            const playerStats = {
                automation: null
            };
            expect(isPsychicSpellsActive(playerStats)).toBe(false);
        });
    });

    describe('getPsychicSpellsConfig', () => {
        it('should return the psychic_spells passive config', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic', componentReduction: ['V', 'S'] }
                    ]
                }
            };
            const config = getPsychicSpellsConfig(playerStats);
            expect(config).toEqual({ type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic', componentReduction: ['V', 'S'] });
        });

        it('should return undefined when psychic_spells passive does not exist', () => {
            const playerStats = {
                automation: {
                    passives: []
                }
            };
            expect(getPsychicSpellsConfig(playerStats)).toBeUndefined();
        });
    });

    describe('handle', () => {
        it('should return a popup response with feature description', async () => {
            const action = {
                name: 'Psychic Spells',
                automation: {
                    type: 'psychic_spells',
                    damageType: 'Psychic',
                    componentReduction: ['V', 'S'],
                    spellSchools: ['enchantment', 'illusion']
                }
            };
            const playerStats = { name: 'TestWarlock', automation: { passives: [] } };

            const result = await handle(action, playerStats, 'TestCampaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Psychic Spells');
            expect(result.payload.description).toContain('Psychic');
        });
    });
});

describe('psionicHandlers - psychic_spells', () => {
    it('should build correct info object for psychic_spells automation', () => {
        const feature = {
            name: 'Psychic Spells',
            automation: {
                type: 'psychic_spells',
                damageType: 'Psychic',
                componentReduction: ['V', 'S'],
                spellSchools: ['enchantment', 'illusion']
            }
        };

        const result = psionicHandlers['psychic_spells'](feature, {});

        expect(result.type).toBe('psychic_spells');
        expect(result.name).toBe('Psychic Spells');
        expect(result.damageType).toBe('Psychic');
        expect(result.componentReduction).toEqual(['V', 'S']);
        expect(result.spellSchools).toEqual(['enchantment', 'illusion']);
        expect(result.hasAutomation).toBe(true);
    });

    it('should use defaults when automation fields are missing', () => {
        const feature = {
            name: 'Psychic Spells',
            automation: {
                type: 'psychic_spells'
            }
        };

        const result = psionicHandlers['psychic_spells'](feature, {});

        expect(result.damageType).toBe('Psychic');
        expect(result.componentReduction).toEqual([]);
        expect(result.spellSchools).toEqual([]);
    });
});

describe('collectAutomationFromFeatures - psychic_spells', () => {
    it('should route psychic_spells to passives', () => {
        const features = [
            {
                name: 'Psychic Spells',
                automation: {
                    type: 'psychic_spells',
                    damageType: 'Psychic',
                    componentReduction: ['V', 'S'],
                    spellSchools: ['enchantment', 'illusion']
                }
            }
        ];

        const result = collectAutomationFromFeatures(features, {});

        expect(result.passives).toHaveLength(1);
        expect(result.passives[0].type).toBe('psychic_spells');
        expect(result.passives[0].name).toBe('Psychic Spells');
        expect(result.passives[0].damageType).toBe('Psychic');
    });
});
