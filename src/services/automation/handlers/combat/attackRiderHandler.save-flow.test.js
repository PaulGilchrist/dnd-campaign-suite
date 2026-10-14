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

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';
import { checkOncePerTurnWithSkip } from '../../common/oncePerTurn.js';

// ── Helpers ────────────────────────────────────────────────────

function makeShieldBashAction(overrides = {}) {
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
            ...overrides.automation,
        },
        ...overrides,
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

function setupShieldBashMocks(saveResult) {
    getRuntimeValue.mockImplementation((_scope, key, _camp) => {
        if (key === 'lastAttack') return { hit: true, attackerName: 'TestHero', weaponType: 'melee', targetName: 'Goblin' };
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
        [{ success: false, roll: 5, total: 5, saveBonus: 0 }, 'modal', 'failed save'],
        [{ success: true, roll: 18, total: 18, saveBonus: 3 }, 'popup', 'successful save'],
    ])('should return %s on %s', async (saveResult, expectedType, _description) => {
        const action = makeShieldBashAction();
        const stats = makePlayerStats({
            equipped: ['Shield'],
            equipment: [{ name: 'Shield', armor_category: 'Shield' }],
        });
        setupShieldBashMocks(saveResult);

        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe(expectedType);
        if (expectedType === 'modal') {
            expect(result.modalName).toBe('shieldBash');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
                saveType: 'STR',
                saveDc: 15,
                dcSuccess: false,
                sourceName: 'Shield Bash',
            }));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                targetName: 'Goblin',
                saveType: 'STR',
                saveDc: 15,
            }));
            const entry = addEntry.mock.calls.find(c => c[1]?.saveResult === (saveResult.success ? 'success' : 'failure'));
            expect(entry).toBeDefined();
        } else {
            expect(result.payload.description).toContain('succeeded on STR save');
            expect(result.payload.description).toContain('no effect');
        }
    });

    it('should use default formula DC 11 when Strength ability is missing', async () => {
        const action = makeShieldBashAction({
            automation: {
                effect: 'push_or_prone',
                oncePerTurn: true,
                trigger: 'hit',
                saveDc: null,
                saveType: 'STR',
                saveAbility: 'STR',
                options: [],
            },
        });
        const stats = makePlayerStats({
            proficiency: 3,
            abilities: [{ name: 'Dexterity', bonus: 2 }],
            equipped: ['Shield'],
            equipment: [{ name: 'Shield', armor_category: 'Shield' }],
        });
        getRuntimeValue.mockImplementation((_scope, key, _camp) => {
            if (key === 'lastAttack') return { hit: true, attackerName: 'TestHero', weaponType: 'melee', targetName: 'Goblin' };
            return null;
        });
        setupShieldBashMocks({ success: false, roll: 5, total: 5, saveBonus: 0 });

        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('modal');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            saveDc: 11,
        }));
    });
});
