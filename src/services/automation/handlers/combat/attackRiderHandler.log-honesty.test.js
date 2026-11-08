// @maintained-by-ai
// attackRiderHandler LOG-HONESTY lane (bug-attack-rider-log-claims-applied-on-
// declined-or-saved): rider-save log rows must state what actually happened.
//  - Shield Bash pre-chooser outcome row stays OUTCOME-NEUTRAL on the fail leg
//    ("Choose an effect.") — the Push/Prone/Skip chooser resolves AFTER the row
//    is written, so it must never claim "effect applied" before the player may
//    still Skip; the chooser's own commit/decline rows (applyShieldBashEffect,
//    pinned by services/combat/steps/features/shieldBash.test.js) are the only
//    effect-outcome claims.
//  - handleRiderSave ability_use row branches its LEAD on the save outcome:
//    "attempted on" on save SUCCESS (descriptor row evicted, nothing landed —
//    mirrors the honest 8d818b3bc buildVersatileTricksterDescription branch),
//    "applied to" only on save FAILURE. The VT secondary twin row is pinned in
//    versatileTricksterHandler.test.js. Routing/eviction internals stay owned
//    by attackRiderHandler.test.js / .save-flow.test.js /
//    .save-success-eviction.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyRiderOption } from './attackRiderHandler.js';

// ── Mocks (superset of the sibling save-flow/eviction harnesses) ──

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
        round: 1,
        activeCreatureName: 'TestHero',
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/oncePerTurn.js', () => ({
    checkOncePerTurn: vi.fn(async () => null),
    checkOncePerTurnWithSkip: vi.fn(async () => null),
    markOncePerTurn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./massFearHandler.js', () => ({
    resolveMassFear: vi.fn(async () => ({ type: 'popup', payload: {} })),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

const LAST_ATTACK = { hit: true, attackerName: 'TestHero', weaponType: 'melee', targetName: 'Goblin' };

function stubSave(saveResult) {
    createSaveListener.mockReturnValue({
        promptId: 'log-honesty-prompt',
        promise: Promise.resolve(saveResult),
    });
}

function logRows() {
    return addEntry.mock.calls.map(c => c[1]);
}

// ── Face 1: Shield Bash pre-chooser row ────────────────────────

function makeShieldBashAction() {
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
        },
    };
}

function shieldStats() {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 2 }],
        inventory: { equipped: ['Shield'], backpack: [] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
    };
}

describe('attackRiderHandler — log honesty (declined/saved faces)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Shield Bash save-outcome row (handler lane)', () => {
        it('failed-save row stays outcome-neutral — never claims the effect was applied (Skip may follow)', async () => {
            getRuntimeValue.mockImplementation((_scope, key) =>
                key === 'lastAttack' ? LAST_ATTACK : null
            );
            stubSave({ success: false, roll: 7, total: -2, saveBonus: -9 });

            const result = await handle(makeShieldBashAction(), shieldStats(), 'test-campaign', 'map');

            // The Push/Prone chooser only opens AFTER this row is written.
            expect(result).toMatchObject({ type: 'modal', modalName: 'shieldBash' });

            const outcome = logRows().find(r => r.saveResult === 'failure');
            expect(outcome).toBeDefined();
            expect(outcome.description).toBe('Goblin failed the STR save (DC 15). Choose an effect.');
            expect(outcome.description).not.toMatch(/applied/i);
        });

        it('successful-save row keeps its already-honest copy (adjacent-behavior pin)', async () => {
            getRuntimeValue.mockImplementation((_scope, key) =>
                key === 'lastAttack' ? LAST_ATTACK : null
            );
            stubSave({ success: true, roll: 18, total: 18, saveBonus: 3 });

            await handle(makeShieldBashAction(), shieldStats(), 'test-campaign', 'map');

            const outcome = logRows().find(r => r.saveResult === 'success');
            expect(outcome.description).toBe('Goblin succeeded the STR save (DC 15).');
        });
    });

    // ── Face 2: Cunning Strike rider-save ability_use row ──────

    // Exact canonical 2024 Cunning Strike Trip option (public/data/2024/classes.json).
    const TRIP_OPTION = {
        name: 'Trip',
        cost: '1d6',
        effect: 'prone',
        saveType: 'DEX',
        saveDc: 'ability',
        saveAbility: 'DEX',
        condition: 'prone',
        sizeLimit: 'large_or_smaller',
    };

    function makeTripAction() {
        return {
            name: 'Cunning Strike',
            description: 'Apply a rider effect on a hit.',
            automation: { type: 'attack_rider', options: [TRIP_OPTION] },
        };
    }

    function makePlayerStats() {
        return {
            name: 'TestHero',
            proficiency: 3,
            abilities: [{ name: 'Dexterity', bonus: 2 }],
            toolProficiencies: [],
            automation: { passives: [] },
        };
    }

    function installTargetEffectStore() {
        const store = { targetEffects: [], activeConditions: null };
        getRuntimeValue.mockImplementation((scope, key) => {
            if (scope === 'campaign' && key === 'targetEffects') return store.targetEffects;
            if (key === 'activeConditions') return store.activeConditions;
            return null;
        });
        setRuntimeValue.mockImplementation(async (scope, key, value) => {
            if (scope === 'campaign' && key === 'targetEffects') store.targetEffects = value;
            if (key === 'activeConditions') store.activeConditions = value;
        });
        return store;
    }

    function riderAudit() {
        return logRows().find(r =>
            r.type === 'ability_use' && r.abilityName === 'Cunning Strike' && /save \(DC/.test(r.description || '')
        );
    }

    describe('handleRiderSave ability_use row branches its lead on the save outcome', () => {
        it('save SUCCESS reads "attempted on … succeeded — no effect" — never "applied to"', async () => {
            installTargetEffectStore();
            stubSave({ success: true, roll: 9, total: 11, saveBonus: 2 });

            await applyRiderOption(makeTripAction(), makePlayerStats(), 'test-campaign', 'Goblin', ['Trip']);

            const audit = riderAudit();
            expect(audit).toBeDefined();
            expect(audit.description).toBe(
                'Trip attempted on Goblin — Goblin rolled 9 on DEX save (DC 15), succeeded — no effect'
            );
            expect(audit.description).not.toMatch(/applied to/);
        });

        it('save FAILURE keeps the "applied to … condition applied" bytes (nothing declined here)', async () => {
            installTargetEffectStore();
            stubSave({ success: false, roll: 5, total: 7, saveBonus: 2 });

            await applyRiderOption(makeTripAction(), makePlayerStats(), 'test-campaign', 'Goblin', ['Trip']);

            const audit = riderAudit();
            expect(audit.description).toBe(
                'Trip applied to Goblin — Goblin rolled 5 on DEX save (DC 15), failed — prone condition applied'
            );
        });
    });
});
