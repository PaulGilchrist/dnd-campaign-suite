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
    createSaveListener: vi.fn(() => ({
        promptId: 'shield-bash-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5, saveBonus: 0 }),
    })),
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

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler - Shield Bash (push_or_prone + oncePerTurn)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkOncePerTurnWithSkip).mockResolvedValue(null);
    });

    describe('prerequisites - shield check', () => {
        it.each([
            [{ equipped: [], equipment: [] }, 'no equipped items'],
            [{ equipped: ['Longsword', 'Chain Mail'], equipment: [{ name: 'Longsword', armor_category: 'Light Armor' }, { name: 'Chain Mail', armor_category: 'Medium Armor' }] }, 'equipped items that are not shields'],
            [{ equipped: ['Shield'], equipment: [{ name: 'Shield', armor_category: 'Shield' }] }, 'standard shield'],
            [{ equipped: ['Tower Shield'], equipment: [{ name: 'Tower Shield', equipment_category: 'Shield' }] }, 'tower shield via equipment_category'],
            [{ equipped: ['+1 Shield'], equipment: [{ name: 'Shield', armor_category: 'Shield' }] }, 'magic shield (parsed base name)'],
        ])('should %s', async (config, description) => {
            const action = makeShieldBashAction();
            const stats = makePlayerStats(config);
            const isShield = description.startsWith('standard') || description.startsWith('tower') || description.startsWith('magic');
            getRuntimeValue.mockImplementation((_scope, key, _camp) => {
                if (key === 'lastAttack') return { hit: true, attackerName: 'TestHero', weaponType: 'melee', targetName: 'Goblin' };
                return null;
            });

            const result = await handle(action, stats, 'test-campaign', 'map');

            if (isShield) {
                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('shieldBash');
            } else {
                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('Shield Bash requires an equipped shield');
            }
        });
    });

    describe('prerequisites - lastAttack validation', () => {
        it.each([
            [null, 'Shield Bash requires a hit'],
            [{ hit: false, attackerName: 'TestHero', weaponType: 'melee', targetName: 'Goblin' }, 'Shield Bash requires a hit'],
        ])('should return popup when lastAttack is %j', async (lastAttack, expectedText) => {
            const action = makeShieldBashAction();
            const stats = makePlayerStats({
                equipped: ['Shield'],
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            getRuntimeValue.mockImplementation((_scope, key, _camp) => {
                if (key === 'lastAttack') return lastAttack;
                return null;
            });

            const result = await handle(action, stats, 'test-campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain(expectedText);
        });

        it('should return popup when lastAttack.attackerName does not match player', async () => {
            const action = makeShieldBashAction();
            const stats = makePlayerStats({
                equipped: ['Shield'],
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            getRuntimeValue.mockImplementation((_scope, key, _camp) => {
                if (key === 'lastAttack') return { hit: true, attackerName: 'Orc', weaponType: 'melee', targetName: 'Goblin' };
                return null;
            });

            const result = await handle(action, stats, 'test-campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('your own melee weapon attack');
        });

        it('should return popup when lastAttack.weaponType is not melee', async () => {
            const action = makeShieldBashAction();
            const stats = makePlayerStats({
                equipped: ['Shield'],
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            getRuntimeValue.mockImplementation((_scope, key, _camp) => {
                if (key === 'lastAttack') return { hit: true, attackerName: 'TestHero', weaponType: 'ranged', targetName: 'Goblin' };
                return null;
            });

            const result = await handle(action, stats, 'test-campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('melee weapon attack');
        });

    });
});
