import { handle } from './soulOfVengeanceHandler.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({ catch: vi.fn() }),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

const { getRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../rules/combat/damageUtils.js');

const campaignName = 'test-campaign';

const baseAction = {
    name: 'Soul of Vengeance',
    automation: { type: 'soul_of_vengeance', trigger: 'after_vow_of_enmity_target_attacks' },
};

const basePlayerStats = {
    name: 'TestHero',
    level: 15,
    attacks: [
        { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6, damage: '1d8+3', damageType: 'Slashing' },
    ],
};

describe('soulOfVengeanceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_playerName, key, _campaign) => {
            if (key === 'activeBuffs') return [];
            if (key === 'vowOfEnmityTarget') return null;
            return undefined;
        });
        getCombatContext.mockResolvedValue({
            targets: [{ attackerName: 'TestHero', targetName: 'Orc' }],
            creatures: [{ name: 'Orc' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
    });

    it('should return popup when Vow of Enmity is not active', async () => {
        getRuntimeValue.mockReturnValue([]);
        const result = await handle(baseAction, basePlayerStats, campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Vow of Enmity is not active');
    });

    it('should return popup when Vow of Enmity target is not set', async () => {
        getRuntimeValue
            .mockReturnValueOnce([{ effect: 'vow_of_enmity' }])
            .mockReturnValueOnce(null);
        const result = await handle(baseAction, basePlayerStats, campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No Vow of Enmity target');
    });

    it('should return popup when no combat context', async () => {
        getCombatContext.mockResolvedValue(null);
        getRuntimeValue
            .mockReturnValueOnce([{ effect: 'vow_of_enmity' }])
            .mockReturnValueOnce('Orc');
        const result = await handle(baseAction, basePlayerStats, campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected in combat');
    });

    it('should return attack_roll when conditions are met', async () => {
        getRuntimeValue
            .mockReturnValueOnce([{ effect: 'vow_of_enmity' }])
            .mockReturnValueOnce('Orc');
        const result = await handle(baseAction, basePlayerStats, campaignName);
        expect(result.type).toBe('attack_roll');
        expect(result.payload.attack.name).toBe('Longsword');
        expect(result.payload.targetName).toBe('Orc');
        expect(result.payload.sourceName).toBe('Soul of Vengeance');
    });

    it('should return popup when no melee attack available', async () => {
        getRuntimeValue
            .mockReturnValueOnce([{ effect: 'vow_of_enmity' }])
            .mockReturnValueOnce('Orc');
        const stats = { ...basePlayerStats, attacks: [] };
        const result = await handle(baseAction, stats, campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No melee attack available');
    });
});
