// @maintained-by-ai
// VT picker-header honesty threading (bug-vt-picker-header-claims-trip-after-save-success):
// when a Trip cast with the versatile_trickster passive finds secondary targets,
// applyRiderOption must stamp versatileTricksterPrimarySave — the resolved primary
// save outcome {success, saveType, saveDc} — alongside the VT secondary keys so the
// AttackRiderModal picker header can branch its copy (a save-SUCCESS face must never
// claim "Trip applied"). Owned elsewhere: save-success te eviction by
// attackRiderHandler.save-success-eviction.test.js; the header copy itself by
// AttackRiderModal.versatileTrickster.test.jsx. Deterministic, fully mocked, turn-based.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyRiderOption } from './attackRiderHandler.js';

// ── Mocks (mirrors attackRiderHandler.save-success-eviction.test.js) ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
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
    getCombatContext: vi.fn(),
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
    checkOncePerTurn: vi.fn().mockResolvedValue(null),
    checkOncePerTurnWithSkip: vi.fn().mockResolvedValue(null),
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
import { createSaveListener } from '../../../automation/common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

// Exact canonical 2024 Devious Strikes Trip option (public/data/2024/classes.json).
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

function makeAction() {
    return {
        name: 'Devious Strikes',
        description: 'Apply a rider effect on a hit.',
        automation: {
            type: 'attack_rider',
            options: [TRIP_OPTION],
        },
    };
}

function makeTricksterStats() {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [{ name: 'Dexterity', bonus: 2 }],
        toolProficiencies: [],
        automation: { passives: [{ type: 'passive_rule', effect: 'versatile_trickster' }] },
    };
}

function installStore() {
    getRuntimeValue.mockImplementation((_scope, key) => {
        if (key === 'targetEffects') return [];
        return null;
    });
}

// Board with a secondary VT candidate (Skeleton within 5 ft of Goblin).
function armVtScan() {
    getCombatContext.mockResolvedValue({
        creatures: [
            { name: 'Goblin', size: 'Medium' },
            { name: 'Skeleton', size: 'Medium' },
        ],
        round: 1,
        activeCreatureName: 'TestHero',
    });
}

function stubSave(saveResult) {
    createSaveListener.mockReturnValue({
        promptId: 'trip-prompt',
        promise: Promise.resolve(saveResult),
    });
}

function primarySaveWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[1] === 'versatileTricksterPrimarySave');
}

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler — versatileTricksterPrimarySave threading', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('CLA-376 entry clear also clears versatileTricksterPrimarySave', async () => {
        installStore();
        stubSave({ success: false, roll: 5, total: 7, saveBonus: 2 });
        await applyRiderOption(makeAction(), makeTricksterStats(), 'campaign', 'Goblin', ['Trip']);

        const writes = primarySaveWrites();
        expect(writes[0]).toEqual(['TestHero', 'versatileTricksterPrimarySave', null, 'campaign']);
    });

    it('save SUCCESS: VT stamp carries {success:true, saveType, saveDc} after the entry clear', async () => {
        installStore();
        armVtScan();
        stubSave({ success: true, roll: 18, total: 20, saveBonus: 2 });

        await applyRiderOption(makeAction(), makeTricksterStats(), 'campaign', 'Goblin', ['Trip']);

        const writes = primarySaveWrites();
        // Entry clear first, then the VT stamp.
        expect(writes[0][2]).toBeNull();
        expect(writes.at(-1)).toEqual(['TestHero', 'versatileTricksterPrimarySave', { success: true, saveType: 'DEX', saveDc: 15 }, 'campaign']);
        // The VT picker keys themselves are stamped (picker opens on this face).
        expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', expect.arrayContaining([expect.objectContaining({ name: 'Skeleton' })]), 'campaign');
    });

    it('save FAIL: VT stamp carries {success:false, saveType, saveDc} (applied copy stays honest)', async () => {
        installStore();
        armVtScan();
        stubSave({ success: false, roll: 5, total: 7, saveBonus: 2 });

        await applyRiderOption(makeAction(), makeTricksterStats(), 'campaign', 'Goblin', ['Trip']);

        expect(primarySaveWrites().at(-1)).toEqual(['TestHero', 'versatileTricksterPrimarySave', { success: false, saveType: 'DEX', saveDc: 15 }, 'campaign']);
    });

    it('no secondary candidate → no VT stamp (primary save outcome never written past the entry clear)', async () => {
        installStore();
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', size: 'Medium' }], round: 1 });
        stubSave({ success: true, roll: 18, total: 20, saveBonus: 2 });

        await applyRiderOption(makeAction(), makeTricksterStats(), 'campaign', 'Goblin', ['Trip']);

        const writes = primarySaveWrites();
        expect(writes).toHaveLength(1); // only the CLA-376 entry clear
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'versatileTricksterPrimaryTarget', 'Goblin', 'campaign');
    });
});
