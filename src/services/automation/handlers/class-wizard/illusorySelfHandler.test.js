import { handle } from './illusorySelfHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getLastAttackRoll } from '../../../../hooks/useMetamagic.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/useMetamagic.js', () => ({
    getLastAttackRoll: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const makeAction = (overrides = {}) => ({
    name: 'Illusory Self',
    automation: {
        type: 'illusory_self',
        trigger: 'attack_hit',
        casting_time: '1 reaction',
        uses: 1,
        recharge: 'short_or_long_rest',
        spellSlotRestore: { minLevel: 2 },
    },
    ...overrides,
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestWizard',
    level: 10,
    spellAbilities: {
        spell_slots_level_2: 4,
        spell_slots_level_3: 3,
        spell_slots_level_4: 2,
    },
    ...overrides,
});

const campaignName = 'test-campaign';
const makeFreshAttackEvent = (overrides = {}) => ({
    d20: 15,
    bonus: 5,
    targetName: 'Goblin',
    targetAc: 13,
    hit: true,
    timestamp: Date.now() - 1000,
    ...overrides,
});

describe('illusorySelfHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return popup when no recent attack roll', async () => {
        getLastAttackRoll.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Illusory Self');
        expect(result.payload.description).toContain('No recent attack roll');
    });

    it('should return popup when attack already missed', async () => {
        getLastAttackRoll.mockReturnValue(makeFreshAttackEvent({ hit: false }));

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('The attack already missed');
    });

    it('should return popup when no uses remaining and no spell slots', async () => {
        getLastAttackRoll.mockReturnValue(makeFreshAttackEvent());
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'illusorySelfUses') return 1;
            if (key.startsWith('spell_slots_level_')) return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('no uses remaining');
    });

    it('should trigger on hit and mark attack as miss', async () => {
        getLastAttackRoll.mockReturnValue(makeFreshAttackEvent());
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'illusorySelfUses') return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('automatically misses');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusorySelfUses', 1, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'lastAttackRoll', expect.objectContaining({ hit: false, illusorySelfMiss: true }), campaignName);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            abilityName: 'Illusory Self',
            description: expect.stringContaining('attack misses'),
        }));
    });

    it('should expend a level 2+ spell slot when no uses remaining', async () => {
        getLastAttackRoll.mockReturnValue(makeFreshAttackEvent());
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'illusorySelfUses') return 1;
            if (key === 'spell_slots_level_2') return 4;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 3, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusorySelfUses', 0, campaignName);
    });

    it('should return popup when no uses and no spell slots available', async () => {
        getLastAttackRoll.mockReturnValue(makeFreshAttackEvent());
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'illusorySelfUses') return 1;
            if (key.startsWith('spell_slots_level_')) return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No spell slots available');
    });

    it('should handle stale attack event', async () => {
        getLastAttackRoll.mockReturnValue({ timestamp: Date.now() - 120000, hit: true });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No recent attack roll');
    });
});
