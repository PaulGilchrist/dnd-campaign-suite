import { setRuntimeValue, getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { executeHandler } from '../../../../automation/index.js';
// SP-026: direct handler import (mirrors targetResolution.js:4) — keeps the heavily-mocked
// automation/index.js barrel out of the new consumer edge.
import { checkCompelledDuelAttackExpiry } from '../../../../automation/handlers/spells/compelledDuelHandler.js';
import { triggerHealingWord } from '../../../features/healingWordService.js';
import { triggerPostCastSelfHeals, triggerPostCastAllyHeals } from '../../postCastHealService.js';
import { triggerSmiteOfProtection } from '../../../features/smiteOfProtectionService.js';
import { triggerInspiringSmite } from '../../../features/inspiringSmiteService.js';
import { triggerPrimalCompanionSpellShare } from '../../../features/primalCompanionSpellShareService.js';
import { triggerWildMagicSurge } from '../../../features/wildMagicSurgeService.js';
import { triggerBewitchingMagic, triggerPostCastRiderSaves, triggerSpellThief } from '../../postCastRiderService.js';
import { endSanctuary } from '../../../../automation/handlers/spells/sanctuaryHandler.js';
import { getCombatContext } from '../../../combat/damageUtils.js';
import { applyHealingToTarget } from '../../../combat/applyHealing.js';
import { getSilenceSource, isCreatureInSilenceZone } from '../../../features/silenceService.js';
import { endFriendsOnHostileAction } from '../../../features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';
import { getPsychicSpellsConfig } from '../../../../automation/handlers/class-warlock/psychicSpellsHandler.js';
import { isInnateSorceryActive } from '../../../../combat/buffs/buffService.js';
import { resolveSpellDamageWithTypes } from '../../../core/spellDamageUtils.js';
import { triggerConfusion } from '../../../features/confusionService.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximizationForTarget, hasRerollHealingOnes, markFortifiedHealthUsedIfGranted } from '../../../../combat/automation/automationService.js';
import { rollExpression, rollExpressionMaximized, applyHealingRerollOnes } from '../../../../dice/diceRoller.js';
import { refundSpellBreakerSlot, applyHexEffects, applyPowerWordHealToTarget, applyPowerWordKillToTarget, triggerDispelMagic, triggerExpertDivination, triggerArcaneWard, applyRegenerateSpell } from './helpers.js';
import { checkGlobeOfInvulnerability, checkForcecageBlocked, checkBlockedBySpellcastingBuff } from './blockChecks.js';
// fix#296 (#1473): handleFear import retired — its only dispatch site (the :279-era
// no-damage arm) deleted below as double-dead; the route home modalSpells.handleFear
// stays byte-stable (owner constraint) as exported surface.
import { handlePowerWordHeal, handlePowerWordKill, handleMassSuggestion, handleCalmEmotions, handleHypnoticPatternEarly, handleConfusionEarly, handleShapechange, handleConjureVolley, handleSilence, handleSleep } from './modalSpells.js';
import { handleRegenerate, handleSeeInvisibility, handleFleshToStone, handleHoldMonster, handleBanishment, handleMaze, handlePowerWordStun, handleSlow, handleBane, handleBless, handleBeaconOfHope, handleSuggestion, handleCommand, handleOttoDance, handleResilientSphere, handleBlur, handleExpeditiousRetreat, handleFriends, handleCrownOfMadness, handleAnimalFriendship, handleDominateBeast, handleDominateMonster, handleDominatePerson, handleRayOfEnfeeblement, handleCompelledDuel, handleGlobeOfInvulnerability, handleForcecage, handleStinkingCloud, handleSleetStorm, handleFaerieFire, handleTashasHideousLaughter, handleImprisonment, handleHeroism, handleLongstrider, handleSpareTheDying, handleEnhanceAbility, handleProtectionFromEnergy, handleProtectionFromPoison, handleResistance, handleGenericAutomation } from './triggerSpells.js';
import { computeRange, computeEmpoweredEvocation, computeBlessedStrikes, computeRadiantSoul, computeOverchannel } from './damageCalculation.js';
import { normalizeCastingTime } from '../../../../shared/castingTimeUtils.js';
import { handleSavePath } from './savePath.js';
import { handleNoSavePath } from './noSavePath.js';
import { handleHolyAura as handleHolyAuraTrigger } from './triggerSpells.js';
import { handleMassCureWounds as handleMassCureWoundsTrigger } from './triggerSpells.js';
import { handleFalseLife as handleFalseLifeTrigger } from './triggerSpells.js';
import { handleRemoveCurse as handleRemoveCurseTrigger } from './triggerSpells.js';
import { getCombatSummary } from '../../../../../services/encounters/combatData.js';

// CLA-268: Psychic Spells damage-type swap is opt-in — honor the cast-time
// checkbox flag (_psychicSpellsOverride / usePsychicDamage); otherwise keep RAW.
function computePsychicDamageType(spell, psychicSpellsConfig, damageType) {
    const optedIn = spell._psychicSpellsOverride || spell.usePsychicDamage;
    if (psychicSpellsConfig && spell.damage && damageType && optedIn) {
        return psychicSpellsConfig.damageType || 'Psychic';
    }
    return damageType;
}

function resolveCastDamage(spell, psychicSpellsConfig, playerStats) {
    // fix#121(e) (#1454/#1462): disk law for cantrip ladders is CHARACTER level —
    // Fire Bolt 5e spells.json damage.damage_at_character_level {1:'1d10',5:'2d10',
    // 11:'3d10',17:'4d10'} (2024 stores the same ladder under damage_at_slot_level,
    // keyed from '0'). The retired `spell.level || 1` argument baked the level-1 tier
    // ('1d10') for EVERY cantrip cast, disagreeing with the caster-level-resolved
    // roll at noSavePath.js:13 (resolveSpellDamageAtLevel(spell, playerStats.level)).
    // Cantrips now resolve at caster level here too — one ladder, one level source;
    // leveled spells keep the exact previous `spell.level || 1` byte.
    const damageLevel = spell.level === 0 ? (playerStats.level || 1) : (spell.level || 1);
    const damageInfo = resolveSpellDamageWithTypes(spell, damageLevel);
    const formula = damageInfo?.formula || null;
    const damageType = damageInfo?.primaryType || spell.damage?.damage_type || '';
    return { formula, damageType, effectiveDamageType: computePsychicDamageType(spell, psychicSpellsConfig, damageType) };
}

function applyHostileCastSideEffects(spell, playerStats, campaignName) {
    if (spell.name && spell.name.toLowerCase() !== 'friends') {
        endFriendsOnHostileAction(playerStats.name, campaignName);
    }
    endInvisibilityOnHostileAction(playerStats.name, campaignName);

    // CLA-399: 2024 spells.json stores 'Action'; normalize before comparing so the
    // Battle Magic flag arms on both rulesets.
    if (normalizeCastingTime(spell.casting_time) === '1 action') {
        setRuntimeValue(playerStats.name, 'lastActionSpellCast', 1, campaignName);
    }
}

// Wrappers for the handled-trigger chain: passThrough returns the handler's
// `result` when handled; swallow returns undefined (matching bare `return;`).
const passThrough = (r) => (r.handled ? { value: r.result } : null);
const swallow = (r) => (r.handled ? { value: undefined } : null);

// fix#121(b) (#1455): automation types routed by :710 handleGenericAutomation into
// massHealUtils.createMassHealHandler, whose confirmFn owns the post-cast SELF-heal
// rider inline (CLA-038, massHealUtils.js:218-223). Both rulesets' disk rows carry
// these types (Mass Healing Word/Prayer of Healing 5e+2024; Mass Cure Wounds 2024).
const MASS_HEAL_CONFIRM_AUTOMATION_TYPES = new Set(['mass_healing_word', 'prayer_of_healing', 'mass_cure_wounds']);

// Run a chain of handled-result trigger thunks in exact order. Sync thunks
// resolve immediately; async thunks are awaited — preserving the original
// await points of each handler invocation.
async function runTriggerChain(triggers) {
    for (const trigger of triggers) {
        const outcome = trigger();
        const settled = outcome && typeof outcome.then === 'function' ? await outcome : outcome;
        if (settled) return settled;
    }
    return null;
}

// Antimagic Field: block when caster or target is inside an active field.
async function checkAntimagicField(spell, playerStats, globeTargetName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const antimagicEffects = storedEffects.filter(te => te.effect === 'antimagic_field');
    const casterAffected = antimagicEffects.some(te => te.target === playerStats.name);
    const targetAffected = globeTargetName ? antimagicEffects.some(te => te.target === globeTargetName) : false;

    if (casterAffected) {
        await addEntry(campaignName, {
            type: 'automation', creatureName: playerStats.name, name: 'Antimagic Field',
            description: `${spell.name} blocked — caster is within Antimagic Field.`, timestamp: Date.now(),
        }).catch((e) => { console.error("[index:log-error]", e); });
        return { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Antimagic Field', description: `${spell.name} is blocked by Antimagic Field affecting ${playerStats.name}.` } } };
    }

    if (targetAffected && globeTargetName) {
        await addEntry(campaignName, {
            type: 'automation', creatureName: playerStats.name, name: 'Antimagic Field',
            description: `${spell.name} blocked — ${globeTargetName} is within Antimagic Field.`, timestamp: Date.now(),
        }).catch((e) => { console.error("[index:log-error]", e); });
        return { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Antimagic Field', description: `${spell.name} is blocked by Antimagic Field protecting ${globeTargetName}.` } } };
    }

    return null;
}

function resolveMagicalAmbushInvisible(playerStats, campaignName) {
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] magicalAmbush check: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for magical ambush check');
    }
    const magicalAmbush = passives.some(p => p.type === 'passive_rule' && p.effect === 'magical_ambush');
    // SP-002: a missing/null caster activeConditions key (e.g. after an Admin clear) is a
    // legitimate empty state — treat it as [] instead of aborting the already-paid cast.
    const rawConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName);
    if (rawConditions != null && !Array.isArray(rawConditions)) {
        console.error('[spellCast] casterConditions: activeConditions is not an array');
        throw new Error('activeConditions must be an array for caster');
    }
    const casterConditions = rawConditions == null ? [] : rawConditions;
    return magicalAmbush && casterConditions.some(c => String(c).toLowerCase() === 'invisible');
}

