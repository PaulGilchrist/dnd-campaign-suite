// @maintained-by-ai 2026-11-26
// attackRiderHandler.handleShieldBash save-flow lane: save-prompt shape, the DC
// resolution matrix (numeric passthrough / 'ability' delegate / formula default),
// FT-082 ordered setRuntimeValue census (stash before the save; restore+clear on
// the success seam only), full-shape ordered addEntry census (prompt row then
// outcome row, FROZEN timestamp), the expanded-Prone chooser payload (nowhere
// else pinned), oncePerTurn skip passthrough. Prerequisite refusals (shield /
// lastAttack) are owned by attackRiderHandler.shield-bash.test.js; handle()
// routing + effect dispatch by attackRiderHandler.test.js; the Charger size gate
// by attackRiderHandler.charger-size-gate.test.js; restoreBaseAttackAfterBash
// internals by services/combat/steps/features/shieldBash.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const NOW = 1_700_000_000_000;
const CAMPAIGN = 'test-campaign';

const LAST_ATTACK = { hit: true, attackerName: 'TestHero', weaponType: 'melee', targetName: 'Goblin' };

// Production SavePromptModal result shape: saveBonus + total, never bare bonus.
const SAVE_FAIL = { success: false, roll: 5, total: 5, saveBonus: 0 };
const SAVE_SUCCESS = { success: true, roll: 18, total: 18, saveBonus: 3 };

// FT-082 stash readable by the restore seam: a valid base attack (attackName
// present, not Shield Bash-shaped).
const BASE_ATTACK = { ...LAST_ATTACK, attackName: 'Longsword', damageType: 'slashing' };

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

function shieldStats() {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Strength', bonus: 2 },
            { name: 'Dexterity', bonus: 2 },
        ],
        inventory: { equipped: ['Shield'], backpack: [] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
    };
}

function setupShieldBashMocks(saveResult, stash = null) {
    getRuntimeValue.mockImplementation((_scope, key) => {
        if (key === 'lastAttack') return LAST_ATTACK;
        if (key === '_shieldBashBaseAttack') return stash;
        return null;
    });
    vi.mocked(createSaveListener).mockReturnValue({
        promptId: 'shield-bash-prompt',
        promise: Promise.resolve(saveResult),
    });
}

const stashCall = ['TestHero', '_shieldBashBaseAttack', LAST_ATTACK, CAMPAIGN];

