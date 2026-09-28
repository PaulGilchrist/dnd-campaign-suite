// MA-1502: Sphinx of Valor "Roar" launcher — row-authored staged roar payload.
// Pre-fix the row was ['name','description','uses'] ONLY with uses:"3/Day"
// STRING (Number()=NaN → no gate) and no staged_roar key → byte-inert prose
// launcher (zero affordance, zero enforcement; §949 fingerprint). The fix
// reuses the MA-0268 canonical staged-roar path, generalized via a
// ROW-AUTHORED structured `roar_stages[]` payload (§88 rays[] / §MA-1436
// variants[] convention) carrying Valor's own DC 20 ladder prose:
//   stage 1 (WIS DC 20): fail → frightened 1 minute, ZERO damage;
//   stage 2 (WIS DC 20): fail → paralyzed 1 minute + prose repeat-save clause
//     (turn-END repeater §70 GM-enforced — repeat_save:null on purpose, the
//     MA-0048 fallback arms the frightened FP te and would over-grant);
//   stage 3 (CON DC 20): fail → 8d10 thunder + prone / success half.
// Androsphinx byte-inertia: its disk row carries NO roar_stages key and
// keeps resolving from the hardcoded ROAR_STAGES default table.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import monstersData from '../../../../public/data/monsters.json';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import {
    isStagedRoarAction,
    roarStageNumber,
    buildRoarStageAction,
    resolveRoarStageAction,
    stagedRoarMaxUses,
} from './roarService.js';
import {
    monsterAbilitySaveUsesGate,
    spendMonsterAbilityUse,
    MONSTER_SPELL_USES_KEY,
    buildAbilitySaveRefusalPopup,
    buildAbilitySaveRefusalLog,
} from '../../encounters/monsterAbilityUses.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import { extractDamageDiceFromDescription } from '../../../components/encounter/MonsterCardModal.jsx';

const monsterName = 'Sphinx of Valor 1';
const campaignName = 'test-campaign';

function valorRoarRow() {
    return monstersData.find(m => m.index === 'sphinx-of-valor').actions.find(a => a.name === 'Roar');
}

function androsphinxRoarRow() {
    return monstersData.find(m => m.index === 'androsphinx').actions.find(a => a.name === 'Roar');
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});

describe('MA-1502 monsters.json data: Valor Roar launcher arms the staged gate', () => {
    it('numeric uses:3 + maxUses:3 (NaN-string regression locked), staged_roar:true, DC 20', () => {
        const row = valorRoarRow();
        expect(typeof row.uses).toBe('number');
        expect(row.uses).toBe(3);
        expect(row.maxUses).toBe(3);
        expect(row.staged_roar).toBe(true);
        expect(row.save_dc).toBe(20);
        expect(row.usage).toEqual({ type: 'per day', times: 3 });
        // §MA-1436: row-level fields stay stage-neutral (union prose, first-stage save).
        expect(row.save_type).toBe('Wisdom');
        expect(row.range).toBe('500-foot Emanation');
    });

    it('roar_stages[] is authored 3-deep DC 20 withValor per-stage legs in the payload', () => {
        const stages = valorRoarRow().roar_stages;
        expect(Array.isArray(stages)).toBe(true);
        expect(stages.length).toBe(3);
        expect(stages.map(s => s.save_dc)).toEqual([20, 20, 20]);
        expect(stages.map(s => s.save_type)).toEqual(['Wisdom', 'Wisdom', 'Constitution']);
        expect(stages.map(s => s.dc_success)).toEqual(['none', 'none', 'half']);
        expect(stages[2].damage_dice_primary).toBe('8d10');
        expect(stages[2].damage_type_primary).toBe('Thunder');
        // §67: stage texts carry ONLY their own condition words.
        expect(extractConditionsFromSaveEffect(stages[0].save_effect)).toEqual(['frightened']);
        expect(extractConditionsFromSaveEffect(stages[1].save_effect)).toEqual(['paralyzed']);
        expect(extractConditionsFromSaveEffect(stages[2].save_effect)).toEqual(['prone']);
        expect(extractDamageDiceFromDescription(stages[0].description, stages[0].damage_dice_primary)).toBeNull();
        expect(extractDamageDiceFromDescription(stages[1].description, stages[1].damage_dice_primary)).toBeNull();
        expect(extractDamageDiceFromDescription(stages[2].description, stages[2].damage_dice_primary)).toBe('8d10');
    });

    it('the NaN-string fingerprint is gone: gate now fires numerically, exhausted at 3', () => {
        const row = valorRoarRow();
        // regression lock: the OLD shape (uses:"3/Day") produced NO gate at all
        expect(monsterAbilitySaveUsesGate({ name: 'Roar', save_dc: 20, uses: '3/Day' }, {})).toBeNull();
        const fresh = monsterAbilitySaveUsesGate(row, {});
        expect(fresh.maxUses).toBe(3);
        expect(fresh.remaining).toBe(3);
        expect(monsterAbilitySaveUsesGate(row, { Roar: 3 }).exhausted).toBe(true);
    });

    it('sibling First/Second/Third Roar rows stay on disk UNTOUCHED (coexist, step-5)', () => {
        const actions = monstersData.find(m => m.index === 'sphinx-of-valor').actions;
        const first = actions.find(a => a.name === 'First Roar');
        const second = actions.find(a => a.name === 'Second Roar');
        const third = actions.find(a => a.name === 'Third Roar');
        expect(first.save_dc).toBe(20);
        expect(first.save_effect).toBe('The target has the Frightened condition for 1 minute.');
        expect(second.save_effect).toMatch(/Paralyzed condition and repeats the save/);
        expect(third.save_type).toBe('Constitution');
    });
});

