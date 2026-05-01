import { cloneDeep, merge, uniqBy } from 'lodash';
import rules from './rules'
import { featuresToIgnore, actions, bonusActions, reactions, characterAdvancement } from './feature-categories-5e'

const raceRules = {
    getImmunities: (playerSummary) => {
           // Dependencies: None
        let immunities = [];
        if(playerSummary.race.name === "Elf") {
            immunities.push("Magical Sleep"); // Fey Ancestry
           }
        if(playerSummary.class.name === "Monk" && playerSummary.level > 9) {
            immunities.push("Disease"); // Purity of Body
            immunities.push("Poison"); // Purity of Body
           }
        if(playerSummary.class.name === "Paladin" && playerSummary.level > 2) {
            immunities.push("Disease"); // Divine Health
           }
        if(playerSummary.immunities) {
            immunities = [...new Set([...immunities, ...playerSummary.immunities])];
           }
        return immunities.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        },
    getRace: (allRaces, playerSummary) => {
        const race = merge(cloneDeep(allRaces.find((race) => race.name === playerSummary.race.name)), cloneDeep(playerSummary.race));
        if (race.ability_bonuses) {
        race.ability_bonuses = race.ability_bonuses.map((ability_bonus) => {
            ability_bonus.ability_score = rules.getAbilityLongName(ability_bonus.ability_score);
            return ability_bonus;
           });
              }
        const subrace = playerSummary.race.subrace
                        ? race.subraces?.find((subrace) => subrace.name === playerSummary.race.subrace.name)
                        : null;
        if (subrace) {
            race.subrace = merge(cloneDeep(subrace), cloneDeep(playerSummary.subrace));
           } else {
            race.subrace = null;
           }
        delete race.subraces; // We don't need these anymore
        if (race.subrace && race.subrace.ability_bonuses) {
                    race.subrace.ability_bonuses = race.subrace.ability_bonuses.map((ability_bonus) => {
                        ability_bonus.ability_score = rules.getAbilityLongName(ability_bonus.ability_score);
                        return ability_bonus;
                        });
                    }
        return race;
        },
        getRacialBonus: (playerStats, abilityName) => {
             // Dependencies: Race
        let racialBonus = 0;
        if (playerStats.race.ability_bonuses) {
            let ability_bonus = playerStats.race.ability_bonuses.find((ability_bonus) => ability_bonus.ability_score == abilityName);
            if (ability_bonus) {
                racialBonus += ability_bonus.bonus;
                  }
              }
                if (playerStats.race.subrace && playerStats.race.subrace.ability_bonuses) {
                    let subrace_ability_bonus = playerStats.race.subrace.ability_bonuses.find((ab) => ab.ability_score == abilityName);
                    if (subrace_ability_bonus) {
                        racialBonus += subrace_ability_bonus.bonus;
                     }
                       }
        return racialBonus;
        },
    getResistances: (playerSummary) => {
           // Dependencies: None
        let resistances = [];
        if(playerSummary.race.name === "Dragonborn") {
            switch(playerSummary.race.type) {
                case 'Black': resistances.push("Acid"); break;
                case 'Blue': resistances.push("Lightning"); break;
                case 'Brass': resistances.push("Fire"); break;
                case 'Bronze': resistances.push("Ligntning"); break;
                case 'Copper': resistances.push("Acid"); break;
                case 'Gold': resistances.push("Fire"); break;
                case 'Green': resistances.push("Poison"); break;
                case 'Red': resistances.push("Fire"); break;
                case 'Silver': resistances.push("Cold"); break;
                case 'White': resistances.push("Cold"); break;
               }
           } else if(playerSummary.race.name === "Elf") {
            resistances.push("Charm"); // Fey Ancestry
           } else if(playerSummary.race.name === "Halfling") {
            resistances.push("Frightened"); // Brave
            if(playerSummary.race.subrace && playerSummary.race.subrace.name === "Scout Halfling") {
                resistances.push("Poison"); // Scout Resilience
               }
           } else if(playerSummary.race.name === "Tiefling") {
            resistances.push("Fire"); // Hellish Resistance
           }
        if(playerSummary.resistances) {
            resistances = [...new Set([...resistances, ...playerSummary.resistances])];
           }
        return resistances.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        },
    getSenses: (playerStats) => {
           // Dependencies: Race
        const senses = playerStats.senses ? [...playerStats.senses] : [];
        const darkvisionInSenses = senses.some((sense) => sense.name === 'Darkvision');
        const darkvisionRace = playerStats.race.traits.some((trait) => trait.name === 'Darkvision');
        if (darkvisionRace && !darkvisionInSenses) {
            senses.push({ name: 'Darkvision', value: '60 ft.' });
           }
        return senses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        },
    addTraits: (traits) => {
            const categorizedTraits = {
                actions: [],
                bonusActions: [],
                reactions: [],
                specialActions: [],
                characterAdvancement: []
               }
            if(traits) {
                traits.forEach(trait => {
                    const traitSummary = {
                        name: trait.name,
                        description: trait.description,
                        details: trait.details
                       };
                    if(featuresToIgnore.includes(trait.name)) {
                                                // Do nothing - this trait is ignored entirely
                                            } else if(characterAdvancement.includes(trait.name) && !categorizedTraits.characterAdvancement.some(f => f.name == traitSummary.name)) {
                                            categorizedTraits.characterAdvancement.push(traitSummary);
                                            } else if(actions.includes(trait.name) && !categorizedTraits.actions.some(action => action.name == traitSummary.name)) {
                                            categorizedTraits.actions.push(traitSummary);
                                            } else if(bonusActions.includes(trait.name) && !categorizedTraits.bonusActions.some(bonusAction => bonusAction.name == traitSummary.name)) {
                                            categorizedTraits.bonusActions.push(traitSummary);
                                            } else if(reactions.includes(trait.name) && !categorizedTraits.reactions.some(reaction => reaction.name == traitSummary.name)) {
                                            categorizedTraits.reactions.push(traitSummary);
                                            } else if(!categorizedTraits.specialActions.some(specialAction => specialAction.name == traitSummary.name)) {
                                            categorizedTraits.specialActions.push(traitSummary);
                                            }
                   });
               }
            return categorizedTraits;
             },
    getTraits: (playerStats) => {
           // Dependencies: Race
        let traits = raceRules.addTraits(playerStats.race.traits);
        if(playerStats.race.subrace && playerStats.race.subrace.racial_traits) {
            const subraceTraits = raceRules.addTraits(playerStats.race.subrace.racial_traits);
            traits = {
                actions: uniqBy([...traits.actions, ...subraceTraits.actions], 'name'),
                bonusActions: uniqBy([...traits.bonusActions, ...subraceTraits.bonusActions], 'name'),
                reactions: uniqBy([...traits.reactions, ...subraceTraits.reactions], 'name'),
                specialActions: uniqBy([...traits.specialActions, ...subraceTraits.specialActions], 'name'),
                characterAdvancement: uniqBy([...traits.characterAdvancement, ...subraceTraits.characterAdvancement], 'name')
              }
           }
        return traits;
        }
};

export default raceRules;