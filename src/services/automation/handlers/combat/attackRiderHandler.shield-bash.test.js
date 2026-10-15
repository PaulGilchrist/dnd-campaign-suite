// @maintained-by-ai
// attackRiderHandler.handleShieldBash prerequisite-refusal lane: shield equip
// check (hasEquippedShield — armor_category / equipment_category / magic
// base-name via the real parseMagicItemName), the full lastAttack guard
// family (absent / miss / wrong attacker / ranged / no target), and refusal
// no-side-effect guards (no save prompt, no FT-082 stash, shield check
// short-circuits before any runtime read). Save-prompt args, DC math, log
// shapes and FT-082 stash-on-pass are owned by
// attackRiderHandler.save-flow.test.js; handle() routing + effect dispatch by
// attackRiderHandler.test.js; the Charger size gate by
// attackRiderHandler.charger-size-gate.test.js.
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

// Default save resolves FAIL so prerequisite-pass legs land on the
// shieldBash modal; save-flow outcomes are pinned in save-flow.test.js.
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

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';
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

function mockLastAttack(lastAttack = LAST_ATTACK) {
    getRuntimeValue.mockImplementation((_scope, key, _camp) => {
        if (key === 'lastAttack') return lastAttack;
        return null;
    });
}

function refusalPopup(description) {
    return { type: 'automation_info', name: 'Shield Bash', description };
}

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler - Shield Bash prerequisites', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkOncePerTurnWithSkip).mockResolvedValue(null);
    });

    describe('shield equip check (hasEquippedShield)', () => {
        it.each([
            { description: 'no equipped items', equipped: [], equipment: [], pass: false },
            { description: 'equipped items that are not shields', equipped: ['Longsword', 'Chain Mail'], equipment: [{ name: 'Longsword', armor_category: 'Light Armor' }, { name: 'Chain Mail', armor_category: 'Medium Armor' }], pass: false },
            { description: 'standard shield', equipped: ['Shield'], equipment: [{ name: 'Shield', armor_category: 'Shield' }], pass: true },
            { description: 'tower shield via equipment_category', equipped: ['Tower Shield'], equipment: [{ name: 'Tower Shield', equipment_category: 'Shield' }], pass: true },
            { description: 'magic shield (parsed base name)', equipped: ['+1 Shield'], equipment: [{ name: 'Shield', armor_category: 'Shield' }], pass: true },
        ])('should $description', async ({ equipped, equipment, pass }) => {
            mockLastAttack();

            const result = await handle(makeShieldBashAction(), makePlayerStats({ equipped, equipment }), 'test-campaign', 'map');

            if (pass) {
                // Prerequisites satisfied → save flow reached (save-flow.test.js
                // pins the prompt args and modal payload).
                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('shieldBash');
            } else {
                expect(result.type).toBe('popup');
                expect(result.payload).toEqual(refusalPopup('Shield Bash requires an equipped shield.'));
                // Shield check is local-only: short-circuits before any runtime
                // read, save prompt, or FT-082 stash.
                expect(getRuntimeValue).not.toHaveBeenCalled();
                expect(createSaveListener).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalled();
            }
        });
    });

    describe('lastAttack guards', () => {
        it.each([
            { name: 'absent', lastAttack: null, reason: 'Shield Bash requires a hit with a melee weapon attack.' },
            { name: 'a miss', lastAttack: { ...LAST_ATTACK, hit: false }, reason: 'Shield Bash requires a hit with a melee weapon attack.' },
            { name: "another creature's attack", lastAttack: { ...LAST_ATTACK, attackerName: 'Orc' }, reason: 'Shield Bash requires your own melee weapon attack.' },
            { name: 'a ranged attack', lastAttack: { ...LAST_ATTACK, weaponType: 'ranged' }, reason: 'Shield Bash requires a melee weapon attack.' },
            { name: 'missing a targetName', lastAttack: { hit: true, attackerName: 'TestHero', weaponType: 'melee' }, reason: 'Shield Bash: no target found.' },
        ])('should return popup when lastAttack is $name', async ({ lastAttack, reason }) => {
            mockLastAttack(lastAttack);

            const result = await handle(makeShieldBashAction(), shieldStats(), 'test-campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload).toEqual(refusalPopup(reason));
            // Guard refuses before prompting a save or stashing the base attack.
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
