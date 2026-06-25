// @improved-by-ai
import { handle, confirmArcaneCharge } from './arcaneChargeHandler.js';

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Arcane Charge',
        automation: { type: 'arcane_charge', distance: '30 ft', casting_time: '1 action', ...overrides.automation },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        ...overrides,
    };
}

describe('arcaneChargeHandler', () => {
    describe('handle', () => {
        it('should return a modal with arcaneCharge name and payload containing action, playerStats, campaignName, and distance', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('arcaneCharge');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
            expect(result.payload.campaignName).toBe(campaignName);
            expect(result.payload.distance).toBe('30 ft');
        });

        it('should use default distance of 30 ft when automation object is missing distance', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', casting_time: '1 action' } });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.payload.distance).toBe('30 ft');
        });

        it('should use default distance when automation distance is falsy', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', distance: null } });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.payload.distance).toBe('30 ft');
        });

        it('should use custom distance when specified in automation', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', distance: '60 ft', casting_time: '1 action' } });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.payload.distance).toBe('60 ft');
        });

        it('should use default distance when automation distance is empty string', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', distance: '', casting_time: '1 action' } });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(result.payload.distance).toBe('30 ft');
        });
    });

    describe('confirmArcaneCharge', () => {
        it('should return a popup with automation_info type and description including distance', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await confirmArcaneCharge(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Arcane Charge');
            expect(result.payload.automationType).toBe('arcane_charge');
            expect(result.payload.description).toBe('Arcane Charge: Teleported 30 ft to an unoccupied space you can see.');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should use custom distance in popup description', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', distance: '60 ft', casting_time: '1 action' } });
            const playerStats = makePlayerStats();

            const result = await confirmArcaneCharge(action, playerStats, campaignName);

            expect(result.payload.description).toBe('Arcane Charge: Teleported 60 ft to an unoccupied space you can see.');
        });

        it('should use default distance when automation distance is missing', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', casting_time: '1 action' } });
            const playerStats = makePlayerStats();

            const result = await confirmArcaneCharge(action, playerStats, campaignName);

            expect(result.payload.description).toBe('Arcane Charge: Teleported 30 ft to an unoccupied space you can see.');
        });

        it('should use default distance when automation distance is null', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', distance: null, casting_time: '1 action' } });
            const playerStats = makePlayerStats();

            const result = await confirmArcaneCharge(action, playerStats, campaignName);

            expect(result.payload.description).toBe('Arcane Charge: Teleported 30 ft to an unoccupied space you can see.');
        });

        it('should pass through the action name and automation type from the action object', async () => {
            const action = { name: 'Custom Name', automation: { type: 'arcane_charge', distance: '45 ft' } };
            const playerStats = makePlayerStats();

            const result = await confirmArcaneCharge(action, playerStats, campaignName);

            expect(result.payload.name).toBe('Custom Name');
            expect(result.payload.automationType).toBe('arcane_charge');
            expect(result.payload.description).toBe('Custom Name: Teleported 45 ft to an unoccupied space you can see.');
        });
    });
});

// end of file
