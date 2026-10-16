// CLA-384 dispatch lane: Warping Implosion ships type 'save_attack' in prod
// data, so the generic save_attack handler always won and the dedicated
// warping_implosion handler was unreachable — resolveHandler's fingerprint
// branch (index.js L692-698: type save_attack + resourceCost 'sorcery_points'
// + truthy restoreCost) must steer it to handleWarpingImplosion.
//
// Registry QUINTET lane #1998 (map: index.mistyWanderer.test.js header, #1995
// closed 4 KEEP law — seam map verified against index.js 2026-10-16: route
// branch L692-698, registration row L462, prod row classes.json(2024)
// Sorcerer→majors[0] Aberrant Sorcery→features[5] verbatim here, no drift).
// THIS lane owns EXCLUSIVELY the save_attack fingerprint route:
//   • fingerprint discrimination MATRIX (L692 strict table): both keys →
//     warping handler; sorcery_points ALONE / restoreCost ALONE / wrong
//     resourceCost value / falsy restoreCost → HANDLER_MAP['save_attack']
//     generic (L699). Mutation-kills pinned on BOTH legs: deleting
//     `&& auto.restoreCost` from the branch breaks the sorcery_points-alone
//     leg; deleting `auto.resourceCost === 'sorcery_points'` breaks the
//     restoreCost-alone legs. This is a fix-fingerprint class branch (a key
//     combo identifying a reconstructed save_attack action), not a type lane.
//   • uniqueness claim verified against disk (prod comment L695-696): exactly
//     ONE row across public/data/2024/classes.json + public/data/classes.json
//     matches the fingerprint. Partial siblings (dragon_wings carries the full
//     resource pair, clockwork_cavalcade/attack_rider carry restoreCost) all
//     have their own type keys → never enter this branch. 5e /data carries no
//     Warping Implosion feature at all (2024-only, not pending wiring).
//   • registration row L462 (warping_implosion: handleWarpingImplosion, same
//     module-scope identity → same mock here) is registration-symmetry honesty:
//     ZERO prod rows declare type 'warping_implosion' (scanned), so the
//     fingerprint route is the ONLY live path in prod; the map row is live
//     only if a row ever stamps that type (synthetic pin included).
//   • LIVE chain verified 2026-10-16: the verbatim row (casting_time '1
//     action', action 'action', no crit trigger) routes via automationRouter
//     routeSaveStyle L19-26 → actions bucket → CharActions.jsx click →
//     useCharActionsAutomation handleAutomationAction → executeHandler L448
//     (5-arg forward WITH characters; second test pins both arities —
//     handler consumes 4 params, 5th forward is arity-benign fidelity) →
//     fingerprint route L692-698 → invoke L743 → result pass-through L744 →
//     modalMap.warpingImplosion L301 (CLA-384 consumer registration) →
//     WarpingImplosionModal, which imports applyWarpingImplosion DIRECTLY
//     (confirm lane never re-enters the registry).
// Shed: generic save_attack table mechanics, null early-outs (L703-705,
// L738-740), error-catch popup (L745-748) → #1997 index.test.js MAIN;
// auto_effect→effect route + controlled_chaos null sibling → #1996; misty
// prefer-branch → #1995; web_area_save row family → #1999. Handler internals
// (SP restore gate, uses ledger, refusal logs, te marker, popup/log
// composition) → handlers/class-sorcerer/warpingImplosionHandler.test.js —
// registry-side shape only here. No timers; turn-based row-click dispatch
// only; test-campaign only; both handlers mocked → zero side effects.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';
import classes2024 from '../../../public/data/2024/classes.json';
import classes5e from '../../../public/data/classes.json';

vi.mock('./handlers/combat/saveAttackHandler.js', () => ({
    handle: vi.fn(async () => ({ type: 'popup', payload: { type: 'automation_info', name: 'GENERIC' } })),
}));

vi.mock('./handlers/class-sorcerer/warpingImplosionHandler.js', () => ({
    handle: vi.fn(async () => ({ type: 'modal', modalName: 'warpingImplosion', payload: { teleportRange: 120, restoreCost: 5 } })),
    applyWarpingImplosion: vi.fn(),
}));

