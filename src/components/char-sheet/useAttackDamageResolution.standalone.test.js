// @maintained-by-ai
// Lane: the STANDALONE (no-hook) path of useAttackDamageResolution.js — the only
// exported entry point here is resolveAttackDamageStandalone; every assertion is a
// pure function call through the pipeline seam, no React render.
// Canon ownership: normalizeAutoDamage full-shape/crit/registry/EE contracts live in
// normalizeAutoDamage.test.js. EXCISION CENSUS (fix#54 zero-dup; ledger run2#283):
// the former describe('normalizeAutoDamage') block at old :288-481 (11 its) was
// deleted here — 7 its subsumed byte-exact by home full-shape/minimal/crit-matrix/
// lookup/EE-null arms (2 of them, the self-admitted weak mock-0 EE pin and the
// Greataxe registry pin, were strictly weaker than home and carried nothing out);
// 4 unique arms migrated into home as 3 units: school-rides-without-attackType
// (lookup arm), empty-payload-{}-defaults (own it), unarmed-name-derived across
// empty-registry AND null-playerStats (own it.each). OA-true
// transport to both gates is pinned by useAttackDamageResolution.opportunity-transport.test.js.
// Owned here: byte-exact run-ctx defaults + overrides spread, the exact callable ctx
// surface consumed by pipeline steps, no-op modal-setter contract, and the byte-exact
// minimalCtx payload at the rollDamage seam (pass-through and default branches).
// FOLD DISPOSITION (ledger run2#309, 🗑 old :168-285): DISCHARGED — the ctx-defaults
// twin its (old :97/:120) and the proceedWithDamage twin its (old :169/:200/:233/:258)
// were folded into the two it.each blocks below at the Test Quality reshape (f59d311cd,
// 481→225). The two describes stay split per fix#220 honest-split: normalized-diff of
// the it.each bodies shows they differ beyond parameters — different mock behavior
// (inert run vs run invoking proceedWithDamage) pinning different seams (run-ctx
// snapshot vs rollDamage payload); merging would branch assertions and blur attribution
// (fix#230 standard). This turn hoists the per-case byte-identical mock-skeleton out
// of the proceedWithDamage it.each body into its beforeEach. Census: nothing further
// foldable — the full-shape expected/expectedContext tables are intentional byte-pins.
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

    it('modal-setter choices are absorbed silently — never forwarded to the deliberately-ignored setModalState dep', async () => {
        // The standalone entry destructures the dep as _setModalState (source:33):
        // consumers like CharSpells/CharReactions may omit it entirely, so forwarding
        // a pipeline choice through these setters would TypeError. Pin the no-op
        // contract: each choice lands nowhere observable and the injected setter stays cold.
        const setModalState = vi.fn();
        const attack = makeAttack();

        await resolveAttackDamageStandalone(attack, {}, {
            playerStats: makePlayerStats(), campaignName: CAMPAIGN,
            setPopupHtml, rollDamage, setModalState,
        });

        const ctx = buildPipelineForAction.mock.results[0].value.run.mock.calls[0][1];
        for (const setter of ['setDamageTypeChoice', 'setDivineFuryChoice', 'setAttackRiderModal',
            'setAttackRiderManeuverPrompt', 'setSweepingAttackTargetModal', 'setSecondaryTargetModal']) {
            expect(() => ctx[setter]('choice')).not.toThrow();
        }
        expect(setModalState).not.toHaveBeenCalled();
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
