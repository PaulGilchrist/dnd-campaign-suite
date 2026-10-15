// @maintained-by-ai
// Deterministic contract tests for coronaOfLightHandler: side-effect arguments,
// popup payload shape, empty-selection copy, and log-failure resilience.
// Downstream consumption of `coronaOfLightEnemies` is covered by the
// coronaAuraUtils / aoeService / holyNimbus suites — this file pins the handler only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const { toggleBuff } = await import('../../common/buffToggle.js');
const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { addEntry } = await import('../../../ui/logService.js');

const { activateCoronaOfLight, removeCoronaEnemies } = await import('./coronaOfLightHandler.js');

const campaignName = 'TestCampaign';
const playerStats = { name: 'TestCleric' };

function makeAction(name = 'Corona of Light') {
    return {
        name,
        automation: { type: 'corona_of_light' },
    };
}

describe('coronaOfLightHandler.activateCoronaOfLight', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('toggles buff, stores enemies, stamps a 10-round expiration, and logs — propagating the action name', async () => {
        // Custom name guards against hardcoding 'Corona of Light' in the
        // buff/expiration/log payloads. CLA-063: rounds:10 must be explicit.
        const action = makeAction('Radiant Corona');
        const enemies = ['Goblin', 'Orc'];

        await activateCoronaOfLight(action, playerStats, campaignName, enemies);

        expect(toggleBuff).toHaveBeenCalledWith(
            'TestCleric',
            'Radiant Corona',
            action.automation,
            campaignName,
            'TestCleric',
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestCleric',
            'coronaOfLightEnemies',
            enemies,
            campaignName,
        );
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'TestCleric',
            targetName: 'TestCleric',
            effects: [{ type: 'remove_active_buff', buffName: 'Radiant Corona' }],
            campaignName,
            rounds: 10,
        });
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestCleric',
            abilityName: 'Radiant Corona',
            description: 'TestCleric activated Corona of Light. Enemies: Goblin, Orc.',
        }));
    });

    it('returns an automation_info popup with action details and enemy list', async () => {
        const action = makeAction();
        const enemies = ['Goblin', 'Orc'];

        const result = await activateCoronaOfLight(action, playerStats, campaignName, enemies);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Corona of Light',
                automationType: 'corona_of_light',
                automation: action.automation,
                description: 'Corona of Light activated! Enemies with disadvantage on saves vs Fire/Radiant: Goblin, Orc.',
            },
        });
    });

    it('stores an empty enemy list, logs "none selected", and the popup says "all other creatures"', async () => {
        const action = makeAction();

        const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestCleric',
            'coronaOfLightEnemies',
            [],
            campaignName,
        );
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestCleric',
            abilityName: 'Corona of Light',
            description: expect.stringContaining('none selected (all enemies affected)'),
        }));
        expect(result.payload.description).toContain('all other creatures');
    });

    it('still returns the popup and logs the error when the log service fails', async () => {
        const action = makeAction();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

        addEntry.mockRejectedValueOnce(new Error('Log service down'));

        const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

        expect(result.type).toBe('popup');
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });
});

describe('coronaOfLightHandler.removeCoronaEnemies', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clears the enemy list for the given player and campaign', () => {
        removeCoronaEnemies('TestCleric', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestCleric',
            'coronaOfLightEnemies',
            null,
            campaignName,
        );
    });
});
