export const psionicHandlers = {
    'psychic_spells': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'psychic_spells',
            name: feature.name,
            damageType: auto.damageType || 'Psychic',
            componentReduction: auto.componentReduction || [],
            spellSchools: auto.spellSchools || [],
            hasAutomation: true
        }
    },

    'psionic_sorcery': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'psionic_sorcery',
            name: feature.name,
            psionicSpells: auto.psionic_spells || [],
            hasAutomation: true
        }
    },

    'psionic_spells_list': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'psionic_spells_list',
            name: feature.name,
            psionicSpells: auto.psionic_spells || [],
            hasAutomation: true
        }
    },

    'telekinetic_movement': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'telekinetic_movement',
            name: feature.name,
            range: auto.range || '30_ft',
            hasAutomation: true
        }
    },

    'telekinetic_leap': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'telekinetic_leap',
            name: feature.name,
            action: auto.action || 'bonus_action',
            duration: auto.duration || 'until_end_of_turn',
            flySpeed: auto.flySpeed || '2x_speed',
            hasAutomation: true
        }
    },

    'telekinetic_thrust': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'telekinetic_thrust',
            name: feature.name,
            saveType: auto.saveType || 'STR',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'INT',
            options: auto.options || [],
            trigger: auto.trigger || 'after_attack_hit',
            oncePerTurn: !!auto.oncePerTurn,
            hasAutomation: true
        }
    }
}
