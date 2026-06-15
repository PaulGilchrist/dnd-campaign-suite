import { handle, confirmArcaneCharge } from './arcaneChargeHandler.js';

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Arcane Charge',
        automation: { type: 'arcane_charge', distance: '30 ft', casting_time: '1 action' },
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
        it('should return a modal with modalName arcaneCharge', async () => {
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

        it('should use default distance when not specified', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', casting_time: '1 action' } });
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, campaignName);

            expect(result.payload.distance).toBe('30 ft');
        });

        it('should use custom distance when specified', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', distance: '60 ft', casting_time: '1 action' } });
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, campaignName);

            expect(result.payload.distance).toBe('60 ft');
        });
    });

    describe('confirmArcaneCharge', () => {
        it('should return popup with teleport description', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await confirmArcaneCharge(action, playerStats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Arcane Charge');
            expect(result.payload.automationType).toBe('arcane_charge');
            expect(result.payload.description).toBe('Arcane Charge: Teleported 30 ft to an unoccupied space you can see.');
        });

        it('should use custom distance in description', async () => {
            const action = makeAction({ automation: { type: 'arcane_charge', distance: '60 ft', casting_time: '1 action' } });
            const playerStats = makePlayerStats();
            const result = await confirmArcaneCharge(action, playerStats, campaignName);

            expect(result.payload.description).toBe('Arcane Charge: Teleported 60 ft to an unoccupied space you can see.');
        });
    });
});
