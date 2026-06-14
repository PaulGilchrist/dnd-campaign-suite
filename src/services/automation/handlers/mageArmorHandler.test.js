import { handle, applyMageArmor } from './mageArmorHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../rules/expirations.js';
import { getCombatContext } from '../../../services/rules/damageUtils.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/rules/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../services/rules/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((r) => (r ? 5 : 0)),
}));

vi.mock('../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../services/shared/logPoster.js', () => ({
    postLogEntry: vi.fn(() => Promise.resolve()),
}));

const MOCK_CAMPAIGN = 'test-campaign';
const MOCK_PLAYER = { name: 'TestWizard', level: 5 };

describe('mageArmorHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns target selection popup when combat context exists', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Ally1', type: 'player' },
                    { name: 'TestWizard', type: 'player' },
                    { name: 'Enemy1', type: 'npc' },
                ],
            });
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Ally1', type: 'player' },
                    { name: 'TestWizard', type: 'player' },
                    { name: 'Enemy1', type: 'npc' },
                ],
            });

            const action = {
                name: 'Mage Armor',
                spell: { range: 'Touch', duration: '8 hours' },
                automation: { type: 'mage_armor' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('mage_armor_target_selection');
            expect(result.payload.name).toBe('Mage Armor');
            expect(result.payload.creatureTargets).toEqual(['Ally1', 'Enemy1']);
            expect(result.payload.duration).toBe('8 hours');
        });

        it('returns error when no combat context', async () => {
            getCombatContext.mockResolvedValue(null);

            const action = {
                name: 'Mage Armor',
                spell: { range: 'Touch', duration: '8 hours' },
                automation: { type: 'mage_armor' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No combat context found');
        });
    });

    describe('applyMageArmor', () => {
        it('applies mage armor buff to target', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Mage Armor',
                spell: { duration: '8 hours' },
                automation: { type: 'mage_armor' },
            };

            const result = await applyMageArmor(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Mage Armor',
                        effect: 'mage_armor',
                        acBonus: 3,
                        duration: '8 hours',
                    }),
                ]),
                MOCK_CAMPAIGN
            );
            expect(addExpiration).toHaveBeenCalledWith(
                'TestWizard',
                'Ally1',
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'remove_active_buff',
                        buffName: 'Mage Armor',
                    }),
                ]),
                MOCK_CAMPAIGN
            );
        });

        it('does not apply if buff already active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                return null;
            });

            const action = {
                name: 'Mage Armor',
                spell: { duration: '8 hours' },
                automation: { type: 'mage_armor' },
            };

            const result = await applyMageArmor(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('popup');
        });

        it('handles multiple targets', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Mage Armor',
                spell: { duration: '8 hours' },
                automation: { type: 'mage_armor' },
            };

            const result = await applyMageArmor(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1', 'Ally2']);

            expect(result).not.toBeNull();
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        });

        it('returns null when no targets provided', async () => {
            const action = {
                name: 'Mage Armor',
                spell: { duration: '8 hours' },
                automation: { type: 'mage_armor' },
            };

            const result = await applyMageArmor(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, []);

            expect(result).toBeNull();
        });
    });
});
