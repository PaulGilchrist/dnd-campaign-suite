// MA-0268: Androsphinx Roar staged resolution (roarService). RAW: 3 roars
// before a long rest, escalating — click N resolves ONLY stage N's canonical
// legs: 1 WIS fail → frightened (zero damage), 2 WIS fail → deafened AND
// frightened (zero damage), 3 CON fail → 8d10 thunder + prone / success half
// not prone. Stage state rides the MA-0020 per-day counter (monsterSpellUses,
// maxUses:3 gate refuses the 4th click). Pre-fix every click was the
// conflated union (8d10 + Deafened/Frightened/Prone) with an inert
// usage:{type:'per day'} gate. EOT re-save legs arm via the MA-0048
// repeat_save object consumed by saveProcessing → trackFrightfulPresence.
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

const monsterName = 'Androsphinx 1';
const campaignName = 'test-campaign';

function rawRoarRow() {
    const sphinx = monstersData.find(m => m.index === 'androsphinx');
    return sphinx.actions.find(a => a.name === 'Roar');
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});

describe('MA-0268 monsters.json data: Roar row arms the gate', () => {
    it('authors maxUses 3 (gate reads maxUses ?? uses), keeps usage + canonical prose', () => {
        const row = rawRoarRow();
        expect(row.maxUses).toBe(3);
        expect(row.staged_roar).toBe(true);
        expect(row.usage).toEqual({ type: 'per day', times: 3 });
        expect(row.save_dc).toBe(18);
        expect(row.save_type).toBe('Wisdom');
        expect(row.description).toMatch(/First Roar\. Each creature that fails a DC 18 Wisdom/);
        expect(row.description).toMatch(/Third Roar\. Each creature makes a DC 18 Constitution/);
    });

    it('the MA-0020 gate now fires on the row: 3 uses, exhausted at 3', () => {
        const row = rawRoarRow();
        const fresh = monsterAbilitySaveUsesGate(row, {});
        expect(fresh.maxUses).toBe(3);
        expect(fresh.remaining).toBe(3);
        expect(fresh.exhausted).toBe(false);
        expect(monsterAbilitySaveUsesGate(row, { Roar: 3 }).exhausted).toBe(true);
    });
});

describe('MA-0268 roarService stage parser/counter', () => {
    it('stage number derives from the persisted spend counter: 0→1, 1→2, 2→3, 3→null', () => {
        const row = rawRoarRow();
        expect(roarStageNumber(row, {})).toBe(1);
        expect(roarStageNumber(row, { Roar: 1 })).toBe(2);
        expect(roarStageNumber(row, { Roar: 2 })).toBe(3);
        expect(roarStageNumber(row, { Roar: 3 })).toBeNull();
    });

    it('byte-inert: non-staged rows resolve null', () => {
        expect(isStagedRoarAction({ name: 'Claw' })).toBe(false);
        expect(roarStageNumber({ name: 'Roar', save_dc: 18 }, {})).toBeNull();
        expect(resolveRoarStageAction({ action: { name: 'Roar' }, usesGate: null })).toBeNull();
    });

    it('stage overrun is loud: resolve refuses with console.error, never a phantom stage', () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const row = rawRoarRow();
        expect(resolveRoarStageAction({ action: row, usesGate: { used: 3, maxUses: 3 } })).toBeNull();
        expect(err).toHaveBeenCalledWith(expect.stringContaining('stage overrun'));
        err.mockRestore();
    });

    it('stagedRoarMaxUses falls back to 3 and reads the row maxUses', () => {
        expect(stagedRoarMaxUses(rawRoarRow())).toBe(3);
        expect(stagedRoarMaxUses({})).toBe(3);
    });
});

