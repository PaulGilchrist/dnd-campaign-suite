// @improved-by-ai
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

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestCleric',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Corona of Light',
        automation: {
            type: 'corona_of_light',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('coronaOfLightHandler.activateCoronaOfLight', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('buff toggling', () => {
        it('calls toggleBuff with correct arguments', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(toggleBuff).toHaveBeenCalledWith(
                'TestCleric',
                'Corona of Light',
                action.automation,
                campaignName,
                'TestCleric',
            );
        });

        it('uses the action name as the buff identifier', async () => {
            const action = { ...makeAction(), name: 'Custom Corona Name' };
            const playerStats = makePlayerStats();

            await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(toggleBuff).toHaveBeenCalledWith(
                'TestCleric',
                'Custom Corona Name',
                action.automation,
                campaignName,
                'TestCleric',
            );
        });
    });

    describe('enemy list storage', () => {
        it('stores selected enemies on the caster runtime key', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            const enemies = ['Goblin', 'Orc', 'Troll'];

            await activateCoronaOfLight(action, playerStats, campaignName, enemies);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'coronaOfLightEnemies',
                enemies,
                campaignName,
            );
        });

        it('stores null when no enemies selected', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'coronaOfLightEnemies',
                [],
                campaignName,
            );
        });

        it('stores null when enemies argument is null', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            await activateCoronaOfLight(action, playerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'coronaOfLightEnemies',
                null,
                campaignName,
            );
        });
    });

    describe('expiration setup', () => {
        it('adds an expiration for 10 rounds', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(addExpiration).toHaveBeenCalledWith(
                'TestCleric',
                'TestCleric',
                [{ type: 'remove_active_buff', buffName: 'Corona of Light' }],
                campaignName,
                10,
            );
        });

        it('uses action name as the buffName in expiration', async () => {
            const action = { ...makeAction(), name: 'Custom Corona' };
            const playerStats = makePlayerStats();

            await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(addExpiration).toHaveBeenCalledWith(
                'TestCleric',
                'TestCleric',
                [{ type: 'remove_active_buff', buffName: 'Custom Corona' }],
                campaignName,
                10,
            );
        });

        it('sets expiration on the caster character key', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats({ name: 'PaladinPaul' });

            await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(addExpiration).toHaveBeenCalledWith(
                'PaladinPaul',
                'PaladinPaul',
                expect.any(Array),
                campaignName,
                10,
            );
        });
    });

    describe('logging', () => {
        it('calls addEntry with ability_use type', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            const enemies = ['Goblin', 'Orc'];

            const now = Date.now();
            const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

            await activateCoronaOfLight(action, playerStats, campaignName, enemies);

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'TestCleric',
                abilityName: 'Corona of Light',
                description: expect.stringContaining('Goblin, Orc'),
                timestamp: now,
            });

            dateSpy.mockRestore();
        });

        it('includes the selected enemies in the log description', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            const enemies = ['Goblin'];

            await activateCoronaOfLight(action, playerStats, campaignName, enemies);

            const logCall = addEntry.mock.calls[0][1];
            expect(logCall.description).toContain('Goblin');
            expect(logCall.description).toContain('Corona of Light');
        });

        it('shows "none selected (all enemies affected)" when no enemies are passed', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            await activateCoronaOfLight(action, playerStats, campaignName, []);

            const logCall = addEntry.mock.calls[0][1];
            expect(logCall.description).toContain('none selected (all enemies affected)');
        });

        it('shows "none selected (all enemies affected)" when null is passed', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            await activateCoronaOfLight(action, playerStats, campaignName, null);

            const logCall = addEntry.mock.calls[0][1];
            expect(logCall.description).toContain('none selected (all enemies affected)');
        });

        it('uses the character name as characterName in log', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats({ name: 'ClericCynthia' });

            await activateCoronaOfLight(action, playerStats, campaignName, []);

            const logCall = addEntry.mock.calls[0][1];
            expect(logCall.characterName).toBe('ClericCynthia');
        });
    });

    describe('return value structure', () => {
        it('returns a popup type', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(result.type).toBe('popup');
        });

        it('returns automation_info payload type', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(result.payload.type).toBe('automation_info');
        });

        it('includes the action name in payload', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(result.payload.name).toBe('Corona of Light');
        });

        it('includes automationType in payload', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(result.payload.automationType).toBe('corona_of_light');
        });

        it('includes the automation object in payload', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(result.payload.automation).toEqual(action.automation);
        });

        it('includes a description mentioning enemies with disadvantage', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            const enemies = ['Goblin', 'Orc'];

            const result = await activateCoronaOfLight(action, playerStats, campaignName, enemies);

            expect(result.payload.description).toContain('Corona of Light activated!');
            expect(result.payload.description).toContain('Goblin, Orc');
            expect(result.payload.description).toContain('disadvantage');
        });

        it('says "all other creatures" when no enemies selected', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(result.payload.description).toContain('all other creatures');
        });
    });

    describe('error handling', () => {
        it('catches and logs addEntry errors without throwing', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            addEntry.mockRejectedValue(new Error('Log service down'));

            const result = await activateCoronaOfLight(action, playerStats, campaignName, []);

            expect(result.type).toBe('popup');
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });
});

describe('coronaOfLightHandler.removeCoronaEnemies', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls setRuntimeValue to clear the enemy list', () => {
        removeCoronaEnemies('TestCleric', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestCleric',
            'coronaOfLightEnemies',
            null,
            campaignName,
        );
    });

    it('uses the correct runtime key for corona enemies', () => {
        removeCoronaEnemies('PaladinPaul', 'MyCampaign');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'PaladinPaul',
            'coronaOfLightEnemies',
            null,
            'MyCampaign',
        );
    });
});
