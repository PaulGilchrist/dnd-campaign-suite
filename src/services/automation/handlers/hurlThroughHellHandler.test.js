import { handle } from './hurlThroughHellHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { buildSaveDc, createSaveListener } from '../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';

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

vi.mock('../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

const makeAction = (overrides = {}) => ({
    name: 'Hurl Through Hell',
    automation: {
        type: 'hurl_through_hell',
        damageExpression: '8d10',
        damageType: 'Psychic',
        saveType: 'CHA',
        saveDc: 'ability',
        saveAbility: 'CHA',
        oncePerTurn: true,
        uses: 1,
        pactMagicRecharge: true,
        casting_time: 'passive',
        ...overrides,
    },
});

const makePlayerStats = () => ({
    name: 'Test Warlock',
    proficiency: 3,
    abilities: [
        { name: 'Charisma', bonus: 4 },
    ],
    resources: {},
});

describe('hurlThroughHellHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('should return automation_info when already used this turn', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((key, _subKey, _campaign) => {
            if (key === 'Test Warlock' && _subKey === 'hurlThroughHellTurnUsed') return 'turn1';
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Already used this turn');
    });

    it('should return automation_info when no uses remaining and no pact slots', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((key, _subKey, _campaign) => {
            if (key === 'Test Warlock' && _subKey === 'hurlThroughHellUses') return 1;
            if (key === 'Test Warlock' && _subKey === 'warlockPactMagic') return 0;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No uses remaining');
    });

    it('should spend pact slot when no uses remaining but pact slots available', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((key, _subKey, _campaign) => {
            if (key === 'Test Warlock' && _subKey === 'hurlThroughHellUses') return 1;
            if (key === 'Test Warlock' && _subKey === 'warlockPactMagic') return 2;
            return null;
        });

        vi.mocked(getCombatContext).mockResolvedValue({
            creatures: [{ name: 'Goblin', position: { gridX: 5, gridY: 5 } }],
        });
        vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Goblin' });
        vi.mocked(buildSaveDc).mockReturnValue(14);
        vi.mocked(rollExpression).mockReturnValue({ total: 44 });
        vi.mocked(createSaveListener).mockReturnValue({ promptId: 'test-prompt' });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Hurl Through Hell');
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Warlock', 'warlockPactMagic', 1, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Warlock', 'hurlThroughHellUses', 0, 'test-campaign');
    });

    it('should have correct automation info builder output', () => {
        const { miscHandlers } = require('../../combat/automationInfoBuilder/misc.js');
        expect(miscHandlers.hurl_through_hell).toBeDefined();

        const feature = {
            name: 'Hurl Through Hell',
            automation: {
                type: 'hurl_through_hell',
                damageExpression: '8d10',
                damageType: 'Psychic',
                saveType: 'CHA',
                saveDc: 'ability',
                saveAbility: 'CHA',
                oncePerTurn: true,
                uses: 1,
                pactMagicRecharge: true,
                casting_time: 'passive',
            },
        };

        const result = miscHandlers.hurl_through_hell(feature, { proficiency: 3, abilities: [{ name: 'Charisma', bonus: 4 }] });

        expect(result.type).toBe('hurl_through_hell');
        expect(result.name).toBe('Hurl Through Hell');
        expect(result.damageExpression).toBe('8d10');
        expect(result.damageType).toBe('Psychic');
        expect(result.saveType).toBe('CHA');
        expect(result.oncePerTurn).toBe(true);
        expect(result.uses).toBe(1);
        expect(result.pactMagicRecharge).toBe(true);
        expect(result.hasAutomation).toBe(true);
    });

    it('should include hurl_through_hell in collector passives', () => {
        const { collectAutomationFromFeatures } = require('../../combat/automationCollector.js');

        const features = [{
            name: 'Hurl Through Hell',
            automation: {
                type: 'hurl_through_hell',
                damageExpression: '8d10',
                damageType: 'Psychic',
                saveType: 'CHA',
                saveDc: 'ability',
                saveAbility: 'CHA',
                oncePerTurn: true,
                uses: 1,
                pactMagicRecharge: true,
                casting_time: 'passive',
            },
        }];

        const result = collectAutomationFromFeatures(features, { proficiency: 3, abilities: [{ name: 'Charisma', bonus: 4 }] });

        expect(result.passives).toHaveLength(1);
        expect(result.passives[0].type).toBe('hurl_through_hell');
        expect(result.passives[0].name).toBe('Hurl Through Hell');
    });
});
