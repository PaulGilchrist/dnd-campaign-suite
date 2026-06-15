import { handle } from './guardedMindHandler.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Fighter',
    level: 12,
    resources: { psionicEnergy: { max: 8 } },
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    ...overrides,
});

const makeAction = (auto = {}) => ({
    name: 'Guarded Mind',
    automation: {
        type: 'guarded_mind',
        resource: 'psionicEnergy',
        casting_time: '1 action',
        ...auto,
    },
});

describe('guardedMindHandler', () => {
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

    it('removes charmed condition and decrements resource', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(5)
            .mockReturnValueOnce(['charmed', 'prone']);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'psionicEnergy', 4, 'test-campaign');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'activeConditions', ['prone'], 'test-campaign');
        expect(result.payload.description).toContain('Ended charmed');
        expect(result.payload.description).toContain('Psionic Energy: 4/8');
    });

    it('removes frightened condition and decrements resource', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(3)
            .mockReturnValueOnce(['frightened', 'blinded']);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'activeConditions', ['blinded'], 'test-campaign');
        expect(result.payload.description).toContain('Ended frightened');
    });

    it('removes both charmed and frightened conditions', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(2)
            .mockReturnValueOnce(['charmed', 'frightened', 'poisoned']);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'activeConditions', ['poisoned'], 'test-campaign');
        expect(result.payload.description).toContain('Ended charmed and frightened');
    });

    it('reports none when no matching conditions present', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(6)
            .mockReturnValueOnce(['blinded', 'poisoned']);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'activeConditions', ['blinded', 'poisoned'], 'test-campaign');
        expect(result.payload.description).toContain('Ended none');
    });

    it('handles empty conditions array', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(4)
            .mockReturnValueOnce([]);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'activeConditions', [], 'test-campaign');
        expect(result.payload.description).toContain('Ended none');
    });

    it('calls addEntry for logging', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(5)
            .mockReturnValueOnce(['charmed']);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'Test Fighter',
            abilityName: 'Guarded Mind',
        }));
    });

    it('uses default max when resources missing', async () => {
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(3)
            .mockReturnValueOnce(['charmed']);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);

        const result = await handle(makeAction(), makePlayerStats({ resources: null }), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Psionic Energy: 2/6');
    });
});
