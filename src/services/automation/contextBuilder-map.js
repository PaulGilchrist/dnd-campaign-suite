import { getCombatContext, getTargetFromAttacker } from '../rules/combat/damageUtils.js';
import * as mapsService from '../maps/mapsService.js';
import { loadNPCs } from '../npcs/npcsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem, rangeToFeet } from '../rules/combat/rangeValidation.js';
import { computeCover } from '../rules/combat/coverService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getWolfAdvantageAgainst } from '../combat/auras/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/auras/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/auras/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/auras/coronaAuraUtils.js';
import { hasAuraOfProtection } from '../combat/auras/auraOfProtection.js';
import { isWithinRange } from '../rules/combat/rangeCheck.js';
import { buildAttackContextSync } from './contextBuilder-sync.js';

export function buildAttackContext(attack, playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects, opts) {
    if (!mapName) {
        return buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects, opts);
    }

    const basePromise = buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects, opts);

    return Promise.all([
        basePromise,
        mapsService.loadMapData(campaignName, mapName),
        loadNPCs(campaignName),
    ]).then(([base, mapData, npcs]) => {
        const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
        if (!attackerPlayer) return base;

        let targetPos = null;
        return getCombatContext(campaignName).then(async cs => {
            if (cs) {
                const target = getTargetFromAttacker(cs, playerStats.name);
                if (target) {
                    const targetPlayer = mapData?.players?.find(p => p.name === target.name);
                    const targetNpc = mapData?.placedItems?.length
                        ? getNearestPlacedItem(mapData.placedItems, target.name, { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY })
                        : null;
                    if (targetPlayer) {
                        targetPos = { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
                    } else if (targetNpc) {
                        targetPos = { gridX: targetNpc.gridX, gridY: targetNpc.gridY };
                    }
                }
            }

            if (targetPos && base.forcedMode === undefined) {
                let mapAdv = 0;
                let mapDis = 0;
                const wolfResult = await getWolfAdvantageAgainst({
                    targetPos,
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                });
                if (wolfResult.advantage) {
                    mapAdv++;
                }
                const duplicityResult = await getDuplicityAdvantageAgainst({
                    targetPos,
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                });
                if (duplicityResult.advantage) {
                    mapAdv++;
                }
                const lionResult = await getLionDisadvantageAgainst({
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                });
                if (lionResult.disadvantage) {
                    mapDis++;
                }
                if (base.targetName) {
                    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                    const protectionEffect = storedEffects.find(
                        te => te.effect === 'protection' && te.target === base.targetName
                    );
                    if (protectionEffect) {
                        mapDis++;
                    }
                }
                const coronaResult = getCoronaSaveDisadvantage({
                    targetName: base.targetName,
                    campaignName,
                    mapData,
                    damageType: base.damageType,
                });
                if (coronaResult.disadvantage) {
                    mapDis++;
                }
                base._mapAdv = mapAdv;
                base._mapDis = mapDis;
            }

            // When map is active but target has no position, fall back to no-map aura checks
            if (!targetPos && base.forcedMode === undefined) {
                let mapAdv = 0;
                let mapDis = 0;
                const noMapWolf = await getWolfAdvantageAgainst({
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                    skipRangeCheck: true,
                });
                if (noMapWolf.advantage) {
                    mapAdv++;
                }
                const noMapDuplicity = await getDuplicityAdvantageAgainst({
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                    skipRangeCheck: true,
                });
                if (noMapDuplicity.advantage) {
                    mapAdv++;
                }
                const noMapLion = await getLionDisadvantageAgainst({
                    attackerName: playerStats.name,
                    campaignName,
                    mapData,
                    skipRangeCheck: true,
                });
                if (noMapLion.disadvantage) {
                    mapDis++;
                }
                if (base.targetName) {
                    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                    const protectionEffect = storedEffects.find(
                        te => te.effect === 'protection' && te.target === base.targetName
                    );
                    if (protectionEffect) {
                        mapDis++;
                    }
                }
                const noMapCorona = getCoronaSaveDisadvantage({
                    targetName: base.targetName,
                    campaignName,
                    mapData,
                    damageType: base.damageType,
                    skipRangeCheck: true,
                });
                if (noMapCorona.disadvantage) {
                    mapDis++;
                }
                base._mapAdv = mapAdv;
                base._mapDis = mapDis;
            }

            const numericRange = rangeToFeet(attack.range) || 0;
            const isRanged = numericRange > 8;
            const feats = featRangeEffects || { ignoresMeleeDisadvantage: false, ignoresLongRangeDisadvantage: false, rangeMultiplier: 1, spellRangeBonus: 0 };

            // Improved Illusions: only apply range bonus to Illusion spells with range 10+ feet
            const hasImprovedIllusions = playerStats.automation?.passives?.some(p => p.type === 'improved_illusions');
            const isIllusionSpell = attack.school && attack.school.toLowerCase() === 'illusion';
            const effectiveRangeBonus = (hasImprovedIllusions && isIllusionSpell && numericRange >= 10)
                ? (feats.spellRangeBonus || 0) + 60
                : feats.spellRangeBonus || 0;

            if (targetPos) {
                const effectiveRange = isRanged ? numericRange + effectiveRangeBonus : attack.range;
                const distanceFt = getDistanceFeet(
                    { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    targetPos
                );
                const rangeResult = computeRangeEffect(effectiveRange, distanceFt, feats);
                if (rangeResult.mode === 'disadvantage') {
                    base._rangeDis = (base._rangeDis || 0) + 1;
                    base.rangeReason = rangeResult.reason;
                } else if (rangeResult.mode === 'miss') {
                    base.isAutoMiss = true;
                    base.rangeReason = rangeResult.reason;
                }
            }

            if (!base.isAutoMiss && targetPos) {
                const walls = mapData?.walls || new Set();
                let coverResult = computeCover(
                    { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    { gridX: targetPos.gridX, gridY: targetPos.gridY },
                    walls,
                    mapData?.placedItems || [],
                );

                // Sharpshooter "Bypass Cover": ranged WEAPON attacks ignore Half/Three-Quarters
                // cover only. Full cover still blocks the attack; melee and spell attacks keep cover.
                // (Live sheet rows leave weaponType empty; spell rows carry school — the same
                // spell discriminator used by the improved-illusions check above.)
                const ignoreCoverPassive = (playerStats.automation?.passives || []).find(
                    p => p.type === 'passive_rule' && p.effect === 'ignore_cover_ranged'
                );
                const isRangedWeaponAttack = isRanged && !attack.school && attack.weaponType !== 'spell';
                if (ignoreCoverPassive && isRangedWeaponAttack
                    && getIgnorableCoverLevels(ignoreCoverPassive).includes(coverResult.level)) {
                    coverResult = { level: 'none', acBonus: 0 };
                    base.coverReason = 'Sharpshooter';
                }

                // Check Nature's Sanctuary half cover — any creature in the sanctuary list
                const sanctuaryCreatures = getRuntimeValue(playerStats.name, 'naturesSanctuaryCreatures', campaignName);
                if (sanctuaryCreatures?.includes(base.targetName) && coverResult.acBonus < 2) {
                    coverResult = { level: 'half', acBonus: 2 };
                    base.coverReason = 'Nature\'s Sanctuary';
                }

                // Check Bulwark of Force half cover — any PC with the buff can grant cover to the target
                if (coverResult.acBonus < 2 && mapData?.players) {
                    for (const player of mapData.players) {
                        const bulwarkActive = getRuntimeValue(player.name, 'bulwarkOfForceActive');
                        if (bulwarkActive) {
                            const bulwarkTargets = getRuntimeValue(player.name, 'bulwarkOfForceTargets') || [];
                            if (bulwarkTargets.includes(base.targetName)) {
                                coverResult = { level: 'half', acBonus: 2 };
                                base.coverReason = 'Bulwark of Force';
                                break;
                            }
                        }
                    }
                }

                // Check Smite of Protection half cover (allies within Aura of Protection range)
                const smiteCoverActive = getRuntimeValue(playerStats.name, 'smiteOfProtectionActive', campaignName);
                if (smiteCoverActive && coverResult.acBonus < 2) {
                    const auraSource = getAuraSourceForSmiteCover(playerStats, mapData);
                    if (auraSource) {
                        const inAura = await checkInAuraOfProtection(auraSource, base.targetName, playerStats);
                        if (inAura) {
                            coverResult = { level: 'half', acBonus: 2 };
                            base.coverReason = 'Smite of Protection';
                        }
                    }
                }

                // Check Defensive Duelist AC bonus (2024 rules)
                const ddActiveBuffs = getRuntimeValue(base.targetName, 'activeBuffs', campaignName) || [];
                const ddBuff2 = ddActiveBuffs.find(b => b.effect === 'defensive_duelist');
                const coverProf = playerStats.proficiency || 0;
                if (ddBuff2 && coverProf > coverResult.acBonus) {
                    coverResult.acBonus = coverProf;
                }

                // Check Bait and Switch AC bonus (2024 rules)
                const baitAndSwitchActive = getRuntimeValue(base.targetName, 'baitAndSwitchActive', campaignName);
                if (baitAndSwitchActive) {
                    const baitAndSwitchBonus = Number(getRuntimeValue(base.targetName, 'baitAndSwitchBonus', campaignName) || 0);
                    if (baitAndSwitchBonus > coverResult.acBonus) {
                        coverResult.acBonus = baitAndSwitchBonus;
                    }
                }

                if (coverResult.level === 'full') {
                    base.isAutoMiss = true;
                    base.coverReason = 'Target has full cover';
                } else if (coverResult.acBonus > 0) {
                    base.coverAcBonus = coverResult.acBonus;
                    base.coverLevel = coverResult.level;
                }
            }

            if (isRanged && !base.isAutoMiss) {
                const nearbyThreats = (mapData?.placedItems || [])
                    .filter(i => i.type === 'npc')
                    .map(i => {
                        const npcData = npcs?.find(n => n.name === i.name || n.name === i.name?.replace(/\s+\d+$/, ''));
                        return { ...i, attitude: npcData?.attitude };
                    })
                    .filter(i => isHostileNPC(i))
                    .map(i => ({ gridX: i.gridX, gridY: i.gridY, name: i.name }));

                const meleeResult = computeMeleeProximityEffect(true, attackerPlayer, nearbyThreats, feats);
                if (meleeResult.mode === 'disadvantage') {
                    base._meleeDis = (base._meleeDis || 0) + 1;
                    base.rangeReason = meleeResult.reason;
                }
            }

             // Resolve accumulated map-based adv/dis counts
            if (base.forcedMode === undefined && (base._mapAdv || base._mapDis || base._rangeDis || base._meleeDis)) {
                const totalMapAdv = base._mapAdv || 0;
                const totalMapDis = (base._mapDis || 0) + (base._rangeDis || 0) + (base._meleeDis || 0);
                if (totalMapAdv > totalMapDis) {
                    base.forcedMode = 'advantage';
                } else if (totalMapDis > totalMapAdv) {
                    base.forcedMode = 'disadvantage';
                }
            }

            return base;
        });
    })
        .catch(() => basePromise);
}

// Cover level values mirror COVER in rules/combat/coverService.js
const COVER_LEVEL_BY_TYPE = {
    half: 'half',
    threequarter: 'threeQuarter',
    threequarters: 'threeQuarter',
    full: 'full',
};

function getIgnorableCoverLevels(passive) {
    if (!passive?.coverTypes?.length) return ['half', 'threeQuarter'];
    return passive.coverTypes
        .map(t => COVER_LEVEL_BY_TYPE[String(t).toLowerCase().replace(/[^a-z]/g, '')])
        .filter(Boolean);
}

function getAuraSourceForSmiteCover(playerStats, mapData) {
    if (!mapData?.players?.length) return null;
    return mapData.players.find(p => hasAuraOfProtection(playerStats) && p.name === playerStats.name) || null;
}

async function checkInAuraOfProtection(auraSource, targetName, playerStats) {
    const auraRange = hasAuraOfProtection(playerStats) ? 30 : 10;
    return await isWithinRange(auraSource.name, targetName, auraRange);
}
