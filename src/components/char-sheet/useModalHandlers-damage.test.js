// @maintained-by-ai 2026-11-28
// Damage lane of useModalHandlers (lane split #357): divine fury / generic / modifier /
// enhanced-unarmed choice-skip handlers + the no-pending gate table. Registry contract and
// handleMasteryClose live in useModalHandlers.test.js; consumers' wiring is mocked there.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

// Services the damage lane calls directly — controllable, deterministic values.
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
    // Hook destructures this at module load for the flurry lane (not exercised here).
    getCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    // Imported by live-graph savePrompt.js / openHandTechniqueHandler.js (never called here).
    getRuntimeValue: vi.fn(),
}));

// Non-damage deps imported at module level by useModalHandlers.js — or reached through the
// live openHandTechniqueHandler/conditionSaveService registry chain. Runtime-probed: removing
// these mocks (or the `handle`/`getTargetFromAttacker` keys) fails at import or via the
// feature registry, so each supplied name is load-required even though the damage lane
// never calls them.
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    // Imported by live-graph openHandTechniqueHandler.js (lazy binding, never called here).
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
    applyConstellationOption: vi.fn(),
    handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
    applyConstellationOption: vi.fn(),
    handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/bonusAttacksHandler.js', () => ({
    applyFlurryOfBlows: vi.fn(),
    handle: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

