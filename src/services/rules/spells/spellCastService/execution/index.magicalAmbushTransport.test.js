// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — all dependencies of execution/index.js                     */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_playerName, _key, _campaignName) => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
  checkCompelledDuelAttackExpiry: vi.fn(),
}));

vi.mock('../../../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../rules/spells/postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve()),
  triggerPostCastAllyHeals: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../rules/spells/postCastRiderService.js', () => ({
  triggerBewitchingMagic: vi.fn(() => Promise.resolve()),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve()),
  triggerSpellThief: vi.fn(() => Promise.resolve()),
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve()),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../../../automation/handlers/spells/sanctuaryHandler.js', () => ({
  endSanctuary: vi.fn(),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => ({ formula: '1d8', primaryType: 'Fire' })),
}));

vi.mock('../../../features/confusionService.js', () => ({
  triggerConfusion: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
  applyHealingRerollOnes: vi.fn(() => ({ displayRolls: [5], originalRolls: [5] })),
}));

vi.mock('./helpers.js', () => ({
  refundSpellBreakerSlot: vi.fn(),
  applyHexEffects: vi.fn(),
  applyPowerWordHealToTarget: vi.fn(),
  applyPowerWordKillToTarget: vi.fn(),
  triggerArcaneWard: vi.fn(() => Promise.resolve()),
  triggerDispelMagic: vi.fn(() => Promise.resolve()),
  triggerExpertDivination: vi.fn(() => Promise.resolve(null)),
  applyRegenerateSpell: vi.fn(),
  executeMagicMissile: vi.fn(() => Promise.resolve()),
}));

vi.mock('./blockChecks.js', () => ({
  checkGlobeOfInvulnerability: vi.fn(() => Promise.resolve(null)),
  checkForcecageBlocked: vi.fn(() => Promise.resolve(null)),
  checkBlockedBySpellcastingBuff: vi.fn(() => Promise.resolve(null)),
}));


vi.mock('./modalSpells.js', () => ({
  handlePowerWordHeal: vi.fn(() => Promise.resolve({ handled: false })),
  handlePowerWordKill: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassSuggestion: vi.fn(() => ({ handled: false })),
  handleCalmEmotions: vi.fn(() => ({ handled: false })),
  handleHypnoticPatternEarly: vi.fn(() => ({ handled: false })),
  handleConfusionEarly: vi.fn(() => ({ handled: false })),
  handleShapechange: vi.fn(() => ({ handled: false })),
  handleFear: vi.fn(() => ({ handled: false })),
  handleConjureVolley: vi.fn(() => ({ handled: false })),
  handleSilence: vi.fn(() => ({ handled: false })),
  handleSleep: vi.fn(() => ({ handled: false })),
}));

vi.mock('./triggerSpells.js', () => ({
  handleRegenerate: vi.fn(() => Promise.resolve({ handled: false })),
  handleSeeInvisibility: vi.fn(() => Promise.resolve({ handled: false })),
  handleFleshToStone: vi.fn(() => Promise.resolve({ handled: false })),
  handleHoldMonster: vi.fn(() => Promise.resolve({ handled: false })),
  handleBanishment: vi.fn(() => Promise.resolve({ handled: false })),
  handleConfusion: vi.fn(() => Promise.resolve({ handled: false })),
  handleMaze: vi.fn(() => Promise.resolve({ handled: false })),
  handlePowerWordStun: vi.fn(() => Promise.resolve({ handled: false })),
  handleHypnoticPattern: vi.fn(() => Promise.resolve({ handled: false })),
  handleSlow: vi.fn(() => Promise.resolve({ handled: false })),
  handleBane: vi.fn(() => Promise.resolve({ handled: false })),
  handleBless: vi.fn(() => Promise.resolve({ handled: false })),
  handleBeaconOfHope: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassSuggestion: vi.fn(() => Promise.resolve({ handled: false })),
  handleSuggestion: vi.fn(() => Promise.resolve({ handled: false })),
  handleCommand: vi.fn(() => Promise.resolve({ handled: false })),
  handleOttoDance: vi.fn(() => Promise.resolve({ handled: false })),
  handleResilientSphere: vi.fn(() => Promise.resolve({ handled: false })),
  handleBlur: vi.fn(() => Promise.resolve({ handled: false })),
  handleExpeditiousRetreat: vi.fn(() => Promise.resolve({ handled: false })),
  handleFriends: vi.fn(() => Promise.resolve({ handled: false })),
  handleCrownOfMadness: vi.fn(() => Promise.resolve({ handled: false })),
  handleGenericAutomation: vi.fn(() => Promise.resolve({ handled: false })),
  handleAnimalFriendship: vi.fn(() => Promise.resolve({ handled: false })),
}));

vi.mock('./savePath.js', () => ({
  handleSavePath: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./noSavePath.js', () => ({
  handleNoSavePath: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./damageCalculation.js', () => ({
  computeRange: vi.fn(() => ({})),
  computeEmpoweredEvocation: vi.fn(() => ({ empEvocFormula: null })),
  computeBlessedStrikes: vi.fn((_, formula) => formula),
  computeRadiantSoul: vi.fn((_, __, ___, ____, formula) => formula),
  computeOverchannel: vi.fn(() => ({ overchannelFormula: null, overchannelActive: false, overchannelUseCount: 0 })),
}));

