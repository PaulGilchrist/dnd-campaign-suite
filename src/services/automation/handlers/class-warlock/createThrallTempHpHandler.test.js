// @maintained-by-ai
// CLA-066 Create Thrall temp-HP lane. Deterministic handler composition: feature-marker
// detection (including the flat 2024 majors/subclass shapes), keyword expression math
// (canonical: warlock level + CHA modifier), aberration companion lookup, and this
// handler's own popup/log copy. tempHpService is intentionally REAL so replace-if-larger
// wiring on the canonical 'tempHp' runtime key is pinned end-to-end here; the buffs-lane
// tempHpBuffHandler cluster owns the generic popup copy. No game timers (turn-based only).
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './createThrallTempHpHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
    const { name: actionName, ...automationOverrides } = overrides;
    return {
        name: actionName || 'Create Thrall',
        automation: { type: 'create_thrall', ...automationOverrides },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWarlock',
        level: 14,
        class: {
            class_levels: [{ features: [{ name: 'Create Thrall' }] }],
        },
        abilities: [
            { name: 'Strength', bonus: 4 },
            { name: 'Dexterity', bonus: 3 },
            { name: 'Constitution', bonus: 5 },
            { name: 'Intelligence', bonus: 2 },
            { name: 'Wisdom', bonus: 3 },
            { name: 'Charisma', bonus: 5 },
        ],
        ...overrides,
    };
}

// Combat with one Aberrant Spirit companion and no existing temp HP.
function stubCompanionContext(name = 'Aberrant Spirit') {
    damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name }],
    });
    runtimeState.getRuntimeValue.mockReturnValue(0);
}

