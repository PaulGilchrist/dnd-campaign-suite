// MA-1877: Demogorgon Tentacle save-chip TRANSPORT lock — the chip-plan +
// context half of the save-gated max-HP-reduce fix. The row is a composite
// attack+save (§117 two-chip fork): the +17 attack chip pays FULL 3d12+9
// Force ungated (MA-0551 buildAttackChipSaveOptions nulls the save keys),
// and the standalone "DC 23 Constitution" chip must stay CLICKABLE and
// formula-less (MA-1867 §536: dice-less save_effect ⇒ no damage pool ⇒
// riderOnly) — the DC chip gates ONLY the rider (§87 dc_success:"full").
// NEW transport field: buildAbilitySaveRollContext.saveRiderAttackDamage —
// the click-time snapshot of the same-action damage the attack chip just
// paid (campaign lastAttack.actualDamage/primaryDamage). REQUIRED because
// saveProcessing's save stamps REPLACE lastAttack BEFORE grant-time.
// Identity-gated to same attacker+target+action; byte-inert null for every
// row without the structured save_hp_max_reduce key (MA-1547 succubus —
// pure-save, not composite — and MA-1867 Cthulhu twin stay null).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: () => null,
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: async () => {},
    setRuntimeObject: async () => {},
}));

import {
    buildAbilitySaveRollContext,
    saveChipPlan,
    isCompositeAttackSaveRow,
} from './MonsterCardModal.jsx';
import { parseSaveHpMaxReduce } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const DEMOGORGON = 'Demogorgon 1';
const TARGET = { name: 'Bandit 1', type: 'npc' };

const TENTACLE = monstersData.find(m => m.index === 'demogorgon').actions[1];
const GAZE = monstersData.find(m => m.index === 'demogorgon').actions[2];
const CTHULHU_TENTACLES = monstersData.find(m => m.index === 'cthulhu').actions[2];
const SUCCUBUS_KISS = monstersData.find(m => m.index === 'succubus').actions[3];

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Force'];

// lastAttack exactly as the +17 attack-chip lane leaves it at DC-chip click:
// attackPostProcessing stamp (hit/attackName) MERGED with the
// storeDamageLastAttack/applyDamage merge (actualDamage/damageApplied).
const hitLastAttack = (overrides = {}) => ({
    attackerName: DEMOGORGON,
    targetName: TARGET.name,
    attackName: 'Tentacle',
    rollType: 'attack',
    hit: true,
    rawDamage: 30,
    primaryDamage: 30,
    actualDamage: 30,
    damageApplied: true,
    timestamp: Date.now(),
    ...overrides,
});

function buildContext(action = TENTACLE) {
    return buildAbilitySaveRollContext({
        monsterName: DEMOGORGON,
        target: TARGET,
        spellName: null,
        action,
        saveType: 'CON',
        dcSuccess: action.dc_success || 'half',
        saveDamageFormula: null,
        saveConditions: [],
        usesGate: null,
        prerequisite: null,
        getDamageTypesForAction,
    });
}

beforeEach(() => {
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
});

describe('MA-1877 Tentacle two-chip fork render plan', () => {
    it('composite row: riderOnly + formula-less + CLICKABLE DC chip (§536 dice-less save_effect)', () => {
        expect(isCompositeAttackSaveRow(TENTACLE)).toBe(true);
        const plan = saveChipPlan(TENTACLE, false);
        expect(plan.riderOnly).toBe(true);
        expect(plan.formula).toBeNull();
        expect(plan.rollable).toBe(false);
        expect(plan.clickable).toBe(true);
    });
});

describe('MA-1877 saveRiderAttackDamage click-time snapshot', () => {
    it('arms with the same-action damage TAKEN after the attack chip paid (finalDamage absent → actualDamage)', () => {
        runtimeStore['campaign.lastAttack'] = hitLastAttack();
        const ctx = buildContext();
        expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
        expect(ctx.saveRiderAttackDamage).toBe(30);
        expect(ctx.autoDamageFormula).toBeNull();
        expect(ctx.saveDc).toBe(23);
        expect(ctx.dcSuccess).toBe('full');
    });

    it('honest zero, never stale: miss (no damageApplied) / foreign attack / foreign attacker / no lastAttack', () => {
        runtimeStore['campaign.lastAttack'] = hitLastAttack({ damageApplied: false, hit: false });
        expect(buildContext().saveRiderAttackDamage).toBe(0);

        runtimeStore['campaign.lastAttack'] = hitLastAttack({ attackName: 'Claw' });
        expect(buildContext().saveRiderAttackDamage).toBe(0);

        runtimeStore['campaign.lastAttack'] = hitLastAttack({ attackerName: 'Other 1' });
        expect(buildContext().saveRiderAttackDamage).toBe(0);

        delete runtimeStore['campaign.lastAttack'];
        expect(buildContext().saveRiderAttackDamage).toBe(0);
    });

    it('byte-inert: rows WITHOUT the structured key never arm the transport', () => {
        runtimeStore['campaign.lastAttack'] = hitLastAttack();
        // MA-1867 sibling: composite rider-only grapple row, no max-reduce key
        const cthulhu = buildAbilitySaveRollContext({
            monsterName: 'Cthulhu 1',
            target: TARGET,
            spellName: null,
            action: CTHULHU_TENTACLES,
            saveType: 'STR',
            dcSuccess: 'half',
            saveDamageFormula: null,
            saveConditions: ['grappled'],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(parseSaveHpMaxReduce(CTHULHU_TENTACLES)).toBeNull();
        expect(cthulhu.saveRiderAttackDamage).toBeNull();

        // MA-1547 twin: pure-save row (attack_bonus null) — not composite, null
        expect(buildAbilitySaveRollContext({
            monsterName: 'Succubus 1',
            target: TARGET,
            spellName: null,
            action: SUCCUBUS_KISS,
            saveType: 'CON',
            dcSuccess: 'half',
            saveDamageFormula: null,
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        }).saveRiderAttackDamage).toBeNull();

        // same-monster clauseless attack row (Gaze carries no attack_bonus/key)
        expect(buildAbilitySaveRollContext({
            monsterName: DEMOGORGON,
            target: TARGET,
            spellName: null,
            action: GAZE,
            saveType: 'WIS',
            dcSuccess: 'half',
            saveDamageFormula: null,
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        }).saveRiderAttackDamage).toBeNull();
    });
});
