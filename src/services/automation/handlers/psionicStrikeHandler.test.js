import { handle } from './psionicStrikeHandler.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import * as diceRoller from '../../dice/diceRoller.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Fighter',
    level: 12,
    resources: { psionicEnergy: { max: 8 } },
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    ...overrides,
});

const makeAction = (auto = {}) => ({
    name: 'Psionic Strike',
    automation: {
        type: 'psionic_strike',
        resource: 'psionicEnergy',
        damageExpression: 'psionic_energy_die + INT modifier',
        damageType: 'Force',
        oncePerTurn: true,
        casting_time: '1 reaction, after attack',
        ...auto,
    },
});

describe('psionicStrikeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error popup when no psionic energy remaining', async () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);
        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No Psionic Energy remaining');
    });

    it('rolls die and calculates damage with INT modifier', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 5;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        diceRoller.rollExpression.mockReturnValue({ total: 5 });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.payload.description).toContain('Force damage');
        expect(result.payload.description).toContain('Psionic Energy: 4/8');
    });

    it('enforces once-per-turn when already used this turn', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 5;
            if (key === 'psionicStrikeUsedThisTurn') return 'turn-1';
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Already used this turn');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'Test Fighter', 'psionicEnergy', 4, 'test-campaign'
        );
    });

    it('marks turn usage when oncePerTurn and not yet used', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 5;
            if (key === 'psionicStrikeUsedThisTurn') return null;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        diceRoller.rollExpression.mockReturnValue({ total: 6 });

        await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Fighter', 'psionicEnergy', 4, 'test-campaign'
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Fighter', 'psionicStrikeUsedThisTurn', expect.any(String),
            'test-campaign'
        );
    });

    it('does not enforce once-per-turn when oncePerTurn is false', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 5;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        diceRoller.rollExpression.mockReturnValue({ total: 4 });

        const result = await handle(makeAction({ oncePerTurn: false }), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Force damage');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Test Fighter', 'psionicEnergy', 4, 'test-campaign'
        );
    });

    it('uses correct die size for level 9 (d8)', async () => {
        const playerStats = makePlayerStats({ level: 9 });
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 8;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        diceRoller.rollExpression.mockReturnValue({ total: 7 });

        await handle(makeAction(), playerStats, 'test-campaign');

        expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
    });

    it('uses correct die size for level 3 (d6)', async () => {
        const playerStats = makePlayerStats({ level: 3 });
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 6;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        diceRoller.rollExpression.mockReturnValue({ total: 3 });

        await handle(makeAction(), playerStats, 'test-campaign');

        expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
    });

    it('calls addEntry for logging', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 5;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        diceRoller.rollExpression.mockReturnValue({ total: 5 });

        await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'Test Fighter',
            abilityName: 'Psionic Strike',
        }));
    });

    it('uses default max when resources missing', async () => {
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'psionicEnergy') return 3;
            return null;
        });
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        diceRoller.rollExpression.mockReturnValue({ total: 4 });

        const result = await handle(makeAction(), makePlayerStats({ resources: null }), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Psionic Energy: 2/6');
    });
});