const { handle: handleSaveAttack } = await import('./handlers/combat/saveAttackHandler.js');
const { handle: handleWarpingImplosion } = await import('./handlers/class-sorcerer/warpingImplosionHandler.js');

const playerStats = { name: 'AberrantSorcerer', level: 18 };

// Verbatim public/data/2024/classes.json → Sorcerer → majors 'Aberrant
// Sorcery' → features 'Warping Implosion' automation (L11069-11090;
// sorcery_points + restoreCost 5 fingerprint lives here on disk).
const IMPLOSION_ROW = {
    type: 'save_attack',
    action: 'action',
    casting_time: '1 action',
    damage: '3d10',
    damageType: 'Force',
    saveType: 'STR',
    saveDc: 'ability',
    saveAbility: 'CHA',
    shape: 'emanation_30ft',
    range: '30_ft',
    uses: 1,
    recharge: 'long_rest',
    resourceCost: 'sorcery_points',
    restoreCost: 5,
    hasOptions: true,
    optionDetails: {
        _Warping_Implosion_option: {
            damage: '3d10',
            shape: 'emanation_30ft',
            range: '30_ft',
        },
    },
};

// Mirrors the prod branch predicate (L692) for the disk-uniqueness scan.
const matchesFingerprint = (a) => a.type === 'save_attack' && a.resourceCost === 'sorcery_points' && Boolean(a.restoreCost);

function automationRows(doc) {
    const rows = [];
    (function walk(node) {
        if (Array.isArray(node)) {
            node.forEach(walk);
        } else if (node && typeof node === 'object') {
            const autos = Array.isArray(node.automation) ? node.automation : [node.automation];
            for (const auto of autos) {
                if (auto && typeof auto === 'object') rows.push(auto);
            }
            Object.values(node).forEach(walk);
        }
    })(doc);
    return rows;
}

