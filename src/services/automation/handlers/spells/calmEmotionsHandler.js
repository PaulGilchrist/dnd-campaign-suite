import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue, setRuntimeObject } from '../../../../hooks/runtime/useRuntimeState.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { isDistanceInRange } from '../../../rules/combat/rangeCheck.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';

// Calm Emotions: Concentration, up to 1 minute = 10 rounds (CLA-033 clock
// convention). Concentration break clears the clock via
// clearPendingExpirations(casterName); clock expiry is idempotent.
export const CALM_EMOTIONS_DURATION_ROUNDS = 10;

/**
 * SP-020: resolve which creatures Calm Emotions may actually target —
 * Humanoids only (B2), inside the 20-foot-radius sphere when map token
 * coordinates are known (B4). Unmeasurable geometry (no active map, no
 * positioned tokens, unplaced creature) is lenient per playbook §42 and
 * surfaces an advisory reason instead of silently gating.
 *
 * @returns {Promise<{eligible: string[], ineligible: {name: string, reason: string}[], advisory: string[]}>}
 */
async function checkCalmEmotionsHumanoid(targetName, creature, advisory) {
    if (creature?.type === 'player') return true;
    let monsterData = null;
    try {
        monsterData = await getMonsterData(targetName, null);
    } catch (e) {
        console.error('[calmEmotions] Error loading monster data:', e);
    }
    const type = String(monsterData?.type || '').toLowerCase();
    if (!type) {
        // No stat block — lenient (friendsService convention).
        advisory.push('no_statblock_lenient');
        return true;
    }
    return type === 'humanoid';
}

async function readSphereTokens(campaignName, casterName, advisory) {
    const activeMapName = getRuntimeValue('__map__', 'activeMapName');
    if (!activeMapName) {
        advisory.push('no_map_lenient');
        return { tokens: [], casterToken: null, sphereMeasurable: false };
    }
    let tokens = [];
    try {
        const mapData = await loadMapData(campaignName, activeMapName);
        tokens = [...(mapData?.players || []), ...(mapData?.placedItems || [])]
            .filter(t => t && Number.isFinite(t.gridX) && Number.isFinite(t.gridY));
    } catch (e) {
        console.error('[calmEmotions] Error loading map data:', e);
        advisory.push('map_unavailable_lenient');
    }
    const casterToken = tokens.find(t => t.name === casterName) || null;
    if (!casterToken && !advisory.length) {
        advisory.push('caster_unplaced_lenient');
    }
    return { tokens, casterToken, sphereMeasurable: !!casterToken && !advisory.length };
}

export async function resolveCalmEmotionsEligibility({ campaignName, casterName, creatures }) {
    const eligible = [];
    const ineligible = [];
    const advisory = [];

    const { tokens, casterToken, sphereMeasurable } = await readSphereTokens(campaignName, casterName, advisory);

    for (const creature of creatures || []) {
        const targetName = creature.name;
        if (!targetName) continue;

        if (targetName === casterName) {
            eligible.push(targetName);
            continue;
        }

        if (!await checkCalmEmotionsHumanoid(targetName, creature, advisory)) {
            ineligible.push({ name: targetName, reason: 'not_humanoid' });
            continue;
        }

        if (!sphereMeasurable) {
            eligible.push(targetName);
            continue;
        }

        const token = tokens.find(t => t.name === targetName) || null;
        if (!token) {
            advisory.push(`${targetName}:unplaced_lenient`);
            eligible.push(targetName);
            continue;
        }
        const dist = getDistanceFeet(casterToken, token);
        if (!isDistanceInRange(dist, 20)) {
            ineligible.push({ name: targetName, reason: `out_of_sphere_${Math.round(dist)}ft` });
            continue;
        }
        eligible.push(targetName);
    }

    return { eligible, ineligible, advisory: [...new Set(advisory)] };
}

/**
 * Log the creatures Calm Emotions cannot affect (SP-020 B2/B4) plus any
 * lenient-geometry advisories (playbook §42 — advisory, never silent).
 */
