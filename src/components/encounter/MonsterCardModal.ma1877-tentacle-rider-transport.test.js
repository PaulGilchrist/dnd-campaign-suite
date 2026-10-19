// @maintained-by-ai
// MA-1877: Demogorgon Tentacle save-chip TRANSPORT lock — the producer half of
// the save-gated max-HP-reduce fix. NEW transport field:
// buildAbilitySaveRollContext.saveRiderAttackDamage — the click-time snapshot
// of the same-action damage the +17 attack chip just paid (campaign
// lastAttack). REQUIRED because saveProcessing's save stamps REPLACE
// lastAttack BEFORE grant-time. Identity-gated to same attacker+target+
// action; honest 0 on miss/foreign rows; byte-inert null for every row
// without the structured save_hp_max_reduce key (#738 cites THIS file for
// byte-inert — owned claim, honored here for Cthulhu/Succubus/Gaze twins).
// Owned elsewhere (not re-pinned): saveChipPlan shape for this byte-identical
// dice-less composite rider row → ma1867:151 exact toEqual twin (plus
// ma1000:74, ma1563:44 machinery); Tentacle data/parse lock + consumer
// handling (fail pays / success zero / honest "No change" / double-pay
// closure) → saveProcessing.ma1877-demogorgon-tentacle.test.js; key parse →
// MonsterCardHelpers.ma1547-draining-kiss.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
}));

import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';
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
    ...overrides,
});

function buildContext(action = TENTACLE, monsterName = DEMOGORGON, saveType = 'CON') {
    return buildAbilitySaveRollContext({
        monsterName,
        target: TARGET,
        spellName: null,
        action,
        saveType,
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

describe('MA-1877 saveRiderAttackDamage click-time snapshot', () => {
    it('arms with the same-action damage TAKEN after the attack chip paid, identity partners intact', () => {
        runtimeStore['campaign.lastAttack'] = hitLastAttack();
        const ctx = buildContext();
        expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
        expect(ctx.saveRiderAttackDamage).toBe(30);
        // formula-less DC chip (§536 riderOnly): the rider gates ONLY, no damage pool
        expect(ctx.autoDamageFormula).toBeNull();
        expect(ctx.saveDc).toBe(23);
        expect(ctx.dcSuccess).toBe('full');

        // magnitude precedence: actualDamage (applied) → primaryDamage → raw
        runtimeStore['campaign.lastAttack'] = hitLastAttack({ actualDamage: undefined, primaryDamage: 28, rawDamage: 99 });
        expect(buildContext().saveRiderAttackDamage).toBe(28);
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

    it('byte-inert (#738 owned): rows WITHOUT the structured key never arm the transport, even with same-name damage on the books', () => {
        runtimeStore['campaign.lastAttack'] = hitLastAttack();

        // MA-1867 sibling: composite rider-only grapple row, no max-reduce key
        const cthulhu = buildContext(CTHULHU_TENTACLES, 'Cthulhu 1', 'STR');
        expect(parseSaveHpMaxReduce(CTHULHU_TENTACLES)).toBeNull();
        expect(cthulhu.saveRiderAttackDamage).toBeNull();

        // MA-1547 twin: pure-save row (attack_bonus null) — not composite, null
        expect(buildContext(SUCCUBUS_KISS, 'Succubus 1').saveRiderAttackDamage).toBeNull();

        // same-monster clauseless attack row (Gaze carries no attack_bonus/key)
        expect(buildContext(GAZE, DEMOGORGON, 'WIS').saveRiderAttackDamage).toBeNull();
    });
});