describe('MA-0268 per-stage action swap — canonical legs, honest surfaces', () => {
    it('stage 1: WIS, no damage, frightened only, turn-END repeat save, honest label', () => {
        const s = buildRoarStageAction(rawRoarRow(), 1);
        expect(s.name).toBe('Roar 1 of 3');
        expect(s.save_dc).toBe(18);
        expect(s.save_type).toBe('Wisdom');
        expect(s.dc_success).toBe('none');
        expect(s.damage_dice_primary).toBeNull();
        // description fallback MUST NOT re-extract the third-roar dice:
        expect(extractDamageDiceFromDescription(s.description, s.damage_dice_primary)).toBeNull();
        expect(extractConditionsFromSaveEffect(s.save_effect)).toEqual(['frightened']);
        expect(s.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    });

    it('stage 2: WIS, no damage, deafened AND frightened, repeat save, honest label', () => {
        const s = buildRoarStageAction(rawRoarRow(), 2);
        expect(s.name).toBe('Roar 2 of 3');
        expect(s.save_type).toBe('Wisdom');
        expect(s.dc_success).toBe('none');
        expect(extractDamageDiceFromDescription(s.description, s.damage_dice_primary)).toBeNull();
        expect(extractConditionsFromSaveEffect(s.save_effect).sort()).toEqual(['deafened', 'frightened']);
        expect(s.repeat_save.save_type).toBe('Wisdom');
    });

    it('stage 3: CON, 8d10 Thunder half-on-success, prone on fail, no repeat save, honest label', () => {
        const s = buildRoarStageAction(rawRoarRow(), 3);
        expect(s.name).toBe('Roar 3 of 3');
        expect(s.save_type).toBe('Constitution');
        expect(s.dc_success).toBe('half');
        expect(extractDamageDiceFromDescription(s.description, s.damage_dice_primary)).toBe('8d10');
        expect(s.damage_type_primary).toBe('Thunder');
        expect(extractConditionsFromSaveEffect(s.save_effect)).toEqual(['prone']);
        expect(s.repeat_save).toBeNull();
    });
});

describe('MA-0268 4-click escalation: spends advance the stage, 4th click refuses', () => {
    it('clicks 1-3 spend one use each with a stage-labelled log; click 4 refuses zero-prompt', async () => {
        const row = rawRoarRow();
        const stored = {};
        getRuntimeValue.mockImplementation((target, key) => (key === MONSTER_SPELL_USES_KEY ? { ...stored } : null));

        const seen = [];
        for (let click = 1; click <= 3; click++) {
            const usesGate = monsterAbilitySaveUsesGate(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
            expect(usesGate.exhausted).toBe(false);
            const stage = roarStageNumber(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
            expect(stage).toBe(click);
            const stageAction = resolveRoarStageAction({ action: row, usesGate });
            expect(stageAction.name).toBe(`Roar ${click} of 3`);
            seen.push({
                saveType: stageAction.save_type,
                dcSuccess: stageAction.dc_success,
                formula: extractDamageDiceFromDescription(stageAction.description, stageAction.damage_dice_primary),
                conditions: extractConditionsFromSaveEffect(stageAction.save_effect),
            });
            const spend = await spendMonsterAbilityUse({
                monsterName,
                use: { useKey: usesGate.useKey, maxUses: usesGate.maxUses, actionName: stageAction.name },
                targetName: 'TestPC',
                campaignName,
                deps: { getRuntimeValue, setRuntimeValue, addEntry },
            });
            expect(spend).toBe(3 - click);
            stored.Roar = click;
        }

        // canonical legs per stage:
        expect(seen[0]).toEqual({ saveType: 'Wisdom', dcSuccess: 'none', formula: null, conditions: ['frightened'] });
        expect(seen[1].formula).toBeNull();
        expect(seen[1].conditions.sort()).toEqual(['deafened', 'frightened']);
        expect(seen[2]).toEqual({ saveType: 'Constitution', dcSuccess: 'half', formula: '8d10', conditions: ['prone'] });

        // stage-labelled spend logs for every stage (§automation-log):
        const spendLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use');
        expect(spendLogs.map(l => l.abilityName)).toEqual(['Roar 1 of 3', 'Roar 2 of 3', 'Roar 3 of 3']);
        expect(spendLogs[0].description).toMatch(/1 use spent, 2 left today/);
        expect(spendLogs[2].description).toMatch(/0 left today/);

        // 4th click: gate exhausted — refusal popup + roar_refused log, no stage, no spend:
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
