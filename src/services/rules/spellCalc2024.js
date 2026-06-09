import classRules from '../character/classRules2024.js';

export function getSpellAbilities(allSpells, playerStats) {
    let spellAbilities = null;
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    let spellcasting = classLevel?.spellcasting;

    if (!spellcasting) {
        spellcasting = classRules.getHighestMajorLevel(playerStats)?.spellcasting;
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

    if (spellAbilities) {
        if (playerStats.spells) {
            spellAbilities.spells = playerStats.spells.map(spell => { return { name: spell, prepared: '' } });
        } else {
            spellAbilities.spells = [];
        }

        if (playerStats.class.spell_casting_ability) {
            spellAbilities.spellCastingAbility = playerStats.class.spell_casting_ability;
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
                if (feature.type === 'free_spell' && feature.spell) {
                    const knownSpell = spellAbilities.spells.find(s => s.name === feature.spell);
                    if (!knownSpell) {
                        spellAbilities.spells.push({ name: feature.spell, prepared: 'Always' });
                    }
                }
            });
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
