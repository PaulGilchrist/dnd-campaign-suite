// CLA-320 dispatch lane: Soulknife Psychic Teleportation ships as an
// auto_effect row (no type-level handler key exists — HANDLER_MAP has no
// 'auto_effect' entry), so resolveHandler's effect-route branch
// (index.js L686-691) must steer auto_effect/psychic_teleportation to
// handlePsychicTeleportation or the Bonus Actions row returns null and the
// Psionic Energy pool is untouched.
//
// Registry QUINTET lane #1996 (map: index.mistyWanderer.test.js header, #1995
// closed 2 KEEP law — seam map verified against index.js 2026-10-16: route
// branch L686-691, registration row L457, map matches, no drift).
// THIS lane owns EXCLUSIVELY the auto_effect→effect route:
//   • production row: public/data/2024/classes.json Rogue → majors Soulknife →
//     features 'Soul Blades' automation[1] (verbatim here; 5e /data carries
//     none — 2024-only). LIVE chain verified 2026-10-16: automationRouter
//     routePassiveUnlessPsychicTeleport (automationRouter.js L80-85) buckets
//     the auto_effect half into automation.bonusActions (categorization owned
//     by automationCollector.types.test.js L329 — cited, not re-pinned) →
//     CharBonusActions findPsychicTeleportationAuto L510-514 renders
//     PsychicTeleportationRow L422-431, whose click forwards
//     { name, description, automation: <auto_effect row> } — SINGLE object,
//     so executeHandler's array scan never sees the sibling auto_reroll half —
//     → useCharActionsAutomation handleAutomationAction L276 → executeHandler
//     L448 (5-arg forward with characters; here 4-arg, characters undefined —
//     arity benign, the handler consumes 4 params) → route branch L686-691 →
//     invoke L743 → result pass-through L744 → popup.
//   • HANDLER_MAP L457 (psychic_teleportation: handlePsychicTeleportation,
//     same function identity) is registration symmetry: ZERO prod data rows
//     declare type 'psychic_teleportation' (scanned below in both ruleset
//     files), so the route branch is the ONLY live path to the handler.
//   • exact-effect-key discrimination vs the route's siblings — sibling
//     controlled_chaos verbatim row falls to its own deliberate route
//     no-handler return, NOT into the psychic lane.
// Shed: generic null early-outs (L703-705, L738-740), error-catch popup
// (L745-748), auto_effect table-miss/fallthrough mechanics → #1997
// index.test.js MAIN; save_attack sorcery_points+restoreCost fingerprint →
// #1998; web_area_save row family → #1999. Handler internals (energy ledger,
// dN×10 roll, popup/log composition) → its own test home
// handlers/class-sorcerer/psychicTeleportationHandler.test.js — registry-side
// shape only here. No timers; turn-based row-click dispatch only;
// test-campaign only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';
import classes2024 from '../../../public/data/2024/classes.json';
import classes5e from '../../../public/data/classes.json';
import { handle as handlePsychicTeleportation } from './handlers/class-sorcerer/psychicTeleportationHandler.js';

vi.mock('./handlers/class-sorcerer/psychicTeleportationHandler.js', () => ({
    handle: vi.fn(async () => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Psychic Teleportation',
            description: 'Teleported. Psionic Energy: 8/12.',
        },
    })),
}));

const playerStats = { name: 'SoulknifeTest', level: 17, _trackedResources: { psionicEnergy: { max: 12 } } };

// Verbatim public/data/2024/classes.json → Rogue → majors Soulknife →
// features 'Soul Blades' automation[1].
const PSYCHIC_TELEPORTATION_ROW = {
    type: 'auto_effect',
    effect: 'psychic_teleportation',
    trigger: 'psychic_teleportation',
    uses: '1',
    recharge: 'short_rest',
};

// Mirrors CharBonusActions.jsx PsychicTeleportationRow L424-429 click
// composition (single-object automation forwarded as-is).
function makeTeleportRow(automation = PSYCHIC_TELEPORTATION_ROW) {
    return {
        name: 'Psychic Teleportation',
        description: 'Expend 1 Psionic Energy die, throw a manifested Psychic Blade to an unoccupied space you can see, and teleport to that space. The blade vanishes.',
        automation,
    };
}

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

describe('executeHandler — auto_effect/psychic_teleportation route (CLA-320, lane #1996)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes the verbatim 2024 Soul Blades auto_effect row to handlePsychicTeleportation and passes its popup through', async () => {
        const soulknife = classes2024.find(c => c.name === 'Rogue').majors.find(m => m.name === 'Soulknife');
        const soulBlades = soulknife.features.find(f => f.name === 'Soul Blades');
        expect(soulBlades.automation[1]).toEqual(PSYCHIC_TELEPORTATION_ROW);

        const action = makeTeleportRow();
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        // exact-arg forward: same action identity, characters undefined (arity benign — handler takes 4).
        expect(handlePsychicTeleportation).toHaveBeenCalledTimes(1);
        expect(handlePsychicTeleportation).toHaveBeenCalledWith(action, playerStats, 'test-campaign', null, undefined);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Psychic Teleportation',
                description: 'Teleported. Psionic Energy: 8/12.',
            },
        });
    });

    it('registration symmetry: HANDLER_MAP L457 is dead symmetry — no prod row anywhere declares type psychic_teleportation, and 5e carries no such feature', () => {
        for (const doc of [classes2024, classes5e]) {
            expect(automationRows(doc).filter(a => a.type === 'psychic_teleportation')).toEqual([]);
        }
        expect(automationRows(classes5e).filter(a => a.effect === 'psychic_teleportation')).toEqual([]);
        expect(automationRows(classes2024).filter(a => a.effect === 'psychic_teleportation')).toEqual([PSYCHIC_TELEPORTATION_ROW]);
    });

    it('control: sibling route effect wild_magic_double_roll (verbatim Controlled Chaos row) dispatches null, not the psychic handler', async () => {
        // Verbatim classes.json(2024) Controlled Chaos automation — an
        // auto_effect sibling on the effect-route table (L679-684) whose own
        // branch deliberately returns null (flag-set only, no handler).
        const controlledChaos = automationRows(classes2024).find(a => a.effect === 'wild_magic_double_roll');
        expect(controlledChaos).toEqual({ type: 'auto_effect', effect: 'wild_magic_double_roll', trigger: 'wild_magic_surge_roll' });

        const result = await executeHandler({ name: 'Controlled Chaos', automation: controlledChaos }, playerStats, 'test-campaign', null);

        expect(result).toBeNull();
        expect(handlePsychicTeleportation).not.toHaveBeenCalled();
    });
});