describe('MA-1502 row-authored stage resolution (payload beats default table)', () => {
    it('stage 1: WIS DC 20, zero damage, frightened only, no repeat_save, honest label', () => {
        const s = buildRoarStageAction(valorRoarRow(), 1);
        expect(s.name).toBe('First Roar (1 of 3)');
        expect(s.save_dc).toBe(20);
        expect(s.save_type).toBe('Wisdom');
        expect(s.dc_success).toBe('none');
        expect(s.damage_dice_primary).toBeNull();
        expect(s.damage_type_primary).toBeNull();
        expect(extractDamageDiceFromDescription(s.description, s.damage_dice_primary)).toBeNull();
        expect(extractConditionsFromSaveEffect(s.save_effect)).toEqual(['frightened']);
        expect(s.repeat_save).toBeNull();
    });

    it('stage 2: WIS, zero damage, paralyzed only, repeat_save NOT armed (frightened-FP fallback barred)', () => {
        const s = buildRoarStageAction(valorRoarRow(), 2);
        expect(s.name).toBe('Second Roar (2 of 3)');
        expect(s.save_type).toBe('Wisdom');
        expect(s.dc_success).toBe('none');
        expect(s.damage_dice_primary).toBeNull();
        expect(extractConditionsFromSaveEffect(s.save_effect)).toEqual(['paralyzed']);
        expect(s.repeat_save).toBeNull();
    });

    it('stage 3: CON, 8d10 Thunder half-on-success, prone, no repeat_save, honest label', () => {
        const s = buildRoarStageAction(valorRoarRow(), 3);
        expect(s.name).toBe('Third Roar (3 of 3)');
        expect(s.save_type).toBe('Constitution');
        expect(s.dc_success).toBe('half');
        expect(s.damage_dice_primary).toBe('8d10');
        expect(s.damage_type_primary).toBe('Thunder');
        expect(extractConditionsFromSaveEffect(s.save_effect)).toEqual(['prone']);
    });

    it('stage 4 is unresolvable — resolve is loud, never a phantom stage', () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(resolveRoarStageAction({ action: valorRoarRow(), usesGate: { used: 3, maxUses: 3 } })).toBeNull();
        expect(err).toHaveBeenCalledWith(expect.stringContaining('stage overrun'));
        err.mockRestore();
    });
});

