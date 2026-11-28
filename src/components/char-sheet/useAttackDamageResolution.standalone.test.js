// @maintained-by-ai 2026-11-28
// Lane: the STANDALONE (no-hook) path of useAttackDamageResolution.js — the only
// entry point exercised here is resolveAttackDamageStandalone (source:33-103);
// every assertion is a pure function call through the pipeline seam, no React render.
// Owned here (unique to this path, distinct from the hook twin at :360-457):
//   • byte-exact run-ctx default + override spread (:62-99) and the exact callable
//     ctx surface pipeline steps consume;
//   • the literal `{ current: null }` resume arg (hook passes resumeRef instead);
//   • the no-op modal-setter contract — deps are destructured as `_setModalState`
//     (source:33) so consumers (CharSpells/CharReactions) may omit it entirely;
//   • byte-exact minimalCtx at the rollDamage seam (:39-58), including the keys the
//     STANDALONE path has and the hook twin (:379-394) omits: attackName, overridable
//     attackerName (o.attackerName || attack.name), doubledRolls, playerStats,
//     metamagicTwinTarget/metamagicHeighten.
// Split rationale (two describes, no merge): the two it.each bodies differ beyond
// parameters — inert pipeline.run vs a run() that invokes proceedWithDamage pin
// different seams (run-ctx snapshot vs rollDamage payload); merging would branch
// assertions and blur attribution.
// Not owned here: normalizeAutoDamage full-shape/crit/registry/EE -> normalizeAutoDamage.test.js;
// hook-seam ctx matrix + ...ctxOverrides trailing-spread precedence -> .ctxOverrides.test.js;
// OA-true transport at both gates + hook-path parity -> .opportunity-transport.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock audit: the only collaborator reachable from resolveAttackDamageStandalone's
// live path is buildPipelineForAction → pipeline.run → ctx.proceedWithDamage → the
// injected rollDamage, so only the pipeline seam is stubbed. Purged mocks: applyDamage
// (the source module never imports it at all — fully dead), diceRoller, automationService,
// combatSuperiorityHandler, postCastRiderService (only reachable from the hook path /
// normalizeAutoDamage, never from this path; they load cleanly unmocked in jsdom, proven
// by the sibling .opportunity-transport suite which leaves them real).
vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(),
}));

import { resolveAttackDamageStandalone } from './useAttackDamageResolution.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

const CAMPAIGN = 'test-campaign';

function makeAttack() {
    return { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };
}

function makePlayerStats() {
    return { name: 'TestFighter', level: 5, abilities: [], automation: { actions: [], passives: [] } };
}

// The exact callable surface pipeline steps may invoke on the standalone ctx.
const CTX_FN_KEYS = [
    'proceedWithDamage', 'rollDamage', 'setAttackRiderManeuverPrompt', 'setAttackRiderModal',
    'setDamageTypeChoice', 'setDivineFuryChoice', 'setPopupHtml', 'setSecondaryTargetModal',
    'setSweepingAttackTargetModal',
];

function splitCtx(ctx) {
    const data = {};
    const fnKeys = [];
    for (const [key, value] of Object.entries(ctx)) {
        if (typeof value === 'function') fnKeys.push(key);
        else data[key] = value;
    }
    return { data, fnKeys: fnKeys.sort() };
}

