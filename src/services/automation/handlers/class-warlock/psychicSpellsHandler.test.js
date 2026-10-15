// @maintained-by-ai
// Deterministic handler-contract suite for the psychic_spells popup handler: pins the
// owned _<FeatureName>_damageType runtime key (exact-key pins, incl. the empty-name
// '__damageType' seam), the throws-on-undefined-name contract (this handler does NOT
// default its name, unlike siblings such as mistyWanderer), the skip-when-already-set
// no-side-effect guard, full-string own popup/log composition, and campaign logging.
// All dependencies mocked at the module boundary. Only churns if handler behaviour
// changes on purpose.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { isPsychicSpellsActive, getPsychicSpellsConfig, handle } from './psychicSpellsHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

const campaignName = 'TestCampaign';
const playerName = 'TestWarlock';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        automation: { passives: [] },
        ...overrides,
    };
}

function makeFeature(overrides = {}) {
    return {
        name: 'Psychic Spells',
        automation: {
            type: 'psychic_spells',
            damageType: 'Psychic',
            componentReduction: ['V', 'S'],
            spellSchools: ['enchantment', 'illusion'],
        },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    setRuntimeValue.mockImplementation(async () => {});
});

describe('psychicSpellsHandler', () => {
    describe('isPsychicSpellsActive', () => {
        it('should return true when psychic_spells passive exists in automation.passives', () => {
            const playerStats = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic' },
                    ],
                },
            });
            expect(isPsychicSpellsActive(playerStats)).toBe(true);
        });

        it('should return false when playerStats or passives are null/undefined/missing', () => {
            expect(isPsychicSpellsActive(null)).toBe(false);
            expect(isPsychicSpellsActive(undefined)).toBe(false);
            expect(isPsychicSpellsActive({ name: 'Test' })).toBe(false);
            expect(isPsychicSpellsActive(makePlayerStats({ automation: null }))).toBe(false);
            expect(isPsychicSpellsActive(makePlayerStats({ automation: { passives: [] } }))).toBe(false);
        });
    });

    describe('getPsychicSpellsConfig', () => {
        it('should return the psychic_spells passive config object', () => {
            const config = { type: 'psychic_spells', name: 'Psychic Spells', damageType: 'Psychic', componentReduction: ['V', 'S'] };
            const playerStats = makePlayerStats({
                automation: {
                    passives: [config],
                },
            });
            expect(getPsychicSpellsConfig(playerStats)).toEqual(config);
        });

        it('should return the first matching psychic_spells passive when multiple exist', () => {
            const playerStats = makePlayerStats({
                automation: {
                    passives: [
                        { type: 'psychic_spells', name: 'Psychic Spells' },
                        { type: 'psychic_spells', name: 'Duplicate Psychic Spells' },
                    ],
                },
            });
            const result = getPsychicSpellsConfig(playerStats);
            expect(result.name).toBe('Psychic Spells');
        });

        it('should return undefined when playerStats or passives are null/undefined/missing', () => {
            expect(getPsychicSpellsConfig(null)).toBeUndefined();
            expect(getPsychicSpellsConfig({ name: 'Test' })).toBeUndefined();
            expect(getPsychicSpellsConfig(makePlayerStats({ automation: null }))).toBeUndefined();
            expect(getPsychicSpellsConfig(makePlayerStats({ automation: { passives: [] } }))).toBeUndefined();
        });
    });

    describe('handle', () => {
        it('should set runtime damageType under the exact _Psychic_Spells_damageType key when not already set', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeFeature();
            const playerStats = makePlayerStats();

            await handle(action, playerStats, campaignName);

            expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_Psychic_Spells_damageType', campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Psychic_Spells_damageType',
                'Psychic',
                campaignName
            );
        });

        it('should use custom damageType from automation config for runtime write and popup', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeFeature({ automation: { damageType: 'Force' } });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Psychic_Spells_damageType',
                'Force',
                campaignName
            );
            expect(result.payload.description).toBe(
                'Psychic Spells: When you cast a Warlock spell that deals damage, you can change its damage type to Force. When you cast a Warlock spell that is an Enchantment or Illusion, you can do so without Verbal or Somatic components.'
            );
        });

        it('should skip setting runtime damageType when already set (no-side-effect guard)', async () => {
            getRuntimeValue.mockReturnValue('Force');
            const action = makeFeature();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });

        it('should return a popup response with full feature description and automation echo', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeFeature();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Psychic Spells',
                    description: 'Psychic Spells: When you cast a Warlock spell that deals damage, you can change its damage type to Psychic. When you cast a Warlock spell that is an Enchantment or Illusion, you can do so without Verbal or Somatic components.',
                    automation: action.automation,
                },
            });
        });

        it('should log an ability_use entry with full description to the campaign log', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeFeature();
            const playerStats = makePlayerStats();

            await handle(action, playerStats, campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Psychic Spells',
                description: 'Psychic Spells: Damage type can be changed to Psychic for Warlock spells that deal damage. Enchantment and Illusion Warlock spells require no Verbal or Somatic components.',
            });
        });

        it('should throw when action.name is undefined (no default name in this handler)', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeFeature({ name: undefined });
            const playerStats = makePlayerStats();

            await expect(handle(action, playerStats, campaignName)).rejects.toThrow(TypeError);
        });

        it('should derive the __damageType runtime key and empty popup name for an empty action name', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeFeature({ name: '' });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, '__damageType', 'Psychic', campaignName);
            expect(result.payload.name).toBe('');
        });
    });
});
