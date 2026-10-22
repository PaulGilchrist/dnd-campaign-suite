import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { loadSpells } from '../../../../ui/dataLoader.js';
import { isForcecageBlocked } from '../../../../automation/handlers/spells/forcecageHandler.js';
import { isMazeBlocked } from '../../../../automation/handlers/spells/mazeHandler.js';
import { isBanishmentBlocked } from '../../../../automation/handlers/spells/banishmentHandler.js';
import { isImprisonmentBlocked } from '../../../../automation/handlers/spells/imprisonmentHandler.js';
import { spellHasCostlyOrConsumedMaterial } from '../../materialComponents.js';

// CLA-404: Beast Spells (Druid lv18 passive, both rulesets — the consumer reads
// ruleset-agnostic automation.passives collected from classes.json).
function hasBeastSpellsPassive(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'beast_spells');
}

export function beastSpellsAllowsCast(spell, playerStats) {
    return hasBeastSpellsPassive(playerStats) && !spellHasCostlyOrConsumedMaterial(spell);
}

// CLA-391: refuse casts while a blocksSpellcasting buff (Wild Shape shape_shift)
// is active. Refusal at this execution seam keeps the paid slot (§4 convention)
// but must log and popup — never silent.
// CLA-404: lv18+ Beast Spells bypasses the blanket block in Beast form; the cast
// proceeds unless the spell has a Material component with a cost specified or that
// consumes its Material component — those refuse with material-specific reasoning.
export async function checkBlockedBySpellcastingBuff(spell, playerStats, campaignName) {
    const buffs = (await import('./spellResolution.js')).getActiveBuffs(playerStats.name, campaignName);
    const blockingBuff = buffs.find(b => b.blocksSpellcasting);
    if (!blockingBuff) return null;
    const beastSpells = hasBeastSpellsPassive(playerStats);
    if (beastSpellsAllowsCast(spell, playerStats)) return null;
    const materialBlock = beastSpells;
    const blockName = blockingBuff.name || 'Shape-Shift';
    const refusalType = String(blockingBuff.effect || blockName).toLowerCase().replace(/\s+/g, '_') + '_refused';
    const logDescription = materialBlock
        ? `${spell.name} blocked — costly or consumed Material components are not allowed while in Beast form (Beast Spells exception).`
        : `${spell.name} blocked — ${playerStats.name} cannot cast spells while under ${blockName}.`;
    await addEntry(campaignName, {
        type: 'automation',
        automationType: refusalType,
        automationDetail: materialBlock ? 'material_component' : undefined,
        creatureName: playerStats.name,
        characterName: playerStats.name,
        name: blockName,
        description: logDescription,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[blockChecks:blocked-by-buff-log-error]", e); });
    const popupDescription = materialBlock
        ? `${spell.name} requires a Material component with a cost (or one the spell consumes) — Beast Spells does not allow it while ${playerStats.name} is in Beast form.`
        : `${spell.name} cannot be cast while ${playerStats.name} is under ${blockName} — no Spellcasting is allowed.`;
    return {
        automationPopup: {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: blockName,
                description: popupDescription,
            },
        },
    };
}

// #1466 config-drift fix: the block threshold is READ FROM DISK, not hardcoded.
// Disk owner: the Globe of Invulnerability row automation.maxBlockedSpellLevel —
// public/data/spells.json:4692 (5e) and public/data/2024/spells.json:6226, both 5.
// Disk law (spells.json:4661): "Any spell of 5th level or lower cast from outside the
// barrier can't affect creatures or objects within it". Load idiom is dataLoader's
// loadSpells (dataLoader.js:505) — the same cached fetch siblings use (spellValidation.js:7,
// mageArmorService.js:3, damageUtils.js:1; hub lookupFullSpell, execution/index.js:188,
// hits the identical /data/[2024/]spells.json URLs).
// GLOBE_MAX_BLOCKED_SPELL_LEVEL_FALLBACK is the LAST-DISTANCE default used only when
// the disk read fails outright; it is NOT a second config source — the disk-parity
// suite (blockChecks.test.js D-suite, fix#81 mirror-parity-contract precedent) pins
// both disk rows to this constant and alarms if they ever diverge.
export const GLOBE_MAX_BLOCKED_SPELL_LEVEL_FALLBACK = 5;

async function getGlobeMaxBlockedSpellLevel(rulesVersion) {
    const version = rulesVersion === '2024' ? '2024' : '5e';
    const spells = await loadSpells(version);
    const globeRow = (Array.isArray(spells) ? spells : []).find(s => s?.name === 'Globe of Invulnerability');
    const threshold = globeRow?.automation?.maxBlockedSpellLevel;
    if (typeof threshold !== 'number') {
        console.error(`[blockChecks:globe-threshold-drift] ${version} spells.json Globe of Invulnerability row missing automation.maxBlockedSpellLevel — falling back to RAW ${GLOBE_MAX_BLOCKED_SPELL_LEVEL_FALLBACK}`);
        return GLOBE_MAX_BLOCKED_SPELL_LEVEL_FALLBACK;
    }
    return threshold;
}

export async function checkGlobeOfInvulnerability(spell, targetName, playerStats, campaignName) {
    const effectiveSpellLevel = spell.level ?? spell.baseLevel ?? 1;
    if (!targetName) return null;
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];
    const globeEffects = effects.filter(te => te.effect === 'globe_barrier');
    const globeEffect = effects.find(
        te => te.target === targetName && te.effect === 'globe_barrier'
    );
    if (globeEffect) {
        const attackerProtected = globeEffects.some(ge => ge.target === playerStats.name);
        if (!attackerProtected) {
            // Threshold consulted only on a cast that can actually be blocked; loadSpells
            // is module-cached so a repeated cast costs one Map hit. Version rides the
            // caster's ruleset; the parity suite pins both ruleset rows to the same
            // value, so the choice never changes the gate.
            const maxBlockedSpellLevel = await getGlobeMaxBlockedSpellLevel(playerStats.rules);
            if (effectiveSpellLevel <= maxBlockedSpellLevel) {
                await addEntry(campaignName, {
                    type: 'automation',
                    creatureName: globeEffect.source,
                    name: 'Globe of Invulnerability',
                    description: `${spell.name} (level ${effectiveSpellLevel}) from ${playerStats.name} blocked — target is protected by Globe of Invulnerability.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[blockChecks:log-error]", e); });

                return {
                    automationPopup: {
                        type: 'popup',
                        payload: {
                            type: 'automation_info',
                            name: 'Globe of Invulnerability',
                            description: `${spell.name} (level ${effectiveSpellLevel}) is blocked by Globe of Invulnerability protecting ${targetName}.`,
                        },
                    },
                };
            }
        }
    }
    return null;
}

export async function checkForcecageBlocked(spell, targetName, playerStats, campaignName) {
    const casterName = playerStats.name;
    if (!targetName) return null;

    // A spell cannot pass between inside and outside a Forcecage prison. The
    // caster and target must be on the same side of every relevant cage.
    if (isForcecageBlocked(casterName, targetName, campaignName)) {
        await addEntry(campaignName, {
            type: 'automation',
            creatureName: casterName,
            name: 'Forcecage',
            description: `${spell.name} from ${casterName} blocked by Forcecage — ${casterName} and ${targetName} are on opposite sides of the prison.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[blockChecks:log-error]", e); });

        return {
            automationPopup: {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Forcecage',
                    description: `${spell.name} is blocked by Forcecage. ${casterName} and ${targetName} are on opposite sides of the prison, and no attack, spell, or effect can pass through it.`,
                },
            },
        };
    }

    // A spell cannot pass between inside and outside a Maze demiplane.
    if (isMazeBlocked(casterName, targetName, campaignName)) {
        await addEntry(campaignName, {
            type: 'automation',
            creatureName: casterName,
            name: 'Maze',
            description: `${spell.name} from ${casterName} blocked by Maze — ${casterName} and ${targetName} are on opposite sides of the demiplane.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[blockChecks:log-error]", e); });

        return {
            automationPopup: {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Maze',
                    description: `${spell.name} is blocked by Maze. ${casterName} and ${targetName} are on opposite sides of the demiplane, and no attack, spell, or effect can pass through it.`,
                },
            },
        };
    }

    // A spell cannot pass between inside and outside a Banishment demiplane.
    if (isBanishmentBlocked(casterName, targetName, campaignName)) {
        await addEntry(campaignName, {
            type: 'automation',
            creatureName: casterName,
            name: 'Banishment',
            description: `${spell.name} from ${casterName} blocked by Banishment — ${casterName} and ${targetName} are on opposite sides of the demiplane.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[blockChecks:log-error]", e); });

        return {
            automationPopup: {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Banishment',
                    description: `${spell.name} is blocked by Banishment. ${casterName} and ${targetName} are on opposite sides of the demiplane, and no attack, spell, or effect can pass through it.`,
                },
            },
        };
    }

    // A spell cannot pass between inside and outside an Imprisonment prison.
    if (isImprisonmentBlocked(casterName, targetName, campaignName)) {
        await addEntry(campaignName, {
            type: 'automation',
            creatureName: casterName,
            name: 'Imprisonment',
            description: `${spell.name} from ${casterName} blocked by Imprisonment — ${casterName} and ${targetName} are on opposite sides of the prison.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[blockChecks:log-error]", e); });

        return {
            automationPopup: {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Imprisonment',
                    description: `${spell.name} is blocked by Imprisonment. ${casterName} and ${targetName} are on opposite sides of the prison, and no attack, spell, or effect can pass through it.`,
                },
            },
        };
    }
    return null;
}
