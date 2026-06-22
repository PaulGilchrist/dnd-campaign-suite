import { handle } from './illusorySelfHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../common/damageRollback.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findAttackRollAgainstTarget: vi.fn(),
    rollbackDamage: vi.fn(),
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
    targetName: 'TestWizard',
    targetAc: 13,
    hit: true,
    timestamp: Date.now() - 1000,
    ...overrides,
});

describe('illusorySelfHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: null, attackerName: null });
        damageRollback.rollbackDamage.mockResolvedValue(0);
        runtimeState.getRuntimeValue.mockReturnValue(null);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    });

    it('should return popup when no recent attack roll', async () => {
        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Illusory Self');
        expect(result.payload.description).toContain('No recent attack roll');
    });

    it('should return popup when attack already missed', async () => {
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: makeFreshAttackEvent({ hit: false }),
            attackerName: 'Goblin',
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('The attack already missed');
    });

    it('should return popup when no uses remaining and no spell slots', async () => {
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: makeFreshAttackEvent(),
            attackerName: 'Goblin',
        });
        runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'TestWizard' && prop === 'illusorySelfUses') return 1;
            if (prop.startsWith('spell_slots_level_')) return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('no uses remaining');
    });

    it('should trigger on hit and use correct attacker name from combatSummary', async () => {
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: makeFreshAttackEvent(),
            attackerName: 'Goblin',
        });
        runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'TestWizard' && prop === 'illusorySelfUses') return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('automatically misses');
        expect(result.payload.description).toContain('Goblin');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusorySelfUses', 1, campaignName);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            abilityName: 'Illusory Self',
            description: expect.stringContaining('attack misses'),
        }));
    });

    it('should expend a level 2+ spell slot when no uses remaining', async () => {
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: makeFreshAttackEvent(),
            attackerName: 'Goblin',
        });
        runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'TestWizard' && prop === 'illusorySelfUses') return 1;
            if (key === 'TestWizard' && prop === 'spell_slots_level_2') return 4;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 3, campaignName);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusorySelfUses', 0, campaignName);
    });

    it('should return popup when no uses and no spell slots available', async () => {
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: makeFreshAttackEvent(),
            attackerName: 'Goblin',
        });
        runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'TestWizard' && prop === 'illusorySelfUses') return 1;
            if (prop.startsWith('spell_slots_level_')) return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No spell slots available');
    });

    it('should rollback damage when attack hits', async () => {
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: makeFreshAttackEvent(),
            attackerName: 'Dragon',
        });
        damageRollback.rollbackDamage.mockResolvedValue(12);
        runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'TestWizard' && prop === 'illusorySelfUses') return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('HP restored');
        expect(damageRollback.rollbackDamage).toHaveBeenCalledWith('Dragon', 'TestWizard', campaignName, 'Illusory Self');
    });

    it('should not show duplicate feature name in description', async () => {
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: makeFreshAttackEvent(),
            attackerName: 'Goblin',
        });
        runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'TestWizard' && prop === 'illusorySelfUses') return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        const description = result.payload.description;
        const matches = description.match(/Illusory Self/g);
        expect(matches ? matches.length : 0).toBeLessThanOrEqual(1);
    });

    it('should show attacker name correctly in description', async () => {
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: makeFreshAttackEvent(),
            attackerName: 'Dragon',
        });
        runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'TestWizard' && prop === 'illusorySelfUses') return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

        expect(result.payload.description).toContain('Dragon');
        expect(result.payload.description).not.toContain('Attacker: <b>TestWizard</b>');
    });
});