const PROMPT_ROW = {
    type: 'roll',
    name: 'Shield Bash',
    characterName: 'TestHero',
    rollType: 'save-damage',
    targetName: 'Goblin',
    saveDc: 15,
    saveType: 'STR',
    description: 'Shield Bash: Goblin must make a STR saving throw (DC 15).',
    timestamp: NOW,
};

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler - Shield Bash save flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
        vi.mocked(buildSaveDc).mockReturnValue(15);
        vi.mocked(checkOncePerTurnWithSkip).mockResolvedValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('failed save: stashes the base attack, prompts once, logs prompt+outcome in order, opens the chooser with the expanded Prone option', async () => {
        const stats = shieldStats();
        const action = makeShieldBashAction();
        setupShieldBashMocks(SAVE_FAIL);

        const result = await handle(action, stats, CAMPAIGN, 'map');

        // FT-082: base weapon attack stashed before the save so the
        // save-resolution lastAttack clobber cannot block same-turn Hamstring;
        // the fail leg does NOT restore (chooser resolves later).
        expect(setRuntimeValue.mock.calls).toEqual([stashCall]);

        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, {
            targetName: 'Goblin',
            attackerName: 'TestHero',
            saveType: 'STR',
            saveDc: 15,
            dcSuccess: false,
            sourceName: 'Shield Bash',
        });

        // Exact two log rows, in order: prompt before the save resolves, then
        // the outcome row. Outcome-neutral copy on the fail leg ("Choose an
        // effect.") — the chooser commits/declines after this row.
        expect(addEntry.mock.calls).toEqual([
            [CAMPAIGN, PROMPT_ROW],
            [CAMPAIGN, {
                ...PROMPT_ROW,
                description: 'Goblin failed the STR save (DC 15). Choose an effect.',
                saveResult: 'failure',
                total: 5,
                rolls: [5],
                bonus: 0,
                formula: '1d20',
            }],
        ]);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'shieldBash',
            payload: {
                action: {
                    name: 'Shield Bash',
                    // empty authored options expand into the Prone chooser
                    // option (expandPushOrProneOptions, pinned nowhere else).
                    options: [{
                        name: 'Prone',
                        effect: 'prone',
                        saveType: 'STR',
                        saveDc: 15,
                        saveAbility: 'STR',
                    }],
                    automation: action.automation,
                },
                playerStats: stats,
                campaignName: CAMPAIGN,
                targetName: 'Goblin',
                saveDc: 15,
            },
        });
    });

    it('successful save: restores and clears the stashed base attack (FT-082), logs the resolved-roll outcome, returns the no-effect popup', async () => {
        const action = makeShieldBashAction();
        setupShieldBashMocks(SAVE_SUCCESS, BASE_ATTACK);

        const result = await handle(action, shieldStats(), CAMPAIGN, 'map');

        // Ordered FT-082 seam census: stash, then on the success leg only,
        // restore campaign lastAttack and clear the stash.
        expect(setRuntimeValue.mock.calls).toEqual([
            stashCall,
            ['campaign', 'lastAttack', BASE_ATTACK, CAMPAIGN],
            ['TestHero', '_shieldBashBaseAttack', null, CAMPAIGN],
        ]);

        // Outcome row (calls[1]) with the production save-result shape mapped:
        // saveBonus 3 → bonus 3 + '+3' formula. Prompt row pinned in full next door.
        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(addEntry.mock.calls[1]).toEqual([CAMPAIGN, {
            ...PROMPT_ROW,
            description: 'Goblin succeeded the STR save (DC 15).',
            saveResult: 'success',
            total: 18,
            rolls: [18],
            bonus: 3,
            formula: '1d20+3',
        }]);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Shield Bash',
                description: 'Goblin succeeded on STR save (DC 15). Shield Bash has no effect.',
                automation: action.automation,
            },
        });
    });

    it.each([
        {
            description: "'ability' delegates to buildSaveDc",
            saveDc: 'ability',
            dropStrength: false,
            expectedDc: 17,
            delegated: true,
        },
        {
            description: 'null with Strength present computes 8 + STR + proficiency',
            saveDc: null,
            dropStrength: false,
            expectedDc: 13,
            delegated: false,
        },
        {
            description: 'null with missing Strength ability falls back to DC 11',
            saveDc: null,
            dropStrength: true,
            expectedDc: 11,
            delegated: false,
        },
    ])('DC resolution: $description', async ({ saveDc, dropStrength, expectedDc, delegated }) => {
        vi.mocked(buildSaveDc).mockReturnValue(17);
        const stats = shieldStats();
        if (dropStrength) {
            stats.abilities = [{ name: 'Dexterity', bonus: 2 }];
        }
        const action = makeShieldBashAction({ automation: { saveDc } });
        setupShieldBashMocks(SAVE_FAIL);

        const result = await handle(action, stats, CAMPAIGN, 'map');

        expect(result.type).toBe('modal');
        if (delegated) {
            expect(buildSaveDc).toHaveBeenCalledTimes(1);
            expect(buildSaveDc).toHaveBeenCalledWith(action.automation, stats);
        } else {
            expect(buildSaveDc).not.toHaveBeenCalled();
        }
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ saveDc: expectedDc }));
        expect(result.payload.saveDc).toBe(expectedDc);
    });

    it('oncePerTurn skip: returns the skip popup without prompting a save, stashing, or logging', async () => {
        const skipStub = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Shield Bash',
                description: 'Shield Bash has already been used this turn. Skip?',
            },
        };
        setupShieldBashMocks(SAVE_FAIL);
        vi.mocked(checkOncePerTurnWithSkip).mockResolvedValue(skipStub);

        const result = await handle(makeShieldBashAction(), shieldStats(), CAMPAIGN, 'map');

        expect(result).toBe(skipStub);
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
