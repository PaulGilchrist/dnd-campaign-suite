// @maintained-by-ai
// attackRiderHandler.handleShieldBash save-flow lane: save-prompt shape, DC resolution,
// FT-082 _shieldBashBaseAttack stash, save-damage outcome logging, oncePerTurn skip
// passthrough. Prerequisite refusals (shield / lastAttack) are owned by
// attackRiderHandler.shield-bash.test.js; handle() routing + effect dispatch by
// attackRiderHandler.test.js; the Charger size gate by
// attackRiderHandler.charger-size-gate.test.js; restoreBaseAttackAfterBash internals
// by services/combat/steps/features/shieldBash.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './attackRiderHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } }],
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/oncePerTurn.js', () => ({
    checkOncePerTurn: vi.fn(async () => null),
    checkOncePerTurnWithSkip: vi.fn(async () => null),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { checkOncePerTurnWithSkip } from '../../common/oncePerTurn.js';

// ── Helpers ────────────────────────────────────────────────────

const LAST_ATTACK = { hit: true, attackerName: 'TestHero', weaponType: 'melee', targetName: 'Goblin' };

function makeShieldBashAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Shield Bash',
        description: 'Push or knock prone on hit.',
        automation: {
            type: 'attack_rider',
            effect: 'push_or_prone',
            oncePerTurn: true,
            trigger: 'hit',
            saveDc: 15,
            saveType: 'STR',
            saveAbility: 'STR',
            options: [],
            ...automationOverrides,
        },
        ...rest,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Strength', bonus: 2 },
            { name: 'Dexterity', bonus: 2 },
        ],
        inventory: {
            equipped: overrides.equipped || [],
            backpack: [],
        },
        equipment: overrides.equipment || [],
        ...overrides,
    };
}

function shieldStats() {
    return makePlayerStats({
        equipped: ['Shield'],
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
    });
}

function setupShieldBashMocks(saveResult) {
    getRuntimeValue.mockImplementation((_scope, key, _camp) => {
        if (key === 'lastAttack') return LAST_ATTACK;
        return null;
    });
    vi.mocked(createSaveListener).mockReturnValue({
        promptId: 'shield-bash-prompt',
        promise: Promise.resolve(saveResult),
    });
}

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler - Shield Bash save flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkOncePerTurnWithSkip).mockResolvedValue(null);
    });

    it.each([
        {
            saveResult: { success: false, roll: 5, total: 5, saveBonus: 0 },
            expectedType: 'modal',
            description: 'failed save',
            outcomeLog: {
                saveResult: 'failure',
                total: 5,
                rolls: [5],
                bonus: 0,
                formula: '1d20',
                text: 'Goblin failed the STR save (DC 15). Shield Bash effect applied.',
            },
        },
        {
            saveResult: { success: true, roll: 18, total: 18, saveBonus: 3 },
            expectedType: 'popup',
            description: 'successful save',
            outcomeLog: {
                saveResult: 'success',
                total: 18,
                rolls: [18],
                bonus: 3,
                formula: '1d20+3',
                text: 'Goblin succeeded the STR save (DC 15).',
            },
        },
    ])('should $expectedType result on $description', async ({ saveResult, expectedType, outcomeLog }) => {
        const action = makeShieldBashAction();
        setupShieldBashMocks(saveResult);

        const result = await handle(action, shieldStats(), 'test-campaign', 'map');

        expect(result.type).toBe(expectedType);

        // FT-082 collateral: base weapon attack stashed before the save so the
        // save-resolution lastAttack clobber cannot block same-turn Hamstring.
        expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_shieldBashBaseAttack', LAST_ATTACK, 'test-campaign');

        if (expectedType === 'modal') {
            expect(result.modalName).toBe('shieldBash');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'STR',
                saveDc: 15,
                dcSuccess: false,
                sourceName: 'Shield Bash',
            });
            // Save prompt logged before the save resolves.
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                targetName: 'Goblin',
                saveType: 'STR',
                saveDc: 15,
                description: 'Shield Bash: Goblin must make a STR saving throw (DC 15).',
            }));
        } else {
            expect(result.payload.description).toBe('Goblin succeeded on STR save (DC 15). Shield Bash has no effect.');
        }

        // Save outcome logged with the resolved roll shape.
        const outcome = addEntry.mock.calls.find(c => c[1]?.saveResult === outcomeLog.saveResult);
        expect(outcome).toBeDefined();
        expect(outcome[1]).toMatchObject({
            type: 'roll',
            name: 'Shield Bash',
            characterName: 'TestHero',
            rollType: 'save-damage',
            targetName: 'Goblin',
            saveDc: 15,
            saveType: 'STR',
            total: outcomeLog.total,
            rolls: outcomeLog.rolls,
            bonus: outcomeLog.bonus,
            formula: outcomeLog.formula,
            description: outcomeLog.text,
        });
    });

    it('should delegate DC to buildSaveDc when saveDc is "ability"', async () => {
        vi.mocked(buildSaveDc).mockReturnValue(17);
        const action = makeShieldBashAction({ automation: { saveDc: 'ability' } });
        setupShieldBashMocks({ success: false, roll: 5, total: 5, saveBonus: 0 });

        const result = await handle(action, shieldStats(), 'test-campaign', 'map');

        expect(result.type).toBe('modal');
        expect(buildSaveDc).toHaveBeenCalledWith(action.automation, expect.objectContaining({ name: 'TestHero' }));
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ saveDc: 17 }));
    });

    it('should use default formula DC 11 when saveDc is null and Strength ability is missing', async () => {
        const action = makeShieldBashAction({ automation: { saveDc: null } });
        const stats = shieldStats();
        stats.abilities = [{ name: 'Dexterity', bonus: 2 }];
        setupShieldBashMocks({ success: false, roll: 5, total: 5, saveBonus: 0 });

        const result = await handle(action, stats, 'test-campaign', 'map');

        // 8 + STR bonus (absent → 0) + proficiency 3 = 11
        expect(result.type).toBe('modal');
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ saveDc: 11 }));
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            saveDc: 11,
        }));
    });

    it('should return the oncePerTurn skip result without prompting a save or stashing the base attack', async () => {
        const skipStub = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Shield Bash',
                description: 'Shield Bash has already been used this turn. Skip?',
            },
        };
        setupShieldBashMocks({ success: false, roll: 5, total: 5, saveBonus: 0 });
        vi.mocked(checkOncePerTurnWithSkip).mockResolvedValue(skipStub);

        const result = await handle(makeShieldBashAction(), shieldStats(), 'test-campaign', 'map');

        expect(result).toBe(skipStub);
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
