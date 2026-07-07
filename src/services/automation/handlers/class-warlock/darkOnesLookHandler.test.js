// @improved-by-ai
import { handle } from './darkOnesLookHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as automationService from '../../../combat/automation/automationService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({}));
vi.mock('../../../ui/logService.js');
vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));
vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

describe('darkOnesLookHandler.handle', () => {
    const mockCampaignName = 'TestCampaign';

    const createPlayerStats = (overrides = {}) => ({
        name: 'TestWarlock',
        level: 6,
        class: { name: 'Warlock' },
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    });

    const createAction = (overrides = {}) => ({
        name: "Dark One's Own Look",
        automation: { type: 'dark_ones_look', diceExpression: '1d10' },
        ...overrides,
    });

    const createCheck = (overrides = {}) => ({
        rollType: 'check',
        attackerName: 'TestWarlock',
        d20: 8,
        bonus: 5,
        checkName: 'Stealth check',
        ...overrides,
    });

    const createSave = (overrides = {}) => ({
        rollType: 'save',
        attackerName: 'TestWarlock',
        d20: 12,
        bonus: 3,
        saveType: 'wisdom',
        ...overrides,
    });

    const mockRandom = (value) => {
        vi.spyOn(Math, 'random').mockReturnValue((value - 1) / 10);
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Math, 'random');
        logService.addEntry.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('uses validation', () => {
        it('should return error popup when no uses remaining', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            automationService.evaluateAutoExpression.mockReturnValue(3);

            const result = await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Dark One's Own Look");
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should use minimum 1 max uses when CHA modifier is negative', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            automationService.evaluateAutoExpression.mockReturnValue(-4);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: createCheck(),
            });
            mockRandom(5);

            const result = await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Modified: d20(8) + 5 + 1d10(5) = <b>18</b>');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock', 'darkOnesLookUses', 0, mockCampaignName
            );
        });
    });

    describe('ability check handling', () => {
        it('should enhance ability check result with d10 roll', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            automationService.evaluateAutoExpression.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: createCheck({ d20: 8, bonus: 5, checkName: 'Stealth check' }),
            });
            mockRandom(10);

            const result = await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Stealth check');
            expect(result.payload.description).toContain('d20(8) + 5 = 13');
            expect(result.payload.description).toContain('1d10(10)');
            expect(result.payload.description).toContain('1d10(10) = <b>23</b>');
        });

        it('should log the ability use', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            automationService.evaluateAutoExpression.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: createCheck(),
            });
            mockRandom(7);
            logService.addEntry.mockResolvedValue(undefined);

            await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: "Dark One's Own Look",
                description: expect.stringContaining('+1d10(7)'),
                timestamp: expect.any(Number),
            }));
        });
    });

    describe('saving throw handling', () => {
        it('should enhance saving throw result with d10 roll', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            automationService.evaluateAutoExpression.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: createSave(),
            });
            mockRandom(3);

            const result = await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('WIS');
            expect(result.payload.description).toContain('d20(12) + 3 = 15');
            expect(result.payload.description).toContain('1d10(3)');
            expect(result.payload.description).toContain('1d10(3) = <b>18</b>');
        });

        it('should consume one use after processing saving throw', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);
            automationService.evaluateAutoExpression.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: createSave(),
            });
            mockRandom(5);

            await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock', 'darkOnesLookUses', 4, mockCampaignName
            );
        });
    });

    describe('priority and rejection', () => {
        it('should prefer ability check over saving throw when both exist', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            automationService.evaluateAutoExpression.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: createCheck({ d20: 5, bonus: 2, checkName: 'Arcana check' }),
            });
            mockRandom(1);

            const result = await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Arcana check');
            expect(result.payload.description).not.toContain('WIS');
            expect(result.payload.description).not.toContain('save');
        });

        it('should reject when last attack is by a different character', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            automationService.evaluateAutoExpression.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: createCheck({ attackerName: 'Goblin', checkName: 'Stealth' }),
            });

            const result = await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent ability check');
            expect(result.payload.description).toContain('TestWarlock');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject when last attack is null or missing', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            automationService.evaluateAutoExpression.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({ lastAttack: null });

            const result = await handle(createAction(), createPlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent ability check');
        });
    });
});