export async function logCalmEmotionsEligibility({ campaignName, casterName, ineligible, advisory }) {
    for (const { name, reason } of ineligible || []) {
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'calm_emotions_ineligible',
            automationDetail: reason,
            characterName: name,
            sourceName: casterName,
            description: `${name} is not affected by Calm Emotions (${reason === 'not_humanoid' ? 'not a Humanoid' : reason.replace('out_of_sphere', 'outside the 20-foot sphere')}).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[calmEmotions] Error logging ineligible:', e); });
    }
    for (const note of advisory || []) {
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'calm_emotions_sphere_advisory',
            automationDetail: note,
            characterName: casterName,
            description: `Calm Emotions sphere could not be measured for this casting (${note}) — selection is advisory; GM enforces the 20-foot-radius sphere.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[calmEmotions] Error logging sphere advisory:', e); });
    }
}

/**
 * Register the 1-minute concentration duration clock (SP-020 B5) on the
 * caster's store. Expiry clears calm_emotions + indifferent effects via the
 * 'calm_emotions_end' expiration handler; concentration break purges both
 * the clock and the effects — each path is idempotent.
 */
export function registerCalmEmotionsExpiration({ casterName, campaignName }) {
    addExpiration({
        attackerName: casterName,
        targetName: casterName,
        effects: [{ type: 'calm_emotions_end', source: casterName }],
        campaignName,
        rounds: CALM_EMOTIONS_DURATION_ROUNDS,
        expireOnCreatureName: null,
    });
}

// ── Shared helpers (also used by the modal) ──────────────────────────

/**
 * Apply the immunity/suppress path for a single creature.
 */
export async function applyCalmEmotionsImmunity({
    targetName, casterName, campaignName, dc,
}) {
    // Remove charmed/frightened from activeConditions and record what was suppressed
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const lowerConditions = conditions.map(c => String(c).toLowerCase());
    const suppressedConditions = [];
    if (lowerConditions.includes('charmed')) suppressedConditions.push('charmed');
    if (lowerConditions.includes('frightened')) suppressedConditions.push('frightened');

    const filtered = conditions.filter(c =>
        String(c).toLowerCase() !== 'charmed' &&
        String(c).toLowerCase() !== 'frightened'
    );

    // Add activeBuff granting immunity
    const activeBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs', campaignName))
        ? getRuntimeValue(targetName, 'activeBuffs', campaignName) : [];
    const newBuffs = [...activeBuffs, {
        name: 'Calm Emotions',
        effect: 'calm_emotions',
        conditionImmunity: ['Charmed', 'Frightened'],
        sourceCharacter: casterName,
        duration: 'concentration',
    }];

    // ONE merged per-target write (§39: un-awaited per-key writes to the
    // same endpoint reorder network-side and can resurrect purged keys).
    const patch = { activeBuffs: newBuffs };
    if (filtered.length !== conditions.length) patch.activeConditions = filtered;
    setRuntimeObject(targetName, patch, campaignName);

    // Track targetEffect for concentration cleanup
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? [...targetEffects] : [];
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'calm_emotions'
    );
    const calmEffect = {
        target: targetName,
        effect: 'calm_emotions',
        mode: 'immunity',
        source: casterName,
        suppressedConditions,
        dc: dc,
        duration: 'concentration',
    };
    if (existingIdx >= 0) {
        effects[existingIdx] = calmEffect;
    } else {
        effects.push(calmEffect);
    }
    await setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    // Log
    if (suppressedConditions.length > 0) {
        await addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Calm Emotions (Suppressed: ' + suppressedConditions.join(', ') + ')',
            reason: 'Calm Emotions spell',
            note: `${targetName}'s ${suppressedConditions.join(', ')} condition(s) are suppressed and immune to Charmed/Frightened.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[calmEmotions] Error:', e); });
    } else {
        await addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Calm Emotions (Immune to Charmed/Frightened)',
            reason: 'Calm Emotions spell',
            note: `${targetName} is immune to Charmed and Frightened.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[calmEmotions] Error:', e); });
    }
}