describe('MA-1502 4-click escalation on the launcher: spends advance the stage, 4th refuses', () => {
    it('clicks 1-3 spend one use each with stage-labelled logs; click 4 refuses zero-prompt', async () => {
        const row = valorRoarRow();
        const stored = {};
        getRuntimeValue.mockImplementation((target, key) => (key === MONSTER_SPELL_USES_KEY ? { ...stored } : null));
        expect(isStagedRoarAction(row)).toBe(true);
        expect(stagedRoarMaxUses(row)).toBe(3);

        const seen = [];
        for (let click = 1; click <= 3; click++) {
            const usesGate = monsterAbilitySaveUsesGate(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
            expect(usesGate.exhausted).toBe(false);
            expect(roarStageNumber(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY))).toBe(click);
            const stageAction = resolveRoarStageAction({ action: row, usesGate });
            expect(['First Roar (1 of 3)', 'Second Roar (2 of 3)', 'Third Roar (3 of 3)'][click - 1]).toBe(stageAction.name);
            seen.push({
                saveType: stageAction.save_type,
                dcSuccess: stageAction.dc_success,
                formula: extractDamageDiceFromDescription(stageAction.description, stageAction.damage_dice_primary),
                conditions: extractConditionsFromSaveEffect(stageAction.save_effect),
            });
            const spend = await spendMonsterAbilityUse({
                monsterName,
                use: { useKey: usesGate.useKey, maxUses: usesGate.maxUses, actionName: stageAction.name },
                campaignName,
                deps: { getRuntimeValue, setRuntimeValue, addEntry },
            });
            expect(spend).toBe(3 - click);
            stored.Roar = click;
        }

        expect(seen[0]).toEqual({ saveType: 'Wisdom', dcSuccess: 'none', formula: null, conditions: ['frightened'] });
        expect(seen[1]).toEqual({ saveType: 'Wisdom', dcSuccess: 'none', formula: null, conditions: ['paralyzed'] });
        expect(seen[2]).toEqual({ saveType: 'Constitution', dcSuccess: 'half', formula: '8d10', conditions: ['prone'] });

        const spendLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use');
        expect(spendLogs.map(l => l.abilityName)).toEqual(['First Roar (1 of 3)', 'Second Roar (2 of 3)', 'Third Roar (3 of 3)']);
        expect(spendLogs[0].description).toMatch(/1 use spent, 2 left today/);
        expect(spendLogs[2].description).toMatch(/0 left today/);

        const finalGate = monsterAbilitySaveUsesGate(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
        expect(finalGate.exhausted).toBe(true);
        addEntry.mockClear();
        expect(roarStageNumber(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY))).toBeNull();
        await addEntry(campaignName, buildAbilitySaveRefusalLog({ monsterName, useKey: finalGate.useKey, maxUses: finalGate.maxUses }));
        expect(String(buildAbilitySaveRefusalPopup({ monsterName, useKey: finalGate.useKey, maxUses: finalGate.maxUses }))).toContain('Uses Exhausted');
        const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'roar_refused');
        expect(refusal.description).toMatch(/already used Roar today \(3\/Day\)/);
    });
});

describe('MA-1502 androsphinx byte-inertia: default table stays, disk row untouched', () => {
    it('androsphinx disk row carries NO roar_stages key and NO numeric uses (byte-for-byte)', () => {
        const row = androsphinxRoarRow();
        expect(row.roar_stages).toBeUndefined();
        expect(row.uses).toBeUndefined();
        expect(row.maxUses).toBe(3);
        expect(row.staged_roar).toBe(true);
        expect(row.save_dc).toBe(18);
    });

    it('stage swap outputs identical to the MA-0268 canonical table (no payload override)', () => {
        const s1 = buildRoarStageAction(androsphinxRoarRow(), 1);
        expect(s1.name).toBe('Roar 1 of 3');
        expect(s1.save_type).toBe('Wisdom');
        expect(s1.dc_success).toBe('none');
        expect(s1.damage_dice_primary).toBeNull();
        expect(s1.damage_type_primary).toBeNull();
        expect(s1.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
        expect(extractConditionsFromSaveEffect(s1.save_effect)).toEqual(['frightened']);

        const s2 = buildRoarStageAction(androsphinxRoarRow(), 2);
        expect(s2.name).toBe('Roar 2 of 3');
        expect([...extractConditionsFromSaveEffect(s2.save_effect)].sort()).toEqual(['deafened', 'frightened']);

        const s3 = buildRoarStageAction(androsphinxRoarRow(), 3);
        expect(s3.name).toBe('Roar 3 of 3');
        expect(s3.save_type).toBe('Constitution');
        expect(s3.dc_success).toBe('half');
        expect(s3.damage_dice_primary).toBe('8d10');
        expect(s3.damage_type_primary).toBe('Thunder');
        expect(s3.repeat_save).toBeNull();
    });

    it('isStagedRoarAction gate unchanged: only staged_roar===true rows qualify (§949)', () => {
        expect(isStagedRoarAction({ name: 'Roar', uses: 3 })).toBe(false);
        expect(isStagedRoarAction({ name: 'Roar', roar_stages: [{ save_dc: 20 }] })).toBe(false);
        expect(isStagedRoarAction({ name: 'Roar', staged_roar: true })).toBe(true);
    });
});
