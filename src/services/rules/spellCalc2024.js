import classRules from '../character/classRules2024.js';

export function getSpellAbilities(allSpells, playerStats) {
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
            });

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