describe('resolveAttackDamageStandalone — pipeline seam', () => {
    let setPopupHtml;
    let rollDamage;

    beforeEach(() => {
        vi.resetAllMocks();
        setPopupHtml = vi.fn();
        rollDamage = vi.fn();
        buildPipelineForAction.mockReturnValue({ run: vi.fn().mockResolvedValue(undefined) });
    });

    it.each([
        {
            label: 'empty ctxOverrides → every default pinned byte-exact',
            ctxOverrides: {},
            expected: (attack, playerStats) => ({
                attack, playerStats, campaignName: CAMPAIGN,
                mapName: null, popupHtml: null,
                hit: true, isCrit: false, isNatural20: false, targetName: null,
                isBonusActionAttack: false,
                formula: null, total: 0, rolls: [], modifier: 0,
                sneakDice: 0, effectiveSneakDice: 0, isMeleeOrUnarmed: false,
                buildCtxResult: null, autoFormulaOverride: null,
                overchannelActive: false, overchannelUseCount: 0, overchannelSpellLevel: 1,
                autoDamageSaveDc: null, empoweredEvocationModifier: 0,
                buildCtx: null, buildCtxSync: null,
            }),
        },
        {
            label: 'ctxOverrides values (including arbitrary spread fields) ride into the run ctx',
            ctxOverrides: {
                hit: false, isCrit: true, isNatural20: true, targetName: 'Goblin',
                isBonusActionAttack: true, overchannelActive: true,
                overchannelUseCount: 2, overchannelSpellLevel: 3,
                sneakDice: 4, effectiveSneakDice: 4, isMeleeOrUnarmed: true,
                autoFormulaOverride: 'custom formula', autoDamageSaveDc: 12,
                empoweredEvocationModifier: 2, attackerName: 'Custom Attacker',
            },
            expected: (attack, playerStats) => ({
                attack, playerStats, campaignName: CAMPAIGN,
                mapName: null, popupHtml: null,
                hit: false, isCrit: true, isNatural20: true, targetName: 'Goblin',
                isBonusActionAttack: true,
                formula: null, total: 0, rolls: [], modifier: 0,
                sneakDice: 4, effectiveSneakDice: 4, isMeleeOrUnarmed: true,
                buildCtxResult: null, autoFormulaOverride: 'custom formula',
                overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 3,
                autoDamageSaveDc: 12, empoweredEvocationModifier: 2,
                buildCtx: null, buildCtxSync: null,
                attackerName: 'Custom Attacker',
            }),
        },
    ])('$label', async ({ ctxOverrides, expected }) => {
        const attack = makeAttack();
        const playerStats = makePlayerStats();

        await expect(
            resolveAttackDamageStandalone(attack, ctxOverrides, {
                playerStats, campaignName: CAMPAIGN, setPopupHtml, rollDamage,
            })
        ).resolves.toBeUndefined();

        expect(buildPipelineForAction).toHaveBeenCalledWith(attack, playerStats);
        const pipeline = buildPipelineForAction.mock.results[0].value;
        expect(pipeline.run).toHaveBeenCalledTimes(1);
        const [event, ctx, resumeArg] = pipeline.run.mock.calls[0];
        expect(event).toBe('housekeeping:do');
        expect(resumeArg).toEqual({ current: null });

        const { data, fnKeys } = splitCtx(ctx);
        expect(data).toEqual(expected(attack, playerStats));
        expect(fnKeys).toEqual(CTX_FN_KEYS);
        // Injected deps reach ctx by identity; pipeline never rolls or pops here —
        // only the mocked pipeline seam runs.
        expect(ctx.rollDamage).toBe(rollDamage);
        expect(ctx.setPopupHtml).toBe(setPopupHtml);
        expect(rollDamage).not.toHaveBeenCalled();
        expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('modal-setter choices are absorbed silently — never forwarded to the deliberately-ignored setModalState dep, and safe when the dep is omitted', async () => {
        // The standalone entry destructures the dep as _setModalState (source:33):
        // consumers like CharSpells/CharReactions may omit it entirely, so forwarding
        // a pipeline choice through these setters would TypeError. Pin both halves of
        // the no-op contract: an injected setter stays cold, and a call with the dep
        // fully omitted still absorbs every choice without throwing or leaking into
        // the other injected deps.
        const MODAL_SETTERS = ['setDamageTypeChoice', 'setDivineFuryChoice', 'setAttackRiderModal',
            'setAttackRiderManeuverPrompt', 'setSweepingAttackTargetModal', 'setSecondaryTargetModal'];

        const setModalState = vi.fn();
        await resolveAttackDamageStandalone(makeAttack(), {}, {
            playerStats: makePlayerStats(), campaignName: CAMPAIGN,
            setPopupHtml, rollDamage, setModalState,
        });

        const ctx = buildPipelineForAction.mock.results[0].value.run.mock.calls[0][1];
        for (const setter of MODAL_SETTERS) {
            expect(() => ctx[setter]('choice')).not.toThrow();
        }
        expect(setModalState).not.toHaveBeenCalled();
        expect(rollDamage).not.toHaveBeenCalled();
        expect(setPopupHtml).not.toHaveBeenCalled();

        // Omitted-dep consumer shape: choices must still land nowhere, never throw.
        await expect(resolveAttackDamageStandalone(makeAttack(), {}, {
            playerStats: makePlayerStats(), campaignName: CAMPAIGN,
            setPopupHtml, rollDamage,
        })).resolves.toBeUndefined();
        const ctxWithoutDep = buildPipelineForAction.mock.results[0].value.run.mock.calls[1][1];
        for (const setter of MODAL_SETTERS) {
            expect(() => ctxWithoutDep[setter]('choice')).not.toThrow();
        }
        expect(rollDamage).not.toHaveBeenCalled();
        expect(setPopupHtml).not.toHaveBeenCalled();
    });
});

describe('resolveAttackDamageStandalone — proceedWithDamage minimalCtx at rollDamage seam', () => {
    // FT-101 PARITY FIXED (fix#OA-parity 2026-10-22): the hook-path proceedWithDamage
    // minimalCtx (useAttackDamageResolution.js:369-383) previously omitted
    // isOpportunityAttack while this standalone twin included it; the hook branch now
    // mirrors this byte (`isOpportunityAttack: o.isOpportunityAttack || false`,
    // same pendingCtxOverrides/ctxOverrides source). Hook-path pins live in
    // .opportunity-transport.test.js; the false-default pin below stays intact.
    const innerAttack = { name: 'Rapier', damageType: 'piercing' };
    let rollDamage;

    beforeEach(() => {
        vi.resetAllMocks();
        rollDamage = vi.fn();
        buildPipelineForAction.mockReturnValue({
            run: vi.fn(async (_event, ctx) => {
                // Mirrors attackRollPostDamage handing proceedWithDamage the finished
                // damage tuple; the inner attack arg is what names the payload.
                ctx.proceedWithDamage({
                    attack: innerAttack, formula: '1d8+4', total: 9, rolls: [5, 4], modifier: 4,
                });
            }),
        });
    });

    it.each([
        {
            label: 'supplied overrides pass through verbatim (isCrit rides as isAutoCrit)',
            ctxOverrides: {
                attackerName: 'Player', isCrit: true, doubledRolls: [5, 5],
                autoDamageSecondaryFormula: '1d6', autoDamageSecondaryName: 'Secondary',
                autoDamageSecondaryDamageType: 'fire', saveDc: 15, saveType: 'Dexterity',
                dcSuccess: 'half', metamagicTwinTarget: 'Orc', metamagicHeighten: true,
                playerStats: { name: 'CtxOnly' },
            },
            expectedContext: {
                attackName: 'Rapier', damageType: 'piercing', targetName: null,
                attackerName: 'Player', isAutoCrit: true, doubledRolls: [5, 5],
                playerStats: { name: 'CtxOnly' },
                autoDamageSecondaryFormula: '1d6', autoDamageSecondaryName: 'Secondary',
                autoDamageSecondaryDamageType: 'fire', saveDc: 15, saveType: 'Dexterity',
                dcSuccess: 'half', metamagicTwinTarget: 'Orc', metamagicHeighten: true,
                isOpportunityAttack: false,
            },
        },
        {
            label: 'empty ctxOverrides → all-null defaults; attackerName falls back to the inner attack name',
            ctxOverrides: {},
            expectedContext: {
                attackName: 'Rapier', damageType: 'piercing', targetName: null,
                attackerName: 'Rapier', isAutoCrit: false, doubledRolls: null,
                playerStats: null,
                autoDamageSecondaryFormula: null, autoDamageSecondaryName: null,
                autoDamageSecondaryDamageType: null, saveDc: null, saveType: null,
                dcSuccess: null, metamagicTwinTarget: null, metamagicHeighten: false,
                isOpportunityAttack: false,
            },
        },
    ])('$label', async ({ ctxOverrides, expectedContext }) => {
        await resolveAttackDamageStandalone(makeAttack(), ctxOverrides, {
            playerStats: makePlayerStats(), campaignName: CAMPAIGN,
            setPopupHtml: vi.fn(), rollDamage,
        });

        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage).toHaveBeenCalledWith({
            name: 'Rapier', formula: '1d8+4', total: 9, rolls: [5, 4], modifier: 4,
            context: expectedContext,
        });
    });
});