describe('createThrallTempHpHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('feature detection', () => {
        // Each entry supplies the marker under test in its RAW storage location;
        // every other marker list is empty so detection can only succeed via that shape.
        const emptyClass = { class_levels: [{ features: [] }] };

        it.each([
            ['class.class_levels feature name', {
                class: { class_levels: [{ features: [{ name: 'Create Thrall' }] }] },
            }],
            ['subclass.class_levels feature name', {
                class: {
                    ...emptyClass,
                    subclass: { class_levels: [{ features: [{ name: 'Create Thrall' }] }] },
                },
            }],
            ['flat subclass.features (CLA-066)', {
                class: {
                    ...emptyClass,
                    subclass: { name: 'The Great Old', features: [{ name: 'Create Thrall' }] },
                },
            }],
            ['flat class.major.features (CLA-066)', {
                class: {
                    ...emptyClass,
                    major: { features: [{ name: 'Create Thrall' }] },
                },
            }],
            ['automation.specialActions type marker', {
                class: emptyClass,
                automation: { specialActions: [{ type: 'create_thrall' }] },
            }],
            ['automation.passives effect marker', {
                class: emptyClass,
                automation: { passives: [{ effect: 'create_thrall_temp_hp' }] },
            }],
            ['marker object type in class list', {
                class: { class_levels: [{ features: [{ type: 'create_thrall' }] }] },
            }],
            ['marker object effect in class list', {
                class: { class_levels: [{ features: [{ effect: 'create_thrall_temp_hp' }] }] },
            }],
        ])('detects the feature via %s', async (_label, statsOverrides) => {
            stubCompanionContext();

            const result = await handle(makeAction(), makePlayerStats(statsOverrides), campaignName);

            expect(result.type).toBe('popup');
        });

        it.each([
            ['empty feature lists', {
                class: {
                    class_levels: [{ features: [] }],
                    subclass: { class_levels: [{ features: [] }] },
                },
            }],
            ['no class structure', {}],
        ])('should return null when %s', async (_label, statsOverrides) => {
            const result = await handle(
                makeAction(),
                { name: 'TestWarlock', ...statsOverrides },
                campaignName
            );

            expect(result).toBeNull();
            // Detection short-circuits before combat context resolution.
            expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
        });
    });

    describe('temp HP expression evaluation', () => {
        it('should evaluate the default expression as warlock level + CHA modifier', async () => {
            stubCompanionContext();

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            // lv14 + CHA 5 = 19 (CLA-066: no (level-1)/2 fold)
            expect(result.payload.description).toBe(
                'Create Thrall: Aberrant Spirit gains 19 Temporary Hit Points.'
            );
        });

        it.each([
            ['warlock level', 'warlock level + CHA modifier'],
            ['warlock_level underscore', 'warlock_level + CHA modifier'],
            ['bare level', 'level + CHA modifier'],
            ['lowercase charisma modifier', 'warlock level + charisma modifier'],
        ])('should evaluate expression with "%s" keyword variant', async (_label, expression) => {
            stubCompanionContext();

            const result = await handle(
                makeAction({ tempHpExpression: expression }),
                makePlayerStats(),
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('19 Temporary Hit Points');
        });

        it.each([
            ['literal negative', '-5', undefined],
            ['negative via substituted CHA modifier', 'warlock level + CHA modifier',
                { abilities: [{ name: 'Charisma', bonus: -20 }] }],
        ])('should clamp to zero and return null for %s', async (_label, expression, statsOverrides) => {
            const result = await handle(
                makeAction({ tempHpExpression: expression }),
                makePlayerStats(statsOverrides),
                campaignName
            );

            expect(result).toBeNull();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should return null when expression evaluates to NaN', async () => {
            const result = await handle(
                makeAction({ tempHpExpression: '0 / 0' }),
                makePlayerStats(),
                campaignName
            );

            expect(result).toBeNull();
            expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
        });

        it('should fall back to diceRoller when expression syntax is invalid', async () => {
            stubCompanionContext();
            diceRoller.rollExpression.mockReturnValue({ total: 7 });

            const result = await handle(
                makeAction({ tempHpExpression: 'this is not valid JS' }),
                makePlayerStats(),
                campaignName
            );

            expect(diceRoller.rollExpression).toHaveBeenCalledWith('this is not valid JS');
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Create Thrall: Aberrant Spirit gains 7 Temporary Hit Points.'
            );
        });
    });

    describe('combat context resolution', () => {
        it.each([
            ['no combat context available', null],
            ['no companion matching aberration found', { creatures: [{ name: 'Goblin' }, { name: 'Skeleton' }] }],
            ['creatures with null or undefined names', { creatures: [{ name: null }, { name: undefined }, { name: 'Goblin' }] }],
        ])('should return null when %s', async (_label, context) => {
            damageUtils.getCombatContext.mockResolvedValue(context);
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should find companion by case-insensitive "aberration" substring', async () => {
            stubCompanionContext('my aberration friend');

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('my aberration friend');
        });
    });

    describe('temp HP application', () => {
        it('should apply temp HP and return popup when companion found', async () => {
            stubCompanionContext('Aberrant Spirit Companion');

            const result = await handle(
                makeAction({ tempHpExpression: '10' }),
                makePlayerStats(),
                campaignName
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Create Thrall',
                    description: 'Create Thrall: Aberrant Spirit Companion gains 10 Temporary Hit Points.',
                    automation: { type: 'create_thrall', tempHpExpression: '10' },
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit Companion',
                'tempHp',
                10,
                campaignName
            );
        });

        it('should keep higher existing temp HP and stay quiet (no popup, no log)', async () => {
            stubCompanionContext();
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const result = await handle(
                makeAction({ tempHpExpression: '3' }),
                makePlayerStats(),
                campaignName
            );

            expect(result).toBeNull();
            expect(logService.addEntry).not.toHaveBeenCalled();
            // replace-if-larger via real tempHpService: re-stamps 5, never accumulates
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit',
                'tempHp',
                5,
                campaignName
            );
        });

        it('should set new temp HP when it exceeds existing', async () => {
            stubCompanionContext();
            runtimeState.getRuntimeValue.mockReturnValue(3);

            const result = await handle(
                makeAction({ tempHpExpression: '7' }),
                makePlayerStats(),
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Aberrant Spirit',
                'tempHp',
                7,
                campaignName
            );
        });
    });

    describe('logging', () => {
        it('should add campaign log entry with correct details', async () => {
            stubCompanionContext('Aberration Companion');

            await handle(
                makeAction({ tempHpExpression: '5' }),
                makePlayerStats(),
                campaignName
            );

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWarlock',
                abilityName: 'Create Thrall',
                description: 'Create Thrall: Aberration Companion gains 5 Temporary Hit Points.',
                timestamp: expect.any(Number),
            }));
        });

        it('should use custom action name in log entry', async () => {
            stubCompanionContext();

            await handle(
                makeAction({ name: 'Custom Thrall' }),
                makePlayerStats(),
                campaignName
            );

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'Custom Thrall',
                description: 'Custom Thrall: Aberrant Spirit gains 19 Temporary Hit Points.',
            }));
        });
    });
});
