// MA-1718: Wight "Life Drain" (actions[3], DC 13 Constitution, 5 ft) —
// FAIL(a)/DATA fixed at the data layer: the row authors
// save_hp_max_reduce:{equal_to:"damage"} so the LIVE MA-1547 save-path drain
// seam (parseSaveHpMaxReduce → buildAbilitySaveRollContext.saveHpMaxReduce →
// saveProcessing.applySaveDamage → hpMaxReduceService.applyHpMaxReduce) arms
// on this row: a failed save reduces the victim's max HP by the FULL applied
// necrotic damage, a successful save by the HALF-floored finalDamage only
// (dc_success default "half"). Succubus Draining Kiss byte-shape twin —
// structured key placed right after save_type, prose never parsed (MA-1547/
// MA-1489 structured-key-only precedent). MonsterCardHelpers.ma1652 twin.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const runtimeStore = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));
const storageSet = vi.fn();
vi.mock('../../services/ui/storage.js', () => ({
    default: { set: (...args) => storageSet(...args), get: vi.fn(() => null) },
}));
const registerTargetEffect = vi.fn();
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', async (importActual) => ({
    ...(await importActual()),
    registerTargetEffect: (...args) => registerTargetEffect(...args),
}));
import { parseSaveHpMaxReduce, parseSaveAttackerRecover } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const WIGHT = monsters.find((m) => m.index === 'wight');
const LIFE_DRAIN = WIGHT.actions[3];
const SUCCUBUS_KISS = monsters.find((m) => m.index === 'succubus').actions[3];

describe('MA-1718 disk fingerprint: wight Life Drain save row', () => {
    it('keeps the adjudication bytes unchanged (DC 13 CON, 5 ft, prose intact)', () => {
        expect(LIFE_DRAIN.name).toBe('Life Drain');
        expect(LIFE_DRAIN.save_dc).toBe(13);
        expect(LIFE_DRAIN.save_type).toBe('Constitution');
        expect(LIFE_DRAIN.range).toBe('5 feet');
        expect(LIFE_DRAIN.description).toContain("Failure: 6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken.");
    });

    it('authors save_hp_max_reduce:{equal_to:"damage"} right after save_type (succubus byte-shape parity)', () => {
        expect(LIFE_DRAIN.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
        expect(SUCCUBUS_KISS.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
        const keys = Object.keys(LIFE_DRAIN);
        expect(keys.indexOf('save_hp_max_reduce')).toBe(keys.indexOf('save_type') + 1);
    });

    it('leaves dc_success unauthored — RAW half-on-success rides the engine half default', () => {
        expect(LIFE_DRAIN.dc_success).toBeUndefined();
    });
});

describe('MA-1718 parsers arm the wight row through the live MA-1547 seam', () => {
    it('parseSaveHpMaxReduce arms equal_to damage', () => {
        expect(parseSaveHpMaxReduce(LIFE_DRAIN)).toEqual({ equalTo: 'damage' });
    });

    it('save_attacker_recover stays inert (no wight regain clause on disk)', () => {
        expect(LIFE_DRAIN.save_attacker_recover).toBeUndefined();
        expect(parseSaveAttackerRecover(LIFE_DRAIN)).toBeNull();
    });

    it('block-save context arms saveHpMaxReduce for both faces', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Wight 1',
            target: { name: 'Bandit 1', type: 'npc' },
            spellName: null,
            action: LIFE_DRAIN,
            saveType: 'CON',
            dcSuccess: LIFE_DRAIN.dc_success ?? 'half',
            saveDamageFormula: '1d8 + 2',
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction: () => ['Necrotic'],
        });
        expect(ctx.saveDc).toBe(13);
        expect(ctx.dcSuccess).toBe('half');
        expect(ctx.autoDamageFormula).toBe('1d8 + 2');
        expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
        expect(ctx.saveAttackerRecover).toBeNull();
    });
});

describe('MA-1718 consumer ledger: applyHpMaxReduce drains max by damage taken on both faces', () => {
    it('fail face: 7 damage → max 11→4; success face: half 2 → max 4→2 accumulate', async () => {
        const { applyHpMaxReduce } = await import('../../services/rules/features/hpMaxReduceService.js');
        const logs = [];
        const logEntry = (e) => logs.push(e);
        const cs = { creatures: [{ name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, currentHitPoints: 11, maxHitPoints: 11 }] };
        const target = { name: 'Bandit 1', type: 'npc' };

        const failLedger = await applyHpMaxReduce({ attackName: 'Life Drain', target, damage: 7, combatSummary: cs, characters: [], campaignName: 'test-campaign', attackerName: 'Wight 1', logEntry, saveOutcome: 'failure' });
        expect(failLedger).toEqual({ baseMax: 11, reduced: 7, max: 4 });
        expect(cs.creatures[0].maxHp).toBe(4);
        expect(cs.creatures[0].maxHitPoints).toBe(4);
        expect(cs.creatures[0].currentHp).toBe(4);
        expect(registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Bandit 1', 'hp_max_reduce', 'Wight 1', { baseMax: 11, reduced: 7, max: 4, duration: 'until_long_rest' });

        runtimeStore['campaign.targetEffects'] = [{ target: 'Bandit 1', effect: 'hp_max_reduce', source: 'Wight 1', baseMax: 11, reduced: 7, max: 4 }];
        const okLedger = await applyHpMaxReduce({ attackName: 'Life Drain', target, damage: 2, combatSummary: cs, characters: [], campaignName: 'test-campaign', attackerName: 'Wight 1', logEntry, saveOutcome: 'success' });
        expect(okLedger).toEqual({ baseMax: 11, reduced: 9, max: 2 });
        expect(cs.creatures[0].maxHp).toBe(2);

        const reduceLogs = logs.filter(e => e.automationType === 'hp_max_reduce');
        expect(reduceLogs.length).toBe(2);
        expect(reduceLogs[0].description).toMatch(/failed the save/i);
        expect(reduceLogs[1].description).toMatch(/succeeded the save/i);
    });
});
