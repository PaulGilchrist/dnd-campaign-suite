import { handle } from './psychicTeleportationHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Rogue',
    level: 9,
    abilities: [
        { name: 'Dexterity', bonus: 4 },
        { name: 'Intelligence', bonus: 3 },
    ],
    proficiency: 3,
    resources: { psionicEnergy: { max: 8 }, ...overrides.resources },
    ...overrides,
});

const makeAction = (auto = {}) => ({
    name: 'Soul Blades',
    automation: {
        type: 'auto_effect',
        effect: 'psychic_teleportation',
        trigger: 'psychic_teleportation',
        uses: '1',
        recharge: 'short_rest',
        ...auto,
    },
});

describe('psychicTeleportationHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with teleport description', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 5;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Soul Blades');
        expect(result.payload.description).toContain('Psionic Energy');
        expect(result.payload.description).toContain('Teleport');
    });

    it('returns popup when no psionic energy remaining', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No Psionic Energy remaining');
    });

    it('decrements psionic energy on use', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 5;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Test Rogue', 'psionicEnergy', 4, 'test-campaign');
    });

    it('calls addEntry for logging', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 5;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'Test Rogue',
            abilityName: 'Soul Blades',
        }));
    });
});