// fix#126 (#1495): hub-side self-catch for the ambush resolver's LOUD guards
// (:132/:140 — the resolver stays PURE-throw for its exported contract (:864;
// census: executeSpellCast is its ONLY caller — the re-export has zero production
// importers). Unguarded at the hub the rejection killed executeSpellCast WHOLE —
// the paid slot plus every post-cast rider (surge/heals/marks, the fix#121(a)/
// CLA-389 merges). Mirrors this file's resolved-shape tail law: the fix#119
// confusion-await arm (`await r.result.catch(console.error)`) and the rider
// `.catch` family — a failing NON-CRITICAL resolution degrades to its zero-bonus
// shape (hasInvisible false => the fold ships the explicit metamagicHeighten:false
// byte, index.generic-metaCtx #1495) and the cast proceeds. The ambush
// disadvantage is lost; never the spell.
function resolveMagicalAmbushOrDegrade(playerStats, campaignName) {
    try {
        return resolveMagicalAmbushInvisible(playerStats, campaignName);
    } catch (e) {
        console.error('[spellCast] Magical Ambush resolution failed:', e);
        return false;
    }
}

// Silence: verbal components are impossible inside a Silence zone.
async function checkSilenceBlock(spell, playerStats, campaignName) {
    if (!(spell.components && spell.components.includes('V'))) return null;
    const silenceCaster = getSilenceSource(playerStats.name, campaignName);
    if (silenceCaster && isCreatureInSilenceZone(playerStats.name, silenceCaster, campaignName)) {
        await addEntry(campaignName, {
            type: 'automation',
            creatureName: playerStats.name,
            name: 'Silence',
            description: `${spell.name} blocked — ${playerStats.name} is inside ${silenceCaster}'s Silence zone; Verbal components are impossible there.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[index:silence-log-error]", e); });
        return {
            automationPopup: {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Silence',
                    description: `${spell.name} cannot be cast — ${playerStats.name} is inside a Silence zone and Verbal spell components are impossible there.`,
                },
            },
        };
    }
    return null;
}

function applyPsychicComponentReduction(spell, psychicSpellsConfig) {
    if (!(psychicSpellsConfig && spell.components)) return;
    const spellSchool = (spell.school || '').toLowerCase();
    const reducedSchools = (psychicSpellsConfig.spellSchools || []).map(s => s.toLowerCase());
    if (reducedSchools.includes(spellSchool)) {
        const reducedComponents = (psychicSpellsConfig.componentReduction || []).map(c => c.toUpperCase());
        spell.components = spell.components.filter(c => !reducedComponents.includes(c.toUpperCase()));
    }
}

// Full spell data lookup
async function lookupFullSpell(spell, playerStats) {
    let fullSpell = spell;
    const needsLookup = !spell.area_of_effect || (spell.automation?.type && !spell.automation?.effects);
    if (!needsLookup) return fullSpell;
    try {
        const spellsUrl = playerStats.rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json';
        const response = await fetch(spellsUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const allSpells = await response.json();
        const lookup = allSpells.find(s => s.name === spell.name);
        if (lookup) {
            fullSpell = { ...spell, ...lookup, index: undefined, name: spell.name };
        } else {
            console.error('[spellCast] Spell not found in spells.json:', spell.name);
        }
    } catch (e) {
        console.error('[spellCast] Failed to look up full spell data for:', spell.name, e);
    }
    return fullSpell;
}

function computeSpellStats(playerStats, cantripSpellAbility) {
    let spellToHit = playerStats.spellAbilities?.toHit || 0;
    let spellSaveDc;
    if (playerStats.spellAbilities?.saveDc == null) {
        if (playerStats.proficiency == null) {
            console.error('[spellCast] executeSpellCast: playerStats.proficiency is missing');
            throw new Error('playerStats.proficiency is required for spell save DC calculation');
        }
        spellSaveDc = 8 + playerStats.proficiency;
    } else {
        spellSaveDc = playerStats.spellAbilities.saveDc;
    }
    if (cantripSpellAbility && playerStats.abilities) {
        const ability = playerStats.abilities.find(a => a.name === cantripSpellAbility);
        if (ability) {
            spellToHit = ability.bonus + playerStats.proficiency;
            spellSaveDc = 8 + ability.bonus + playerStats.proficiency;
        }
    }

    // fix#355(b) (#1496): the retired if/else-if shape silently shipped 0 when
    // cantripSpellAbility was TRUTHY but ABSENT from abilities (the else-if never
    // ran). Lawful default mirrors this function's OWN tolerant DC twin above
    // (:230-:238 keeps the spellAbilities-derived byte when the named row is
    // absent) plus the 5e-twin sibling massHealUtils.js getSpellCastingMod
    // (:10-:22): named row wins, else spellAbilities.modifier || 0 (:18-:21).
    // The data hole is LOUD (attackCalc2024.js:28-:33 findAbility law: absent
    // row = data hole, log loudly, never fabricate). Never silently 0.
    const cachedCastingMod = playerStats.spellAbilities?.modifier || 0;
    let spellCastingMod = cachedCastingMod;
    if (cantripSpellAbility && playerStats.abilities) {
        const ability = playerStats.abilities.find(a => a.name === cantripSpellAbility);
        if (ability) {
            spellCastingMod = ability.bonus;
        } else {
            console.error(`[spellCast] computeSpellStats: cantripSpellAbility '${cantripSpellAbility}' is absent from playerStats.abilities — defaulting to spellAbilities.modifier per the massHealUtils getSpellCastingMod twin (never a silent 0).`);
        }
    }

    return { spellToHit, spellSaveDc, spellCastingMod };
}

// Generic spell cast log
async function logGenericSpellCast({ spell, fullSpell, playerStats, campaignName, getTargetInfo, spellSaveDc, damageType, formula }) {
    if (spell.name === 'Hex') return;
    // SP-079 (§CLA-208 pay-at-open family): Mass Suggestion's cast log is deferred to the
    // chooser's confirm so a Skip/cancel emits no phantom spell log. The open lane
    // (handleNonSorcererCast) stamps _deferChooserSlotPayment without paying.
    if (spell._deferChooserSlotPayment) return;
    // SP-103: a Shapechange form change is a free action, not a new casting —
    // confirmShapechangeTransform logs the ability_use instead.
    if (spell._shapechangeFormChange) return;
    const resolvedTarget = await getTargetInfo();
    const resolvedTargetName = resolvedTarget?.name || null;
    const spellDescription = fullSpell.description ? fullSpell.description.join(' ') : '';
    addEntry(campaignName, {
        type: 'spell', characterName: playerStats.name, targetName: resolvedTargetName,
        spellName: spell.name, spellLevel: spell.level || 0, castingTime: spell.casting_time,
        damageType: damageType || null, damageFormula: formula || null,
        saveDC: spell.dc ? spellSaveDc : null, concentration: !!spell.concentration,
        description: spellDescription || null, timestamp: Date.now(),
    }).catch((e) => { console.error("[index:log-error]", e); });
}

// Status effects fallback: route a DC-bearing spell through rollDamage.
async function runStatusEffectsFallback({ spell, fullSpell, metaCtx, playerStats, getTargetInfo, spellSaveDc, innateSorceryActive, hasInvisible, rollDamage }) {
    if (!(spell.dc && spell.status_effects && spell.status_effects.length > 0 && !fullSpell.area_of_effect)) return;
    const target = await getTargetInfo();
    const context = {
        targetName: target?.name, attackerName: playerStats.name, ...metaCtx,
        // CLA-037: spell-origin school stamp for the lastAttack producer.
        spellSchool: spell.school || fullSpell?.school || null,
        saveDc: spellSaveDc + (innateSorceryActive ? 1 : 0),
        saveType: spell.dc.dc_type, dcSuccess: spell.dc.dc_success,
        metamagicHeighten: hasInvisible || metaCtx?.metamagicHeighten,
        isCantrip: spell.baseLevel === 0 || spell.level === 0,
        statusEffects: spell.status_effects,
    };
    rollDamage({ name: spell.name, formula: '0', total: 0, rolls: [], modifier: 0, context: context });
}

// CLA-322: ability check resolves inside triggerDispelMagic — it logs
// the check, dispatches `spell-result` with `checkFailed`, and refunds
// the slot inline (keyed by cast slot level) when Spell Breaker is held.
async function runDispelMagicFallback({ spell, metaCtx, playerStats, campaignName, mapName, getTargetInfo }) {
    const isDispelMagic = spell.name && spell.name.toLowerCase() === 'dispel magic';
    if (!isDispelMagic) return;
    const dispelTarget = await getTargetInfo();
    if (!dispelTarget) return;
    await triggerDispelMagic({ ...metaCtx, targetName: dispelTarget.name }, spell, playerStats, campaignName, mapName);
}

// --- NO DAMAGE PATH: handled-trigger chain in exact original order.
// Returns { handled, value } — value is what executeSpellCast must return.
async function runNoDamagePath(spell, { fullSpell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, spellSaveDc, innateSorceryActive, hasInvisible, spellCastingMod, rollDamage }) {
    const noDamageTriggers = [
        async () => passThrough(await handleRegenerate(spell, getTargetInfo, applyRegenerateSpell, playerStats, campaignName)),
        // fix#296 (#1473): :279-era Fear arm DELETED — DOUBLE-DEAD, both legs vs REAL bytes.
        // Leg 1 (route): disk Fear carries automation.type 'fear' on BOTH rulesets and 'fear'
        // is ABSENT from SERVICE_HANDLED_SPELLS (triggerSpells.js:42), so every disk-byte Fear
        // cast is consumed at :710 handleGenericAutomation -> DIRECT fearHandler route
        // (automation/index.js:530 'fear: handleFear'; fearService deleted fix#294).
        // Leg 2 (guard): the only shape surviving :710 is the lightweight :163 envelope
        // ({name, level, baseLevel} — useActionSpellMetamagic.js:163) and it carries NO
        // spell.dc, which modalSpells.handleFear's gate (name + spell.dc) requires -> DECLINE.
        // No byte-honest production envelope reaches this arm (#1455 fabrication ban); the
        // route home modalSpells.handleFear stays byte-stable (owner constraint).
        () => passThrough(handleConjureVolley(spell, fullSpell)),
        async () => swallow(await handleSeeInvisibility(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => swallow(await handleFleshToStone({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => swallow(await handleHoldMonster({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => swallow(await handleBanishment({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        // fix#296 (#1473): :285-era Confusion twin DELETED (COLLAPSE, no cross-gating to
        // split): the early chain's name+fullSpell.dc gates consume EVERY 'confusion' cast.
        // Disk-full: disk row carries dc (both rulesets; lookup skipped — aoe set, automation
        // null) -> handleConfusionEarly (:707-era, index.js early chain) intercepts natively.
        // Lightweight :163: lookupFullSpell (index.js:203-era) merges the disk dc in, and its
        // merge is NAME-KEYED ({...spell, ...lookup, name: spell.name}) so confusion's dc can
        // never ride a hypnotic-named envelope — the fix#166 two-carrier face is ABSENT by
        // structure; both dc bytes share one identical shape {dc_type:'WIS',dc_success:'none'}
        // -> the shared dc-check is correct-by-data -> twins deleted. Live owner:
        // earlyReturns-modal.test.js :603-era + noformula-services 'early chain ... twins
        // never fire' pin. Route home modalSpells.handleConfusionEarly stays byte-stable.
        async () => swallow(await handleMaze({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => passThrough(await handlePowerWordStun({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        // fix#296 (#1473): :288-era Hypnotic Pattern twin DELETED — same merged-dc-gate
        // collapse as :285 above: handleHypnoticPatternEarly (:706-era, name+fullSpell.dc)
        // intercepts disk-byte casts on its own disk dc and lightweight casts on the
        // name-keyed merged dc; no route lets a dc-less 'hypnotic pattern' envelope reach
        // runNoDamagePath for disk-known names (a lookup miss console.errors LOUDLY first).
        // Live owner lanes: earlyReturns-modal.test.js :561-era + spellCastService.special
        // (REAL handleHypnoticPatternEarly producer bytes). Route home stays byte-stable.
        async () => swallow(await handleSlow({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => swallow(await handleBane({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => swallow(await handleBless({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => swallow(await handleBeaconOfHope({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        // fix#296 (#1473): :293-era Mass Suggestion twin DELETED — dead-by-direct-route:
        // :704-era handleMassSuggestion (modalSpells.js:45) gates on name lowercase
        // 'mass suggestion' + spellSaveDc, and computeSpellStats makes spellSaveDc ALWAYS
        // numeric (#1473 census; spellStats.test.js:384 pin) -> EVERY mass-suggestion cast
        // (disk AND lightweight :163) intercepts at :704 opening MassSuggestionModal BEFORE
        // runNoDamagePath. The :293 twin dispatched only inside mock-gap worlds. #1458
        // disposition EXECUTED at the host. 'Suggestion' (:294) below survives disk-byte-
        // honest (:704 declines non-mass names; disk hijacked at :710; lightweight route
        // live). Owner lanes: earlyReturns-modal.test.js :468-era + modalSpells
        // .massSuggestion-pay-at-confirm. Route homes stay byte-stable (fix#109).
        async () => swallow(await handleSuggestion({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => passThrough(await handleCommand({ spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName })),
        async () => swallow(await handleOttoDance({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => swallow(await handleResilientSphere({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => swallow(await handleBlur(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => swallow(await handleExpeditiousRetreat(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => passThrough(await handleFriends({ spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName })),
        async () => passThrough(await handleCrownOfMadness({ spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName })),
        async () => passThrough(await handleAnimalFriendship({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => passThrough(await handleDominateBeast({ spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName })),
        async () => passThrough(await handleDominateMonster({ spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName })),
        async () => passThrough(await handleDominatePerson({ spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName })),
        async () => swallow(await handleRayOfEnfeeblement({ spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName })),
        async () => passThrough(await handleCompelledDuel({ spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName })),
        async () => passThrough(await handleGlobeOfInvulnerability(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => passThrough(await handleForcecage(spell, metaCtx, playerStats, campaignName, mapName)),
        () => passThrough(handleSilence({ spell, metaCtx, playerStats, campaignName, getCombatSummary: (cn) => getCombatSummary(cn) })),
        async () => swallow(await handleStinkingCloud({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => swallow(await handleSleetStorm({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => passThrough(await handleFaerieFire({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => passThrough(await handleTashasHideousLaughter({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => passThrough(await handleImprisonment({ spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName })),
        async () => passThrough(await handleHeroism({ spell, playerStats, campaignName, mapName, characters, executeHandler })),
        async () => swallow(await handleHolyAuraTrigger(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => passThrough(await handleLongstrider(spell, playerStats, campaignName, mapName, executeHandler)),
        async () => passThrough(await handleSpareTheDying({ spell, playerStats, campaignName, mapName, characters, executeHandler })),
        async () => passThrough(await handleEnhanceAbility({ spell, metaCtx, playerStats, campaignName, mapName, characters, executeHandler })),
    ];
    const earlyOutcome = await runTriggerChain(noDamageTriggers);
    if (earlyOutcome) return { handled: true, value: earlyOutcome.value };

    // Status effects fallback
    await runStatusEffectsFallback({ spell, fullSpell, metaCtx, playerStats, getTargetInfo, spellSaveDc, innateSorceryActive, hasInvisible, rollDamage });

    const massHealingOutcome = await runTriggerChain([
        // fix#121(b): Mass Cure Wounds' service forwarder fires the SELF-heal rider
        // inline (massCureWoundsService.js:122) — flag 'self' so the merged post-cast
        // block defers that leg (ally/chalice riders stay live).
        async () => { const r = await handleMassCureWoundsTrigger(spell, metaCtx, playerStats, campaignName, mapName); return r.handled ? { value: undefined, healRidersRun: 'self' } : null; },
        // fix#121(c) (#1463): the Mass Healing Word / Prayer of Healing legs were STRUCTURALLY
        // DEAD — both disk rows carry automation.type ('mass_healing_word' / 'prayer_of_healing')
        // on BOTH rulesets, so :710 handleGenericAutomation→executeHandler consumed them first;
        // these legs could only be reached by automation-free lightweight envelopes
        // ({name, level, baseLevel} — useActionSpellMetamagic.js:163 second caller), and THAT
        // shape carries no heal_at_slot_level, so the forwarded services resolved no expression
        // and silently returned null (massHealingWordService.js:141-145; prayerOfHealingService
        // :210-212) — zero produced behavior on every reachable input shape. The :710 handler
        // lane is lawful-complete (chooser modal, pay-at-confirm, SP-091 latch, CLA-038 rider —
        // massHealUtils.js:107-108/:218-223). Deleted per orphan-code rule; triggerSpells
        // forwarders stay byte-stable for any other caller (fix#109 constraint).
        async () => swallow(await handleFalseLifeTrigger(spell, metaCtx, playerStats, campaignName, mapName)),
    ]);
    if (massHealingOutcome) return { handled: true, value: massHealingOutcome.value, healRidersRun: massHealingOutcome.healRidersRun };

    // Generic healing path
    if (spell.heal_at_slot_level) {
        // fix#121(b) (#1455): runGenericHealPath is the single owner of the self/ally
        // heal riders for generic heals (:472/:475) — flag 'pair' so the CLA-389 merge
        // no longer refires them at runPostCastTriggers (:519/:522).
        return { handled: true, value: await runGenericHealPath({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, spellCastingMod }), healRidersRun: 'pair' };
    }

    triggerHealingWord(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Healing Word trigger failed:', e);
    });

    const protectionOutcome = await runTriggerChain([
        async () => swallow(await handleProtectionFromEnergy(spell, playerStats, campaignName, mapName, executeHandler)),
        async () => swallow(await handleProtectionFromPoison(spell, playerStats, campaignName, mapName, executeHandler)),
    ]);
    if (protectionOutcome) return { handled: true, value: protectionOutcome.value };

    const removeCurseResult = await handleRemoveCurseTrigger(spell, metaCtx, playerStats, campaignName, mapName);
    if (removeCurseResult.handled) {
        await runDispelMagicFallback({ spell, metaCtx, playerStats, campaignName, mapName, getTargetInfo });
        // fix#358 (#1459/#1404 :447 — the one-key hub completion fix#353 flagged at
        // triggerSpells.removeCurse.test.js:17-21): the retired bare { handled:true }
        // here was the SECOND half of the DOUBLE-DISCARD — the host now returns
        // { handled:true, result:{ automationPopup } } (triggerSpells.js:473-477) and
        // this leg FORWARDS it, mirroring this file's propagation law passThrough :84
        // (`(r) => (r.handled ? { value: r.result } : null)`) and the sibling direct
        // returns :443 (`{ handled: true, value: protectionOutcome.value }`) / :402.
        // Bare-handled host legs yield value:undefined — hasVisibleCastPayload (:727)
        // declines it and the surge precedence is byte-identical to the retired shape.
        return { handled: true, value: removeCurseResult.result };
    }

    await runDispelMagicFallback({ spell, metaCtx, playerStats, campaignName, mapName, getTargetInfo });

    const resistanceResult = await handleResistance({ spell, playerStats, campaignName, mapName, characters, executeHandler, metaCtx });
    if (resistanceResult.handled) return { handled: true };

    return { handled: false };
}

function resolveHealExpression(healAtSlotLevel, slotLevel) {
    const expression = healAtSlotLevel[slotLevel];
    if (expression) return expression;
    const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
    const highestBelow = levels.filter(l => l <= slotLevel).pop();
    return highestBelow ? healAtSlotLevel[highestBelow] : expression;
}

// fix#126 (#1484): parse-or-null mirror of prayerOfHealingService.js:111-115 (#1393) —
// unset/blank/non-numeric NEVER coerces to a fabricated ceiling.
function parseMaxHp(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

// fix#126 (#1484): TARGET-OWNED maxHp law — exact twin of fix#103's prayerOfHealing
// caster-substitution deletion (prayerOfHealingService.js:117-131 verdict: 'the old
// tail || playerStats.hitPoints || 0 substituted the CASTER's current HP — a low-HP
// caster silently capped every party member's heal; DELETED'). The retired :404 tail
// did the same here: an unstamped ally (real max 183) healed against the caster's 138
// (fix#1484 report: clamp at 138, delta truncated). Resolution law, in order:
//   1. the target's OWN runtime 'hitPoints' row (PlayerStats single source of truth);
//   2. LOUD console.error when a player target's row is unstamped (fix#113 loud-refuse
//      family), then the target's OWN characters snapshot (computedStats.hitPoints /
//      maxHp — fix#103 census: why unstamped; monster law is its own row maxHp);
//   3. LOUD-SKIP unresolved (auraOfVitalityHandler.js:49-55 family): maxHp null ->
//      callers write/log/latch NOTHING. The caster's pool never stands in (#58
//      NaN-chain canon: unresolvable degrades loudly, never borrows a fake ceiling).
function resolveTargetHpBounds(target, playerStats, characters) {
    const isTargetPlayer = target.name === playerStats.name || (characters || []).some(c => c.name === target.name && c.type === 'player');
    const ownRuntime = parseMaxHp(getRuntimeValue(target.name, 'hitPoints'));
    let maxHp = ownRuntime;
    if (maxHp == null) {
        const targetChar = (characters || []).find(c => c.name === target.name);
        const ownStats = targetChar?.computedStats || targetChar;
        if (isTargetPlayer) {
            console.error(`[spellCast] resolveTargetHpBounds: player target ${target.name} has unstamped runtime 'hitPoints' — resolving from its own characters snapshot (caster values are never adopted).`);
        }
        maxHp = parseMaxHp(ownStats?.hitPoints ?? ownStats?.maxHp);
    }
    if (maxHp == null) {
        console.error(`[spellCast] Skipping heal of ${target.name}: unresolved target maxHp (runtime 'hitPoints'=${JSON.stringify(ownRuntime)}, own snapshot absent). No clamp, no write, no log, no latch.`);
        return { maxHp: null, currentHp: null };
    }
    const currentHp = getRuntimeValue(target.name, 'currentHitPoints') ?? maxHp;
    return { maxHp, currentHp };
}

async function applyHealToCombat(actualHeal, targetName, campaignName) {
    if (!(actualHeal > 0)) return;
    const combatSummary = await getCombatContext(campaignName);
    if (combatSummary) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
    }
}

// 'max' expression branch — heals target to full.
async function applyMaxHeal({ spell, target, playerStats, characters, campaignName, bonusHeal, bonusDetails }) {
    const { maxHp, currentHp } = resolveTargetHpBounds(target, playerStats, characters);
    if (maxHp == null) return null; // fix#126 loud-skip (unresolved own maxHp — no 'max' write against a borrowed ceiling)
    const actualHeal = maxHp - currentHp;
    const genericHealResult = { targetName: target.name, healAmount: Math.max(0, actualHeal), formula: 'max', rolls: [], rawTotal: Math.max(0, actualHeal), bonusHeal, bonusDetails };
    await applyHealToCombat(actualHeal, target.name, campaignName);
    addEntry(campaignName, {
        type: 'hp_change', targetName: target.name, delta: actualHeal,
        currentHp: Math.min(maxHp, currentHp + Math.max(0, actualHeal)), maxHp,
        isHealing: true, sourceName: playerStats.name, note: spell.name, timestamp: Date.now(),
    }).catch((e) => { console.error("[spellCast] Error:", e); });
    return genericHealResult;
}

// Dice-expression branch — rolls, applies maximize/reroll-ones, heals, and logs.
async function applyRolledHeal({ spell, target, playerStats, characters, campaignName, expression, spellCastingMod, bonusHeal, bonusDetails }) {
    const resolvedExpression = expression.replace(/\bMOD\b/g, String(spellCastingMod));
    const maximize = hasHealingMaximizationForTarget(playerStats, target.name, campaignName);
    const rerollOnes = hasRerollHealingOnes(playerStats);
    const result = maximize ? rollExpressionMaximized(resolvedExpression) : rollExpression(resolvedExpression);
    let displayRolls = result?.rolls || null;
    let healingRerollOriginalRolls = null;
    if (result && rerollOnes && !maximize) {
        const { displayRolls: rerolled, originalRolls } = applyHealingRerollOnes(result.rolls, resolvedExpression);
        displayRolls = rerolled;
        healingRerollOriginalRolls = originalRolls;
    }
    if (!result) return null;
    const { maxHp, currentHp } = resolveTargetHpBounds(target, playerStats, characters);
    // fix#126 loud-skip: unresolvable own ceiling -> no clamp, no combat write,
    // no hp_change log, no latch. The displayed roll stays harmless memory — the
    // diceRoller mock seam (and its #1480 reroll-display law) is untouched here.
    if (maxHp == null) return null;
    const healAmount = result.total + bonusHeal;
    const actualHeal = Math.min(Math.max(0, healAmount), Math.max(0, maxHp - currentHp));
    await applyHealToCombat(actualHeal, target.name, campaignName);
    const genericHealResult = { targetName: target.name, healAmount: actualHeal, formula: resolvedExpression, rolls: displayRolls || result.rolls, rawTotal: result.total + bonusHeal, bonusHeal, bonusDetails, healingRerollOriginalRolls, healingRerollDisplayRolls: displayRolls };
    const formulaParts = [resolvedExpression];
    if (bonusDetails.length > 0) {
        const bonusParts = bonusDetails.map(d => `${d.amount} ${d.name}`).join(' + ');
        formulaParts.push(`(${bonusParts})`);
    }
    addEntry(campaignName, {
        type: 'hp_change', targetName: target.name, delta: actualHeal,
        currentHp: Math.min(maxHp, currentHp + actualHeal), maxHp,
        isHealing: true, sourceName: playerStats.name, note: spell.name,
        formula: formulaParts.join(' + '),
        bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellCast] Error:", e); });
    return genericHealResult;
}

async function resolveGenericHeal({ spell, target, metaCtx, playerStats, campaignName, characters, spellCastingMod }) {
    if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[spellCast] executeSpellCast: slot level is missing (metaCtx.slotLevel and spell.level) for healing spell');
        throw new Error('slot level is required for healing spell');
    }
    const slotLevel = metaCtx?.slotLevel || spell.level;
    const expression = resolveHealExpression(spell.heal_at_slot_level, slotLevel);
    if (!expression) return null;
    const targetChar = (characters || []).find(c => c.name === target.name);
    const targetStats = targetChar?.computedStats || targetChar;
    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, { prof: playerStats.proficiency || 0, level: playerStats.level || 1, slotLevel, campaignName, targetStats });
    // FT-012: heal actually landed with a Fortified Health bonus folded in — stamp
    // the once-per-turn latch on the passive OWNER's store (target, not caster),
    // mirroring the healingHandler lanes (healingHandler.js markFortifiedIfHealed).
    const healResult = expression === 'max'
        ? await applyMaxHeal({ spell, target, playerStats, characters, campaignName, bonusHeal, bonusDetails })
        : await applyRolledHeal({ spell, target, playerStats, characters, campaignName, expression, spellCastingMod, bonusHeal, bonusDetails });
    if (healResult && healResult.healAmount > 0) {
        await markFortifiedHealthUsedIfGranted(bonusDetails, playerStats, targetStats, campaignName);
    }
    return healResult;
}

// Generic healing path (spell.heal_at_slot_level) — returns genericHealResult.
async function runGenericHealPath({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, spellCastingMod }) {
    const explicitTarget = metaCtx?.targetName ? { name: metaCtx.targetName } : null;
    const target = explicitTarget || await getTargetInfo();
    let genericHealResult = null;
    if (target?.name) {
        genericHealResult = await resolveGenericHeal({ spell, target, metaCtx, playerStats, campaignName, characters, spellCastingMod });
    }

    const healTargetCtx = { ...(metaCtx || {}), targetNames: target?.name ? [target.name] : undefined };
    triggerPostCastSelfHeals(spell, healTargetCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast self-heal failed:', e);
    });
    const chaliceResult = await triggerPostCastAllyHeals(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast ally-heal failed:', e);
        return null;
    });
    if (chaliceResult?.needsModal) {
        const pending = getRuntimeValue('campaign', 'pendingStarryChaliceHeal', campaignName);
        return {
            type: 'modal', modalName: 'starryChaliceHeal',
            payload: { casterName: playerStats.name, campaignName, amount: chaliceResult.amount, targetNames: pending?.targetNames || [playerStats.name] },
        };
    }
    return genericHealResult;
}

// Hex: apply effects and log the cast. CLA-107: the chosen ability is threaded
// by the chooser lane (gateHex → runHex); no silent STR default — a missing
// choice console.errors and applies nothing (applyHexEffects guards).
async function castHex(spell, metaCtx, playerStats, campaignName, getTargetInfo) {
    const ability = metaCtx?.hexAbility || null;
    const hexTarget = metaCtx?.targetName || (await getTargetInfo())?.name;
    if (!ability) {
        console.error('[spellCast] castHex: hexAbility is missing from metaCtx — chooser selection was dropped; applying zero hex effects');
    }
    applyHexEffects(spell, playerStats, campaignName, hexTarget, ability);
    const hasEldritchHex = playerStats.automation?.passives?.some(p => p.name === 'Eldritch Hex' && p.type === 'conditional_disadvantage');
    const effects = hasEldritchHex ? 'ability check disadvantage + saving throw disadvantage' : 'ability check disadvantage';
    addEntry(campaignName, { type: 'spell', characterName: playerStats.name, targetName: hexTarget, spellName: 'Hex', spellLevel: 1, castingTime: '1 bonus action', hexAbility: ability, effectsApplied: effects }).catch((e) => { console.error("[index:log-error]", e); });
}

// --- Post-cast triggers — returns the Wild Magic Surge popup (if any).
// healRidersRun: 'pair' when runGenericHealPath already fired self+ally riders
// (:472/:475), 'self' when an automation-routed mass-heal producer owns the self
// rider (massHealUtils.js:218-223, massCureWoundsService.js:122) — fix#121(b).
async function runPostCastTriggers({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, healRidersRun }) {
    triggerPostCastRiderSaves(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast rider save failed:', e);
    });

    const hexTarget = metaCtx?.targetName || (await getTargetInfo())?.name;
    // CLA-389: Hex/Hunter's Mark are resolved by runMarkedTargetSpell (castHex owns
    // the hex write + cast log) before this block can run — skip the duplicate
    // applyHexEffects here so the marked-target lane never double-writes targetEffects.
    if (spell.name !== 'Hex' && spell.name !== "Hunter's Mark") {
        applyHexEffects(spell, playerStats, campaignName, hexTarget, metaCtx?.hexAbility);
    }

    // fix#121(b): the heal-rider pair used to fire a second time here for every
    // generic heal (runGenericHealPath :472/:475 + this block) — single-owner split
    // now: producers flag healRidersRun, this shared block defers exactly the legs
    // they already fired. All other riders stay ungated and fire once per cast.
    if (healRidersRun !== 'pair' && healRidersRun !== 'self') {
        const triggerTargetCtx = { ...(metaCtx || {}), targetNames: metaCtx?.targetNames || (hexTarget ? [hexTarget] : undefined) };
        triggerPostCastSelfHeals(spell, triggerTargetCtx, playerStats, campaignName, mapName).catch(e => {
            console.error('[spellCast] Post-cast self-heal failed:', e);
        });
    }
    if (healRidersRun !== 'pair') {
        triggerPostCastAllyHeals(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
            console.error('[spellCast] Post-cast ally-heal failed:', e);
        });
    }
    triggerSmiteOfProtection(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Smite of Protection trigger failed:', e);
    });
    triggerInspiringSmite(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Inspiring Smite trigger failed:', e);
    });
    triggerPrimalCompanionSpellShare(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Primal companion spell share failed:', e);
    });
    triggerSpellThief(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Spell Thief failed:', e);
    });
    let triggerResult = null;
    const wmsResult = await triggerWildMagicSurge(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Wild Magic Surge trigger failed:', e);
    });
    if (wmsResult) triggerResult = wmsResult;
    triggerBewitchingMagic(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Bewitching Magic trigger failed:', e);
    });

    triggerExpertDivination(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Expert Divination trigger failed:', e);
    });

    triggerArcaneWard(spell, metaCtx, playerStats, campaignName).catch(e => {
        console.error('[spellCast] Arcane Ward trigger failed:', e);
    });

    endSanctuaryOnCast(playerStats, characters, campaignName);

    return triggerResult;
}

// Sanctuary: casting any spell ends Sanctuary on the caster.
function endSanctuaryOnCast(playerStats, characters, campaignName) {
    const sanctuaryEffects = (function () {
        try {
            return (getRuntimeValue('campaign', 'targetEffects') || []).filter(
                te => te.effect === 'sanctuary' && te.target === playerStats.name
            );
        } catch {
            return [];
        }
    })();
    if (sanctuaryEffects.length === 0) return;
    for (const se of sanctuaryEffects) {
        const casterName = se.source;
        const caster = characters?.find(c => c.name === casterName);
        if (caster) {
            endSanctuary(casterName, playerStats.name, campaignName,
                `${playerStats.name} cast a spell, ending Sanctuary.`);
        }
    }
}

// CLA-389: whether a lane return carries its own visible payload (picker modal,
// automation popup, or heal popup) — those keep precedence over the surge popup.
function hasVisibleCastPayload(value) {
    if (!value) return false;
    if (value.automationPopup) return true;
    if (value.type === 'modal' || value.type === 'popup' || value.modalName) return true;
    if (value.targetName != null) return true;
    return false;
}

// CLA-389: early-return lanes (no-damage handled, auto-miss, save-path modal)
// paid the spell slot but never reached runPostCastTriggers — Wild Magic Surge
// and the other post-cast gates were structurally unreachable on those casts.
// Run the post-cast block post-payment on every such lane; the lane keeps its
// own visible picker/popup when it has one (the surge outcome is still logged
// and stamped by the handlers), otherwise the surge popup/modal wins.
async function runPostCastTriggersMerged(ctx, laneValue) {
    const triggerResult = await runPostCastTriggers(ctx);
    if (triggerResult && !hasVisibleCastPayload(laneValue)) return triggerResult;
    return laneValue;
}

// Auto-miss (out of range) — roll a zero-damage result and optionally run the save path.
async function runAutoMissPath({ spell, fullSpell, metaCtx, playerStats, campaignName, mapName, characters,
    getTargetInfo, innateSorceryActive, effectiveDamageType, spellSaveDc, overchannelFormula,
    overchannelActive, overchannelUseCount, rollAttack, rollDamage, formula, hasInvisible, rangeResult }) {
    const context = {
        targetName: (await getTargetInfo())?.name,
        attackerName: playerStats.name,
        ...metaCtx,
        isAutoMiss: true,
        rangeReason: rangeResult.rangeReason,
        saveDc: spellSaveDc,
        saveType: spell.dc?.dc_type || fullSpell.dc?.dc_type,
        dcSuccess: spell.dc?.dc_success ?? fullSpell.dc?.dc_success,
        metamagicHeighten: metaCtx?.metamagicHeighten,
        isCantrip: spell.baseLevel === 0 || spell.level === 0,
    };
    rollDamage({ name: spell.name, formula: formula || '0', total: 0, rolls: [], modifier: 0, context: context });
    if (spell.dc || fullSpell.dc) {
        await handleSavePath({ spell, fullSpell, metaCtx, playerStats, campaignName, mapName, characters,
            getTargetInfo, getRuntimeValue, innateSorceryActive, effectiveDamageType, spellSaveDc,
            overchannelFormula, overchannelActive, overchannelUseCount, rollAttack, rollDamage, formula, hasInvisible });
    }
    return null;
}

// Hunter's Mark / Hex handled entirely by their own paths; returns true when consumed.
async function runMarkedTargetSpell(spell, metaCtx, playerStats, campaignName, getTargetInfo) {
    if (spell.name === "Hunter's Mark") return true;
    if (spell.name === 'Hex') {
        await castHex(spell, metaCtx, playerStats, campaignName, getTargetInfo);
        return true;
    }
    return false;
}

// SP-026: RAW — casting a spell on an enemy other than the duel target ends Compelled
// Duel. Generic harmful spells (a damage formula resolves against the armed target) ride
// this single hook on the damage lane; duel-te lookup + duel-target no-op live inside
// checkCompelledDuelAttackExpiry (compelledDuelHandler.js:172), mirroring the
// dominate-monster/person/ray call sites (triggerSpells.js:292/305/318).
async function expireCompelledDuelOnHarmfulCast(formula, getTargetInfo, playerStats, campaignName) {
    if (!formula) return;
    const harmfulTargetName = getTargetInfo ? (await getTargetInfo())?.name || null : null;
    checkCompelledDuelAttackExpiry(playerStats.name, harmfulTargetName, campaignName);
}

// Pre-cast blocking checks, in original evaluation order. Returns the first
// blocking result, or null when the cast proceeds.
async function runCastBlockChecks(spell, playerStats, campaignName, getTargetInfo) {
    const buffBlock = await checkBlockedBySpellcastingBuff(spell, playerStats, campaignName);
    if (buffBlock) return buffBlock;

    const globeTargetName = getTargetInfo ? (await getTargetInfo())?.name || null : null;

    const blockers = [
        () => checkGlobeOfInvulnerability(spell, globeTargetName, playerStats, campaignName),
        () => checkForcecageBlocked(spell, globeTargetName, playerStats, campaignName),
        () => checkAntimagicField(spell, playerStats, globeTargetName, campaignName),
    ];
    for (const check of blockers) {
        const block = await check();
        if (block) return block;
    }
    return null;
}

export async function executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos, targetPos, featEffects, campaignName, mapName, characters }) {
    // --- Block checks ---
    const block = await runCastBlockChecks(spell, playerStats, campaignName, getTargetInfo);
    if (block) return block;

    // --- Spell resolution (inline) ---
    // fix#126 (#1495): self-caught ambush resolution — see resolveMagicalAmbushOrDegrade
    // (:147-:165) for the fix#119-mirror law; degrades to hasInvisible:false here,
    // so the fold below ships the explicit metamagicHeighten:false byte.
    const hasInvisible = resolveMagicalAmbushOrDegrade(playerStats, campaignName);
    // CLA-219: Magical Ambush folds into the verified Heightened Spell transport
    // (metaCtx.metamagicHeighten) at this single choke point, so every save lane —
    // dedicated handlers, PC save prompt, NPC inline adjudicator, charm lane —
    // honours the disadvantage without per-lane threading.
    metaCtx = { ...metaCtx, metamagicHeighten: hasInvisible || !!metaCtx?.metamagicHeighten };

    const silenceBlock = await checkSilenceBlock(spell, playerStats, campaignName);
    if (silenceBlock) return silenceBlock;

    const psychicSpellsConfig = getPsychicSpellsConfig(playerStats);
    applyPsychicComponentReduction(spell, psychicSpellsConfig);
    applyHostileCastSideEffects(spell, playerStats, campaignName);

    const fullSpell = await lookupFullSpell(spell, playerStats);

    // Spell stats
    const innateSorceryActive = isInnateSorceryActive(playerStats.name, campaignName);
    const { formula, damageType, effectiveDamageType } = resolveCastDamage(spell, psychicSpellsConfig, playerStats);

    const cantripSpellAbility = spell.spellCastingAbility || playerStats.spellAbilities?.spellCastingAbility;
    const { spellToHit, spellSaveDc, spellCastingMod } = computeSpellStats(playerStats, cantripSpellAbility);

    await logGenericSpellCast({ spell, fullSpell, playerStats, campaignName, getTargetInfo, spellSaveDc, damageType, formula });

    // --- Power Word Heal/Kill, modal spells, generic automation (early returns) ---
    const earlyResult = await runTriggerChain([
        async () => passThrough(await handlePowerWordHeal({ spell, metaCtx, getTargetInfo, playerStats, campaignName, applyPowerWordHealToTarget })),
        async () => passThrough(await handlePowerWordKill({ spell, metaCtx, getTargetInfo, playerStats, campaignName, applyPowerWordKillToTarget })),
        () => passThrough(handleMassSuggestion(spell, spellSaveDc, playerStats, campaignName)),
        () => passThrough(handleCalmEmotions(fullSpell, spellSaveDc, playerStats, campaignName, metaCtx)),
        () => passThrough(handleHypnoticPatternEarly({ fullSpell, spellSaveDc, playerStats, campaignName, metaCtx, innateSorceryActive })),
        // fix#121(d) (#1458): handleConfusionEarly returns { handled: true, result: <Promise> }
        // (modalSpells.js:151-157) — the retired sync thunk read r.result?.result, i.e. `.result`
        // off a Promise: undefined EVERY time, with the IIFE detached, untracked, never awaited
        // (fix#116 await family). The chain outcome is now awaited; a rejection fails LOUDLY
        // (fix#9 family) so the confusion effect either lands or console.errors before the cast
        // is consumed. Swallow semantics preserved: consumed lane resolves undefined.
        async () => {
            const r = handleConfusionEarly({ fullSpell, spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName, triggerConfusion: (s, m, p, c, mp) => triggerConfusion(s, m, p, c, mp) });
            if (!r.handled) return null;
            if (r.result && typeof r.result.then === 'function') {
                await r.result.catch(e => {
                    console.error('[spellCast] Confusion early trigger failed:', e);
                });
            }
            return { value: undefined };
        },
        () => passThrough(handleShapechange({ fullSpell, metaCtx, playerStats, campaignName, mapName, characters })),
        () => passThrough(handleSleep({ fullSpell, spellSaveDc, playerStats, campaignName, metaCtx, characters })),
        // fix#121(b) integrity (#1455): mass heals routed through automation land inside
        // massHealUtils.confirmFn, which fires the post-cast SELF-heal rider itself
        // (CLA-038, massHealUtils.js:218-223). The chain outcome flags 'self' so the
        // merged post-cast block at :712 rolls the surge and every other rider exactly
        // once without refiring the self rider. Mass Cure Wounds' 5e :329 forwarder
        // (massCureWoundsService.js:122) carries the same self-heal ownership stamp.
        async () => {
            const r = await handleGenericAutomation({ spell, executeHandler, playerStats, campaignName, mapName, characters, metaCtx });
            if (!r.handled) return null;
            const automationType = (spell.automation?.type || '').toLowerCase();
            const ownsSelfHeal = MASS_HEAL_CONFIRM_AUTOMATION_TYPES.has(automationType);
            return { value: r.result || undefined, healRidersRun: ownsSelfHeal ? 'self' : undefined };
        },
    ]);
    if (earlyResult) {
        // fix#121(a) (#1455): the retired bare `return earlyResult.value` meant every early-handled
        // cast paid its slot while the post-cast rider block + Wild Magic chain (fix#114 live
        // producer at :538) stayed STRUCTURALLY UNREACHABLE. Mirrors the verified CLA-389 merge
        // lanes (:720/:727/:751/:759): run the post-cast block exactly once post-payment; the
        // lane keeps its own visible picker/popup via hasVisibleCastPayload precedence.
        return await runPostCastTriggersMerged({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, healRidersRun: earlyResult.healRidersRun }, earlyResult.value);
    }

    // --- NO DAMAGE PATH ---
    if (!formula) {
        const noDamage = await runNoDamagePath(spell, { fullSpell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, spellSaveDc, innateSorceryActive, hasInvisible, spellCastingMod, rollDamage });
        if (noDamage.handled) {
            // CLA-389: handled no-damage lanes (e.g. Expeditious Retreat) paid the
            // slot but previously swallowed the post-cast triggers entirely.
            return await runPostCastTriggersMerged({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, healRidersRun: noDamage.healRidersRun }, noDamage.value);
        }
    }

    // --- Hunter's Mark / Hex ---
    if (await runMarkedTargetSpell(spell, metaCtx, playerStats, campaignName, getTargetInfo)) {
        // CLA-389: marked-target spells pay their slot too — run post-cast triggers.
        return await runPostCastTriggersMerged({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo }, undefined);
    }

    // --- Damage path ---
    await expireCompelledDuelOnHarmfulCast(formula, getTargetInfo, playerStats, campaignName);

    const rangeResult = computeRange(spell, metaCtx, attackerPos, targetPos, featEffects);
    const { empEvocFormula } = computeEmpoweredEvocation(playerStats, spell, formula);
    let finalFormula = computeBlessedStrikes(spell, empEvocFormula, playerStats, campaignName, getRuntimeValue);
    finalFormula = computeRadiantSoul(spell, playerStats, campaignName, getRuntimeValue, finalFormula);
    // CLA-134: stamp the Feats of Chaos armed state at CAST time (before the
    // attack roll consumes it at the computeD20Roll seam) so the post-cast
    // surge/re-arm clause still sees an armed cast. metaCtx threading only —
    // no new persistence.
    metaCtx = { ...metaCtx, finalFormula, featsOfChaosArmedAtCast: getRuntimeValue(playerStats.name, 'featsOfChaosActive', campaignName) === true };
    const { overchannelFormula, overchannelActive, overchannelUseCount } = computeOverchannel({ spell, metaCtx, playerStats, campaignName, getRuntimeValue, empEvocFormula, baseFormula: finalFormula });

    const savePathOpts = { spell, fullSpell, metaCtx, playerStats, campaignName, mapName, characters,
        getTargetInfo, getRuntimeValue, innateSorceryActive, effectiveDamageType, spellSaveDc,
        overchannelFormula, overchannelActive, overchannelUseCount, rollAttack, rollDamage, formula, hasInvisible };

    if (rangeResult.isAutoMiss) {
        // CLA-389: an out-of-range cast still pays the slot — run post-cast triggers.
        const autoMissResult = await runAutoMissPath({ ...savePathOpts, rangeResult });
        return await runPostCastTriggersMerged({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo }, autoMissResult);
    }

    if (spell.dc || fullSpell.dc) {
        const savePathResult = await handleSavePath(savePathOpts);
        if (savePathResult) {
            // CLA-389: the save-path early return previously skipped the post-cast
            // trigger block — the slot was paid and no gate ever rolled.
            return await runPostCastTriggersMerged({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo }, savePathResult);
        }
    } else {
        // CLA-200: no-save spells (e.g. Divine Smite — no `dc` in spells.json) must fall
        // through to the post-cast trigger block below instead of early-returning.
        // handleNoSavePath only ever resolves null/undefined, and the dc/no-dc
        // branches are mutually exclusive, so the gated post-cast triggers
        // (Inspiring Smite, Wild Magic Surge, Sanctuary break, etc.) run exactly once.
        await handleNoSavePath({ spell: spell, metaCtx: metaCtx, playerStats: playerStats, campaignName: campaignName, mapName: mapName, characters: characters, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: effectiveDamageType });
    }

    // --- Post-cast triggers ---
    return await runPostCastTriggers({ spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo });
}

// fix#300 (#1462): barrel keep-with-cite — refundSpellBreakerSlot has ZERO production
// importers of THIS re-export; the refund path itself is live via the internal dispel
// chain (index.js:307 → helpers.js:219→:186/:188→:135, disk producer
// 2024/classes.json:13366 Spell Breaker — full QED in helpers.js:113 comment).
// Surface pinned by spellCastService.test.js:233 'barrel surface + zero boundary';
// kept per run2#1462 liveness-proof precedent. resolveMagicalAmbushInvisible twin
// (:131) stays pure-throw for its exported contract — hub self-catches at :162 (fix#126).
export { refundSpellBreakerSlot, resolveMagicalAmbushInvisible };