function createDeps(overrides = {}) {
    const modalState = {};
    return {
        playerStats: { name: 'TestFighter', ...overrides.playerStats },
        campaignName: 'test-campaign',
        pendingDamage: null,
        proceedWithDamage: vi.fn(),
        setPendingDamage: vi.fn(),
        setModalState: vi.fn((updates) => Object.assign(modalState, updates)),
        modalState,
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('useModalHandlers - damage type handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentCombatRound.mockReturnValue(4);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
    });

    describe('gate refusals (no pending damage)', () => {
        it.each([
            ['handleDivineFuryDamageType', 'divineFuryChoice'],
            ['handleDivineFurySkip', 'divineFuryChoice'],
            ['handleGenericDamageTypeChoice', 'damageTypeChoice'],
            ['handleGenericDamageTypeSkip', 'damageTypeChoice'],
            ['handleDamageTypeModifierChoice', 'damageTypeChoice'],
            ['handleDamageTypeModifierSkip', 'damageTypeChoice'],
            ['handleEnhancedUnarmedChoice', 'damageTypeChoice'],
            ['handleEnhancedUnarmedSkip', 'damageTypeChoice'],
        ])('%s closes its modal but never proceeds or records anything', (handlerName, modalKey) => {
            const deps = createDeps();
            useModalHandlers(deps)[handlerName]('Radiant');
            expect(deps.setModalState).toHaveBeenCalledWith({ [modalKey]: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    // Divine Fury and the generic once-per-turn handler share one merge shape: append
    // 'bonusExpr [chosenType.toLowerCase()]', add totals/rolls, spend one runtime key.
    // Divine Fury hardcodes its key; the generic handler spends pending.oncePerTurnKey.
    describe('bonus-dice choice handlers (Divine Fury + generic)', () => {
        it.each([
            ['handleDivineFuryDamageType', 'divineFuryChoice', undefined, '_divineFuryUsedRound'],
            ['handleGenericDamageTypeChoice', 'damageTypeChoice', '_DivineStrike_usedRound', '_DivineStrike_usedRound'],
        ])('%s appends the bonus dice with lowercased type, records the used round on %s, then proceeds with combined damage', (handlerName, modalKey, oncePerTurnKey, expectedUsedKey) => {
            const pending = {
                attack: { name: 'Fury of the Gods' },
                formula: '2d6',
                total: 7,
                rolls: [3, 4],
                modifier: 1,
                bonusExpr: '1d6',
                bonusTotal: 3,
                bonusRolls: [3],
                ...(oncePerTurnKey ? { oncePerTurnKey } : {}),
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps)[handlerName]('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', expectedUsedKey, 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ [modalKey]: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '2d6 + 1d6 [thunder]',
                total: 10,
                rolls: [3, 4, 3],
                modifier: 1,
            });
        });

        it('generic choice still applies combined damage but spends nothing when oncePerTurnKey is absent', () => {
            const pending = {
                attack: { name: 'Extra Damage' },
                formula: '1d6',
                total: 5,
                rolls: [5],
                modifier: 0,
                bonusExpr: '1d6',
                bonusTotal: 3,
                bonusRolls: [3],
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleGenericDamageTypeChoice('Fire');
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d6 + 1d6 [fire]',
                total: 8,
                rolls: [5, 3],
                modifier: 0,
            });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('bonus-dice skip handlers (Divine Fury + generic)', () => {
        it.each([
            ['handleDivineFurySkip', 'divineFuryChoice', '1d8+3', [5, 5], 3],
            ['handleGenericDamageTypeSkip', 'damageTypeChoice', '1d6', [5], 0],
        ])('%s proceeds with the untouched original damage — never peeking the bonus fields — and records no used round', (handlerName, modalKey, formula, rolls, modifier) => {
            const pending = {
                attack: { name: 'Skipped Attack' },
                formula,
                total: rolls.reduce((a, b) => a + b, 0) + modifier,
                rolls,
                modifier,
                bonusExpr: '1d8',
                bonusTotal: 4,
                bonusRolls: [4],
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps)[handlerName]();
            expect(deps.setModalState).toHaveBeenCalledWith({ [modalKey]: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula,
                total: pending.total,
                rolls,
                modifier,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleDamageTypeModifierChoice', () => {
        // Guard-table pair (#1348): two pendings differing ONLY in _damageTypeModifier
        // presence, fed the SAME multi-annotation formula, must produce DIFFERING outputs.
        // The bracket rewrite is legal only alongside the modifier spend — absence means
        // nothing was spent, so the displayed label stays byte-untouched (the pre-fix
        // defect rewrote '[bludgeoning]' to the chosen type while spending nothing).
        it('rewrites only the first annotation, lowercases attack.damageType, and spends the derived key ONLY when _damageTypeModifier is present', () => {
            const formula = '1d12+3 [bludgeoning] + 3d6 [fire]';
            const makePending = (modifier) => ({
                attack: { name: 'Unarmed Strike', damageType: 'bludgeoning' },
                formula,
                total: 31,
                rolls: [31],
                modifier: 3,
                ...(modifier ? { _damageTypeModifier: modifier } : {}),
            });

            // Absent modifier: pre-fix defect rewrote the first bracket while nothing was spent.
            const absent = makePending(null);
            const depsAbsent = createDeps({ pendingDamage: absent });
            useModalHandlers(depsAbsent).handleDamageTypeModifierChoice('Radiant');
            expect(absent.attack.damageType).toBe('bludgeoning');
            expect(depsAbsent.setPendingDamage).toHaveBeenCalledWith(null);
            expect(depsAbsent.proceedWithDamage).toHaveBeenCalledWith({
                attack: absent.attack,
                formula,
                total: 31,
                rolls: [31],
                modifier: 3,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();

            // Present modifier: first annotation only is rewritten, second stays, key spent.
            const present = makePending({ name: 'Empowered Strikes' });
            const depsPresent = createDeps({ pendingDamage: present });
            useModalHandlers(depsPresent).handleDamageTypeModifierChoice('Radiant');
            expect(present.attack.damageType).toBe('radiant');
            expect(depsPresent.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(depsPresent.setPendingDamage).toHaveBeenCalledWith(null);
            expect(depsPresent.proceedWithDamage).toHaveBeenCalledWith({
                attack: present.attack,
                formula: '1d12+3 [radiant] + 3d6 [fire]',
                total: 31,
                rolls: [31],
                modifier: 3,
            });
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Empowered_Strikes_usedRound', 4, 'test-campaign');
        });
    });

    describe('handleDamageTypeModifierSkip', () => {
        it('spends the derived runtime key but leaves damage type and formula untouched', () => {
            const pending = {
                attack: { name: 'Empowered Strikes', damageType: 'slashing' },
                formula: '1d8 [slashing]',
                total: 5,
                rolls: [5],
                modifier: 0,
                _damageTypeModifier: { name: 'Empowered Strikes' },
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleDamageTypeModifierSkip();
            expect(pending.attack.damageType).toBe('slashing');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Empowered_Strikes_usedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d8 [slashing]',
                total: 5,
                rolls: [5],
                modifier: 0,
            });
        });
    });

    describe('handleEnhancedUnarmedChoice', () => {
        it.each([
            ['annotates the option damageType', 'force', '1d4 + 1d4 [force]'],
            ['falls back to same_as_weapon when option omits damageType', undefined, '1d4 + 1d4 [same_as_weapon]'],
        ])('rolls the damage_bonus rider and merges it — %s', (_label, damageType, expectedFormula) => {
            const pending = {
                attack: { name: 'Unarmed Strike' },
                formula: '1d4',
                total: 5,
                rolls: [5],
                rider: 'rider-ctx',
                _attackRider: {
                    name: 'Unarmed Fighting',
                    options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType }],
                },
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleEnhancedUnarmedChoice('Damage Bonus');
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Unarmed_Fighting_usedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: expectedFormula,
                total: 8,
                rolls: [5, 3],
                modifier: 'rider-ctx',
            });
        });

        it.each([
            ['no _attackRider on pending', null, 'Damage Bonus', undefined],
            ['chosen option not found', { name: 'Unarmed Fighting', options: [{ name: 'Other Option', effect: 'other' }] }, 'Nonexistent Option', undefined],
            ['option exists but effect is not damage_bonus', { name: 'Unarmed Fighting', options: [{ name: 'Other Option', effect: 'other' }] }, 'Other Option', undefined],
            ['rollExpression returns null', { name: 'Unarmed Fighting', options: [{ name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }] }, 'Damage Bonus', null],
        ])('falls back to the original unmodified payload when %s', (_label, rider, chosen, rollResult) => {
            const pending = {
                attack: { name: 'Unarmed Strike' },
                formula: '1d4',
                total: 5,
                rolls: [5],
                rider: 'rider-ctx',
                _attackRider: rider,
            };
            if (rollResult === null) {
                rollExpression.mockReturnValue(null);
            }
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleEnhancedUnarmedChoice(chosen);
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: 'rider-ctx',
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleEnhancedUnarmedSkip', () => {
        it('spends the rider runtime key and passes the original payload through with its rider modifier', () => {
            const pending = {
                attack: { name: 'Unarmed Strike' },
                formula: '1d4',
                total: 5,
                rolls: [5],
                rider: 'rider-ctx',
                _attackRider: { name: 'Unarmed Fighting' },
            };
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps).handleEnhancedUnarmedSkip();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Unarmed_Fighting_usedRound', 4, 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: '1d4',
                total: 5,
                rolls: [5],
                modifier: 'rider-ctx',
            });
        });
    });

    describe('skip handlers with no spendable marker', () => {
        it.each([
            ['handleDamageTypeModifierSkip', { attack: { name: 'Some Attack', damageType: 'fire' }, formula: '1d8', total: 5, rolls: [5], modifier: 0 }],
            ['handleEnhancedUnarmedSkip', { attack: { name: 'Unarmed Strike' }, formula: '1d4', total: 5, rolls: [5], rider: 'no-rider' }],
        ])('%s proceeds with the untouched payload (rider passthrough as modifier) and spends nothing when the marker is absent', (handlerName, pending) => {
            const deps = createDeps({ pendingDamage: pending });
            useModalHandlers(deps)[handlerName]();
            expect(deps.setModalState).toHaveBeenCalledWith({ damageTypeChoice: null });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: pending.attack,
                formula: pending.formula,
                total: pending.total,
                rolls: pending.rolls,
                modifier: pending.rider ?? pending.modifier,
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