vi.mock('./spellResolution.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  CLA-219: Magical Ambush threads hasInvisible through the exact  */
/*  Heightened Spell transport (metaCtx.metamagicHeighten) at the    */
/*  executeSpellCast choke point — all lanes honour it once.         */
/* ------------------------------------------------------------------ */

const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { handleCommand } = await import('./triggerSpells.js');
const { handleSavePath } = await import('./savePath.js');
const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
import { executeSpellCast } from './index.js';

function ambushPlayerStats(hasPassive = true) {
    return {
        name: 'AasimarTest',
        rules: '2024',
        proficiency: 6,
        spellAbilities: { saveDc: 14, modifier: 5, toHit: 11 },
        abilities: [{ name: 'Charisma', bonus: 5 }],
        automation: { passives: hasPassive ? [{ type: 'passive_rule', effect: 'magical_ambush', name: 'Magical Ambush' }] : [] },
    };
}

function commandSpell() {
    return {
        name: 'Command', level: 1, school: 'Enchantment', casting_time: '1 action',
        range: '60 feet', components: 'V', duration: '1 round',
        dc: { dc_type: 'WIS', dc_success: 'none' },
    };
}

function saveSpell() {
    return {
        name: 'Phantasmal Killer', level: 4, school: 'Illusion', casting_time: '1 action',
        range: '120 feet', components: 'V,S', duration: 'Concentration, up to 1 minute',
        dc: { dc_type: 'WIS', dc_success: 'none' },
        damage: { damage_at_slot_level: { 4: '4d10', 5: '5d10' } },
    };
}

function baseOpts(playerStats) {
    return {
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        playerStats,
        getTargetInfo: async () => ({ name: 'HexWarlock' }),
        attackerPos: null, targetPos: null, featEffects: {},
        campaignName: 'test-campaign', mapName: null, characters: [],
    };
}

function noDamageSpellMode() {
    resolveSpellDamageWithTypes.mockReturnValue({ formula: null, primaryType: null });
}
function damageSpellMode() {
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '4d10', primaryType: 'Psychic' });
}

beforeEach(() => {
    vi.clearAllMocks();
    handleCommand.mockImplementation(async () => ({ handled: false }));
    handleSavePath.mockImplementation(async () => null);
    getRuntimeValue.mockImplementation(() => undefined);
    noDamageSpellMode();
});

describe('CLA-219 Magical Ambush disadvantage transport', () => {
    it('folds hasInvisible into metaCtx.metamagicHeighten for dedicated-handler lanes (Command)', async () => {
        getRuntimeValue.mockImplementation((name, key) =>
            (name === 'AasimarTest' && key === 'activeConditions') ? ['invisible'] : undefined);
        handleCommand.mockImplementation(async ({ metaCtx }) => ({
            handled: true,
            result: { automationPopup: { type: 'modal', modalName: 'commandChoice', payload: { metaCtx } } },
        }));

        const result = await executeSpellCast(commandSpell(), {}, baseOpts(ambushPlayerStats()));

        expect(handleCommand).toHaveBeenCalled();
        expect(result.automationPopup.payload.metaCtx.metamagicHeighten).toBe(true);
    });

    it('keeps metamagicHeighten false when the caster is visible (control)', async () => {
        getRuntimeValue.mockImplementation((name, key) =>
            (name === 'AasimarTest' && key === 'activeConditions') ? [] : undefined);
        handleCommand.mockImplementation(async ({ metaCtx }) => ({
            handled: true,
            result: { automationPopup: { type: 'modal', modalName: 'commandChoice', payload: { metaCtx } } },
        }));

        const result = await executeSpellCast(commandSpell(), {}, baseOpts(ambushPlayerStats()));

        expect(result.automationPopup.payload.metaCtx.metamagicHeighten).toBe(false);
    });

    it('keeps metamagicHeighten false without the magical_ambush passive (control)', async () => {
        getRuntimeValue.mockImplementation((name, key) =>
            (name === 'AasimarTest' && key === 'activeConditions') ? ['invisible'] : undefined);
        handleCommand.mockImplementation(async ({ metaCtx }) => ({
            handled: true,
            result: { automationPopup: { type: 'modal', modalName: 'commandChoice', payload: { metaCtx } } },
        }));

        const result = await executeSpellCast(commandSpell(), {}, baseOpts(ambushPlayerStats(false)));

        expect(result.automationPopup.payload.metaCtx.metamagicHeighten).toBe(false);
    });

    it('folds hasInvisible into the savePath context for damage save spells', async () => {
        damageSpellMode();
        getRuntimeValue.mockImplementation((name, key) =>
            (name === 'AasimarTest' && key === 'activeConditions') ? ['invisible'] : undefined);

        await executeSpellCast(saveSpell(), {}, baseOpts(ambushPlayerStats()));

        expect(handleSavePath).toHaveBeenCalled();
        const opts = handleSavePath.mock.calls[0][0];
        expect(opts.metaCtx.metamagicHeighten).toBe(true);
        expect(opts.hasInvisible).toBe(true);
    });

    it('preserves an explicit sorcerer Heightened Spell flag when caster is visible', async () => {
        getRuntimeValue.mockImplementation((name, key) =>
            (name === 'AasimarTest' && key === 'activeConditions') ? [] : undefined);
        handleCommand.mockImplementation(async ({ metaCtx }) => ({
            handled: true,
            result: { automationPopup: { type: 'modal', modalName: 'commandChoice', payload: { metaCtx } } },
        }));

        const result = await executeSpellCast(commandSpell(), { metamagicHeighten: true }, baseOpts(ambushPlayerStats()));

        expect(result.automationPopup.payload.metaCtx.metamagicHeighten).toBe(true);
    });
});