/**
 * SP-020 B3: apply the indifference path for a single creature — a
 * registered advisory attitude targetEffect. RAW option 2 makes the target
 * indifferent (GM-enforced attitude), NOT Charmed; the app has no attitude
 * consumer, so this is advisory and documented as such in the registry.
 */
export async function applyCalmEmotionsIndifferent({
    targetName, casterName, campaignName, dc,
}) {
    registerTargetEffect(campaignName, targetName, 'indifferent', casterName, { dc });

    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Indifferent (Calm Emotions)',
        reason: 'Calm Emotions spell',
        note: `${targetName} is Indifferent toward creatures it was hostile toward (GM-enforced advisory — no attitude consumer). Indifference ends if ${targetName} takes damage or witnesses an ally take damage; attitude returns to normal when the spell ends.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[calmEmotions] Error:', e); });
}

// ── Handler (non-interactive / generic automation route) ─────────────

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures in combat. Calm Emotions has no effect.',
            },
        };
    }

    const casterName = playerStats.name;

    // Register concentration
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const spellDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Calm Emotions', spellDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    // SP-020 B5: 1-minute concentration duration clock on the caster store.
    registerCalmEmotionsExpiration({ casterName, campaignName });

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'CHA',
        saveDc: dc,
        attackScope: 'aoe',
    });

    // SP-020 B2/B4: Humanoid-only, sphere-measured when coordinates known.
    const { eligible, ineligible, advisory } = await resolveCalmEmotionsEligibility({
        campaignName, casterName, creatures: cs.creatures,
    });
    await logCalmEmotionsEligibility({ campaignName, casterName, ineligible, advisory });

    const targets = cs.creatures.filter(c => c.name !== casterName && eligible.includes(c.name));

    let affectedCount = 0;
    let savedCount = 0;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        const { promptId, promise } = createSaveListener(campaignName, {
            targetName,
            saveType: 'CHA',
            saveDc: dc,
            dcSuccess: 'none',
            disadvantage: action.metaCtx?.metamagicHeighten === targetName,
        });

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts Calm Emotions! ${targetName} must make a CHA save (DC ${dc}) or be affected.`,
            promptId,
        }).catch((e) => { console.error('[calmEmotions] Error:', e); });

        const saveResult = await promise;

        if (saveResult.success) {
            savedCount++;
            await recordCalmTargetResult(campaignName, targetName, saveResult, 'success');
            await logCalmEmotionsSave({
                    campaignName,
                    casterName,
                    targetName,
                    dc,
                    success: true,
                    description: `${targetName} succeeded on CHA save against Calm Emotions.`,
                });
        } else {
            affectedCount++;
            // Default to immunity path for non-interactive route
            await applyCalmEmotionsImmunity({ targetName, casterName, campaignName, dc });

            await recordCalmTargetResult(campaignName, targetName, saveResult, 'failure');

            await logCalmEmotionsSave({
                    campaignName,
                    casterName,
                    targetName,
                    dc,
                    success: false,
                    description: `${targetName} failed CHA save against Calm Emotions. Granted immunity to Charmed/Frightened.`,
                });

            results.push(`${targetName} is immune to Charmed and Frightened.`);
        }
    }

    const summary = affectedCount > 0
        ? `Calm Emotions affects ${affectedCount} creature(s). ${results.join(' ')} ${savedCount} creature(s) saved.`
        : `No creatures affected by Calm Emotions. ${savedCount} creature(s) saved.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}

async function recordCalmTargetResult(campaignName, targetName, saveResult, saveOutcome) {
    await addTargetResult(campaignName, {
        targetName,
        saveResult: saveOutcome,
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });
}

async function logCalmEmotionsSave({ campaignName, casterName, targetName, dc, success, description }) {
    await addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-calm-emotions',
        targetName,
        saveDc: dc,
        saveType: 'CHA',
        success,
        description,
    }).catch((e) => { console.error('[calmEmotions] Error:', e); });
}