describe('executeHandler — save_attack sorcery_points+restoreCost fingerprint (CLA-384, lane #1998)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prod row: verbatim Aberrant Sorcery automation carries the fingerprint, and it is unique across both ruleset files', () => {
        const aberrant = classes2024.find(c => c.name === 'Sorcerer').majors.find(m => m.name === 'Aberrant Sorcery');
        expect(aberrant.features.find(f => f.name === 'Warping Implosion').automation).toEqual(IMPLOSION_ROW);

        // Uniqueness claim (prod comment L695-696): one match in 2024, zero in 5e.
        expect(automationRows(classes2024).filter(matchesFingerprint)).toEqual([IMPLOSION_ROW]);
        expect(automationRows(classes5e).filter(matchesFingerprint)).toEqual([]);

        // Partial-fingerprint siblings never enter the branch — they all
        // carry non-save_attack type keys (their own HANDLER_MAP rows).
        const partialSiblings = automationRows([...classes2024, ...classes5e])
            .filter(a => !matchesFingerprint(a) && (a.resourceCost === 'sorcery_points' || a.restoreCost != null));
        expect(partialSiblings.every(a => a.type !== 'save_attack')).toBe(true);
        expect(partialSiblings.map(a => a.type).sort()).toEqual(['attack_rider', 'bastion_of_law', 'clockwork_cavalcade', 'dragon_wings', 'dragon_wings', 'reaction_bonus']);
    });

    it('routes the verbatim fingerprint row: exact-args invoke + full-string modal pass-through', async () => {
        const action = { name: 'Warping Implosion', automation: IMPLOSION_ROW };

        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        // Action identity forwarded; characters undefined (4-arg caller —
        // arity benign, prod handler consumes 4 params).
        expect(handleWarpingImplosion).toHaveBeenCalledTimes(1);
        expect(handleWarpingImplosion).toHaveBeenCalledWith(action, playerStats, 'test-campaign', null, undefined);
        expect(handleSaveAttack).not.toHaveBeenCalled();
        expect(result).toEqual({ type: 'modal', modalName: 'warpingImplosion', payload: { teleportRange: 120, restoreCost: 5 } });
    });

    it('5-arg forward: live caller shape (characters object) reaches the handler intact', async () => {
        const action = { name: 'Warping Implosion', automation: IMPLOSION_ROW };
        const characters = [{ name: 'AberrantSorcerer' }];

        await executeHandler(action, playerStats, 'test-campaign', 'battlemap', characters);

        expect(handleWarpingImplosion).toHaveBeenCalledWith(action, playerStats, 'test-campaign', 'battlemap', characters);
        expect(handleSaveAttack).not.toHaveBeenCalled();
    });

    it('fingerprint matrix: every key combo SHORT of the full fingerprint falls through to generic save_attack (both mutation legs pinned)', async () => {
        const fingerprint = { ...IMPLOSION_ROW };
        const sorceryAlone = { ...IMPLOSION_ROW }; delete sorceryAlone.restoreCost;
        const restoreAlone = { ...IMPLOSION_ROW }; delete restoreAlone.resourceCost;
        const wrongResource = { ...IMPLOSION_ROW, resourceCost: 'ki_points' };
        const falsyCost = { ...IMPLOSION_ROW, restoreCost: 0 };

        const MATRIX = [
            { name: 'both keys (full fingerprint)', automation: fingerprint, warping: true },
            // Mutation leg A: dropping `&& auto.restoreCost` routes this to
            // warping → fail.
            { name: 'sorcery_points alone (restoreCost key absent)', automation: sorceryAlone, warping: false },
            // Mutation leg B: dropping `auto.resourceCost === 'sorcery_points'`
            // routes these to warping → fail.
            { name: 'restoreCost alone (resourceCost key absent)', automation: restoreAlone, warping: false },
            { name: 'wrong resourceCost value + restoreCost', automation: wrongResource, warping: false },
            { name: 'truthy guard: restoreCost 0', automation: falsyCost, warping: false },
        ];

        for (const { name, automation, warping } of MATRIX) {
            vi.clearAllMocks();
            const result = await executeHandler({ name: 'Warping Implosion', automation }, playerStats, 'test-campaign', null);

            if (warping) {
                expect(handleWarpingImplosion, name).toHaveBeenCalledTimes(1);
                expect(handleSaveAttack, name).not.toHaveBeenCalled();
                expect(result.modalName, name).toBe('warpingImplosion');
            } else {
                expect(handleSaveAttack, name).toHaveBeenCalledTimes(1);
                expect(handleWarpingImplosion, name).not.toHaveBeenCalled();
                expect(result.payload.name, name).toBe('GENERIC');
            }
        }
    });

    it('prod control: a fingerprintless verbatim save_attack row (Intimidating Presence) still dispatches generic', async () => {
        const genericRow = automationRows(classes2024).find(a => a.type === 'save_attack' && !a.resourceCost && a.restoreCost == null);
        expect(genericRow).toBeDefined();

        const result = await executeHandler({ name: 'Intimidating Presence', automation: genericRow }, playerStats, 'test-campaign', null);

        expect(handleSaveAttack).toHaveBeenCalledTimes(1);
        expect(handleWarpingImplosion).not.toHaveBeenCalled();
        expect(result.payload.name).toBe('GENERIC');
    });

    it('registration symmetry L462: zero prod rows declare type warping_implosion; the map row shares the route branch handler identity', async () => {
        // Symmetry honesty: warping_implosion: handleWarpingImplosion (L462)
        // has ZERO direct producers — the fingerprint route is the only live
        // path in prod — but both land on the SAME handler binding.
        for (const doc of [classes2024, classes5e]) {
            expect(automationRows(doc).filter(a => a.type === 'warping_implosion')).toEqual([]);
        }

        const synthetic = { name: 'Warping Implosion', automation: { type: 'warping_implosion', casting_time: '1 action' } };
        const result = await executeHandler(synthetic, playerStats, 'test-campaign', null);

        expect(handleWarpingImplosion).toHaveBeenCalledTimes(1);
        expect(handleSaveAttack).not.toHaveBeenCalled();
        expect(result.modalName).toBe('warpingImplosion');
    });
});
