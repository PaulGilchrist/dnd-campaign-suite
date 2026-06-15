import classRules from '../../character/classRules2024.js';
import { getRuntimeValue } from '../../hooks/useRuntimeState.js';
import {
    getElfisLineageSelection,
    getElfisLineageCantrip,
    getElfisLineageLevel3Spell,
    getElfisLineageLevel5Spell,
} from '../../automation/handlers/class-other/elfishLineageHandler.js';
import {
    getGnomishLineageSelection,
    getGnomishLineageCantrip,
    getGnomishLineageLevel3Spell,
    getGnomishLineageLevel5Spell,
} from '../../automation/handlers/class-other/gnomishLineageHandler.js';

export function getSpellAbilities(allSpells, playerStats, playerSummary) {
    let spellAbilities = null;
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    let spellcasting = classLevel?.spellcasting;

    if (!spellcasting) {
        spellcasting = classRules.getHighestMajorLevel(playerStats)?.spellcasting;
    }
    if (!spellcasting) {
        spellcasting = playerStats.class.major?.spellcasting;
    }

    if (spellcasting) {
        const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
        if (spellcasting.required_major && spellcasting.required_major !== majorName) {
            spellcasting = null;
        }
        if (spellcasting) {
            spellAbilities = { ...spellcasting };
        }
    }

    // Divine Order: Thaumaturge grants one extra cantrip
    if (playerStats.class?.divineOrder === 'Thaumaturge' && playerStats.class?.name === 'Cleric') {
        spellAbilities = spellAbilities || {};
        spellAbilities.cantrips_known = (spellAbilities.cantrips_known || 0) + 1;
    }

    // Primal Order: Magician grants one extra cantrip
    if (playerStats.class?.primalOrder === 'Magician' && playerStats.class?.name === 'Druid') {
        spellAbilities = spellAbilities || {};
        spellAbilities.cantrips_known = (spellAbilities.cantrips_known || 0) + 1;
    }

    // Arcane Trickster: Mage Hand Legerdemain - adds Mage Hand to known spells and adds +3 cantrips known
    if (playerStats.class?.major?.name === 'Arcane Trickster') {
        spellAbilities = spellAbilities || {};
        if (playerStats.spells) {
            spellAbilities.spells = [...new Set([...spellAbilities.spells, ...['Mage Hand']])];
            spellAbilities.cantrips_known += 3;
        }
    }

    if (spellAbilities) {
        if (playerStats.spells) {
            spellAbilities.spells = playerStats.spells.map(spell => { return { name: spell, prepared: '' } });
        } else {
            spellAbilities.spells = [];
        }

        const castingAbility = playerStats.class.spell_casting_ability
            || playerStats.class.major?.spell_casting_ability;
        if (castingAbility) {
            spellAbilities.spellCastingAbility = castingAbility;
        }

        const spellAbility = playerStats.abilities.find(ability => ability.name === spellAbilities.spellCastingAbility);
        if (!spellAbility) {
            spellAbilities.modifier = 0;
            spellAbilities.toHit = playerStats.proficiency;
            spellAbilities.saveDc = 8 + playerStats.proficiency;
        } else {
            spellAbilities.modifier = spellAbility.bonus;
            spellAbilities.toHit = spellAbility.bonus + playerStats.proficiency;
            spellAbilities.saveDc = 8 + spellAbility.bonus + playerStats.proficiency;
        }

        spellAbilities.spells.forEach((spell) => {
            spell.prepared = 'Always';
        });

        // Add subclass (major) spells as always prepared (2024 format: {name, level})
        if (playerStats.level > 2 && playerStats.class.major && playerStats.class.major.spells) {
            playerStats.class.major.spells.forEach((subclassSpell) => {
                const spellName = subclassSpell.name || (subclassSpell.spell && subclassSpell.spell.name);
                if (!spellName) return;
                const spellLevel = subclassSpell.level || 1;
                if (playerStats.level >= spellLevel) {
                    const knownSpell = spellAbilities.spells.find((s) => s.name === spellName);
                    if (knownSpell) {
                        knownSpell.prepared = 'Always';
                    } else {
                        spellAbilities.spells.push({
                            name: spellName,
                            prepared: 'Always'
                        });
                    }
                }
            });
        }

        if (playerStats.automation) {
            const autoFeatures = [
                ...(playerStats.automation.actions || []),
                ...(playerStats.automation.bonusActions || []),
                ...(playerStats.automation.passives || []),
            ];
            autoFeatures.forEach(feature => {
                if (feature.type === 'cantrip_spellcasting_ability') {
                    const cantripEntry = spellAbilities.spells.find(s => s.name === feature.cantripName);
                    if (cantripEntry && feature.spellcastingAbility) {
                        cantripEntry.spellCastingAbility = feature.spellcastingAbility;
                    }
                }
                if (feature.type === 'elfish_lineage') {
                    const lineage = getElfisLineageSelection(playerStats, playerSummary?.campaignName);
                    if (lineage) {
                        const lineageData = feature.options?.find(o => o.name === lineage);
                        if (lineageData) {
                            // Add lineage cantrip
                            const cantripName = getElfisLineageCantrip(playerStats, playerSummary?.campaignName);
                            if (cantripName) {
                                const cantripEntry = spellAbilities.spells.find(s => s.name === cantripName);
                                if (cantripEntry) {
                                    cantripEntry.spellCastingAbility = lineageData.spellcastingAbility;
                                } else {
                                    spellAbilities.spells.push({ name: cantripName, prepared: 'Always', spellCastingAbility: lineageData.spellcastingAbility });
                                }
                            }
                            // Add level 3 spell
                            const level3Spell = getElfisLineageLevel3Spell(playerStats, playerSummary?.campaignName);
                            if (level3Spell) {
                                if (!spellAbilities.spells.find(s => s.name === level3Spell)) {
                                    spellAbilities.spells.push({ name: level3Spell, prepared: 'Always' });
                                }
                            }
                            // Add level 5 spell
                            const level5Spell = getElfisLineageLevel5Spell(playerStats, playerSummary?.campaignName);
                            if (level5Spell) {
                                if (!spellAbilities.spells.find(s => s.name === level5Spell)) {
                                    spellAbilities.spells.push({ name: level5Spell, prepared: 'Always' });
                                }
                            }
                        }
                    }
                }
                if (feature.type === 'gnomish_lineage') {
                    const lineage = getGnomishLineageSelection(playerStats, playerSummary?.campaignName);
                    if (lineage) {
                        const lineageData = feature.options?.find(o => o.name === lineage);
                        if (lineageData) {
                            // Add lineage cantrip
                            const cantripName = getGnomishLineageCantrip(playerStats, playerSummary?.campaignName);
                            if (cantripName) {
                                const cantripEntry = spellAbilities.spells.find(s => s.name === cantripName);
                                if (cantripEntry) {
                                    cantripEntry.spellCastingAbility = lineageData.spellcastingAbility;
                                } else {
                                    spellAbilities.spells.push({ name: cantripName, prepared: 'Always', spellCastingAbility: lineageData.spellcastingAbility });
                                }
                            }
                            // Add level 3 spell
                            const level3Spell = getGnomishLineageLevel3Spell(playerStats, playerSummary?.campaignName);
                            if (level3Spell) {
                                if (!spellAbilities.spells.find(s => s.name === level3Spell)) {
                                    spellAbilities.spells.push({ name: level3Spell, prepared: 'Always' });
                                }
                            }
                            // Add level 5 spell
                            const level5Spell = getGnomishLineageLevel5Spell(playerStats, playerSummary?.campaignName);
                            if (level5Spell) {
                                if (!spellAbilities.spells.find(s => s.name === level5Spell)) {
                                    spellAbilities.spells.push({ name: level5Spell, prepared: 'Always' });
                                }
                            }
                        }
                    }
                }
                if (feature.type === 'passive_rule' && feature.effect === 'always_prepared_spells' && feature.spells) {
                    feature.spells.forEach(spellName => {
                        const knownSpell = spellAbilities.spells.find(s => s.name === spellName);
                        if (!knownSpell) {
                            spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
                        }
                    });
                }
                if ((feature.type === 'free_spell' || feature.type === 'fey_reinforcements') && feature.spell) {
                    const spellNames = Array.isArray(feature.spell) ? feature.spell : [feature.spell];
                    spellNames.forEach(spellName => {
                        if (!spellAbilities.spells.find(s => s.name === spellName)) {
                            spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
                        }
                    });
                }
                if (feature.type === 'passive_rule' && feature.effect === 'spell_breaker' && feature.alwaysPreparedSpells) {
                    feature.alwaysPreparedSpells.forEach(spellName => {
                        const knownSpell = spellAbilities.spells.find(s => s.name === spellName);
                        if (!knownSpell) {
                            spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
                        }
                    });
                }
            });

            // Spell Mastery: read runtime state for player-chosen spells
            const campaignName = playerSummary?.campaignName;
            const level1Spell = getRuntimeValue(playerStats.name, '_Spell_Mastery_level1', campaignName);
            const level2Spell = getRuntimeValue(playerStats.name, '_Spell_Mastery_level2', campaignName);
            if (level1Spell && !spellAbilities.spells.find(s => s.name === level1Spell)) {
                spellAbilities.spells.push({ name: level1Spell, prepared: 'Always' });
            }
            if (level2Spell && !spellAbilities.spells.find(s => s.name === level2Spell)) {
                spellAbilities.spells.push({ name: level2Spell, prepared: 'Always' });
            }

            // Abjuration Savant: read runtime state for player-chosen Abjuration spells
            const abjurationSavantSelection = getRuntimeValue(playerStats.name, '_Abjuration_Savant_selection', campaignName);
            if (abjurationSavantSelection) {
                const abjurationSpells = Array.isArray(abjurationSavantSelection) ? abjurationSavantSelection : [];
                for (const spellName of abjurationSpells) {
                    if (!spellAbilities.spells.find(s => s.name === spellName)) {
                        spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
                    }
                }
            }

            // Divination Savant: read runtime state for player-chosen Divination spells
            const divinationSavantSelection = getRuntimeValue(playerStats.name, '_Divination_Savant_selection', campaignName);
            if (divinationSavantSelection) {
                const divinationSpells = Array.isArray(divinationSavantSelection) ? divinationSpells : [];
                for (const spellName of divinationSpells) {
                    if (!spellAbilities.spells.find(s => s.name === spellName)) {
                        spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
                    }
                }
            }

            // Illusion Savant: read runtime state for player-chosen Illusion spells
            const illusionSavantSelection = getRuntimeValue(playerStats.name, '_Illusion_Savant_selection', campaignName);
            if (illusionSavantSelection) {
                const illusionSpells = Array.isArray(illusionSavantSelection) ? illusionSavantSelection : [];
                for (const spellName of illusionSpells) {
                    if (!spellAbilities.spells.find(s => s.name === spellName)) {
                        spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
                    }
                }
            }

            // Phantasmal Creatures: always prepare Summon Beast and Summon Fey
            const hasPhantasmalCreatures = playerStats.automation?.passives?.some(p => p.type === 'phantasmal_creatures');
            if (hasPhantasmalCreatures) {
                const pcPassive = playerStats.automation.passives.find(p => p.type === 'phantasmal_creatures');
                const alwaysPrepared = pcPassive?.alwaysPreparedSpells || [];
                for (const spellName of alwaysPrepared) {
                    if (!spellAbilities.spells.find(s => s.name === spellName)) {
                        spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
                    }
                }
            }

            // Improved Illusions: grant Minor Illusion cantrip to Illusionist subclass
            const hasImprovedIllusions = playerStats.automation?.passives?.some(p => p.type === 'improved_illusions');
            if (hasImprovedIllusions && allSpells) {
                const minorIllusion = spellAbilities.spells.find(s => s.name === 'Minor Illusion');
                if (!minorIllusion) {
                    const minorIllusionDetail = allSpells.find(s => s.name === 'Minor Illusion');
                    if (minorIllusionDetail) {
                        spellAbilities.spells.push({ ...minorIllusionDetail, prepared: 'Always' });
                    }
                } else if (minorIllusion.casting_time !== '1 bonus action' && minorIllusion.casting_time !== 'Bonus Action') {
                    // Override casting time to Bonus Action for Improved Illusions
                    const minorIllusionDetail = allSpells.find(s => s.name === 'Minor Illusion');
                    if (minorIllusionDetail) {
                        const idx = spellAbilities.spells.findIndex(s => s.name === 'Minor Illusion');
                        if (idx >= 0) {
                            spellAbilities.spells[idx] = { ...minorIllusionDetail, prepared: 'Always', casting_time: '1 bonus action' };
                        }
                    }
                }
            }

            // Ritual Adept: add all ritual-tagged spells from the spellbook that aren't already known
            const ritualSpellsPassives = playerStats.automation.ritualSpells || [];
            if (ritualSpellsPassives.length > 0 && allSpells) {
                ritualSpellsPassives.forEach(_ritualFeature => {
                    allSpells.forEach(spellDetail => {
                        if (spellDetail.ritual && !spellAbilities.spells.find(s => s.name === spellDetail.name)) {
                            spellAbilities.spells.push({ ...spellDetail, prepared: 'Always' });
                        }
                    });
                });
            }
        }

        if (spellAbilities.spells.length > 0) {
            spellAbilities.spells = spellAbilities.spells.map(spell => {
                let spellDetail = allSpells.find((spellDetail) => spellDetail.name === spell.name);
                if (spellDetail) {
                    return { ...spellDetail, prepared: spellDetail.level === 0 ? 'Always' : spell.prepared };
                }
                return { ...spell };
            });

            spellAbilities.spells.sort((a, b) => {
                if (a.level !== b.level) {
                    return a.level - b.level;
                } else {
                    return a.name.localeCompare(b.name);
                }
            });
        }
    }

    return spellAbilities;
 }
