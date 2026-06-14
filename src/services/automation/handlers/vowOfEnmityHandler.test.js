import { handle, applyTargetChoice } from './vowOfEnmityHandler.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../rules/combat/damageUtils.js');

const campaignName = 'TestCampaign';

const makePlayerStats = (level = 3, channelDivinity = 2) => ({
    name: 'TestHero',
    level,
    class: {
        class_levels: [undefined, undefined, { channel_divinity: channelDivinity }],
    },
});

const makeAction = (overrides = {}) => ({
    name: 'Vow of Enmity',
    automation: {
        type: 'temp_buff',
        effect: 'vow_of_enmity',
        duration: '1_minute',
        resourceCost: 'channel_divinity',
        casting_time: '1 bonus action',
        ...overrides,
    },
});

describe('vowOfEnmityHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
            if (key === 'channelDivinityCharges') return 2;
            if (key === 'vowOfEnmityTarget') return null;
            if (key === 'activeBuffs') return [];
            return undefined;
        });
        setRuntimeValue.mockResolvedValue(undefined);
        getCombatContext.mockResolvedValue({ targets: [{ attackerName: 'TestHero', targetName: 'Goblin' }] });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    });

    describe('handle', () => {
        it('returns popup when vow is already active', async () => {
            getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
                if (key === 'vowOfEnmityTarget') return 'Orc';
                if (key === 'channelDivinityCharges') return 2;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already active against Orc');
        });

        it('returns no-charges popup when channelDivinityCharges is 0', async () => {
            getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
                if (key === 'channelDivinityCharges') return 0;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        });

        it('decrements channelDivinityCharges and returns modal when no combat target', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('vowOfEnmityTarget');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, campaignName);
        });

        it('activates vow with combat target', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated against Goblin');
            expect(result.payload.description).toContain('advantage on attack rolls');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'vowOfEnmityTarget', 'Goblin', campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, campaignName);
        });
    });

    describe('applyTargetChoice', () => {
        it('returns popup when no target selected', async () => {
            const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No target selected.');
        });

        it('activates vow with chosen target', async () => {
            getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
                if (key === 'channelDivinityCharges') return 2;
                return undefined;
            });

            const result = await applyTargetChoice(makeAction(), makePlayerStats(), campaignName, 'Dragon');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated against Dragon');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'vowOfEnmityTarget', 'Dragon', campaignName);
        });
    });
});
