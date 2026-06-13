import { evaluateAutoExpression } from '../automationExpressions.js'

export const spellHandlers = {
    'free_spell': (feature, playerStats) => {
        const auto = feature.automation
        let usesMax = auto.uses || 1;
        if (auto.uses_expression) {
            usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
        }
        return {
            type: 'free_spell',
            name: feature.name,
            spell: auto.spell || '',
            uses: auto.uses || 1,
            uses_expression: auto.uses_expression || '',
            usesMax,
            recharge: auto.recharge || 'long_rest',
            action: auto.action || 'action',
            duration: auto.duration || '',
            concentration: !!auto.concentration,
            noConcentration: !!auto.noConcentration,
            resourceCost: auto.resourceCost || '',
            freeCasts: auto.freeCasts || '',
            casting_time: auto.casting_time || '',
            perSpellTracking: !!auto.perSpellTracking,
            hasAutomation: true
        }
    },

    'fey_reinforcements': (feature, playerStats) => {
        const auto = feature.automation
        let usesMax = auto.uses || 1;
        if (auto.uses_expression) {
            usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
        }
        return {
            type: 'fey_reinforcements',
            name: feature.name,
            spell: auto.spell || '',
            uses: auto.uses || 1,
            uses_expression: auto.uses_expression || '',
            usesMax,
            recharge: auto.recharge || 'long_rest',
            action: auto.action || 'action',
            duration: auto.duration || '',
            casting_time: auto.casting_time || '',
            hasAutomation: true
        }
    },

    'contact_patron': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'contact_patron',
            name: feature.name,
            spell: auto.spell || '',
            uses: auto.uses || 1,
            uses_expression: auto.uses_expression || '',
            recharge: auto.recharge || 'long_rest',
            action: auto.action || 'action',
            casting_time: auto.casting_time || '',
            hasAutomation: true
        }
    },

    'dragon_companion': (feature, playerStats) => {
        const auto = feature.automation
        let usesMax = auto.uses || 1;
        if (auto.uses_expression) {
            usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
        }
        return {
            type: 'dragon_companion',
            name: feature.name,
            spell: auto.spell || '',
            uses: auto.uses || 1,
            uses_expression: auto.uses_expression || '',
            usesMax,
            recharge: auto.recharge || 'long_rest',
            action: auto.action || 'action',
            noConcentration: false,
            hasAutomation: true
        }
    },

    'spell_modifier': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'spell_modifier',
            name: feature.name,
            options: auto.options || [],
            resource: auto.resource || 'sorcery_points',
            hasAutomation: true
        }
    },

    'spell_thief': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'spell_thief',
            name: feature.name,
            saveType: auto.saveType || 'INT',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'INT',
            trigger: auto.trigger || 'spell_cast',
            oncePerLongRest: !!auto.oncePerLongRest,
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'war_magic_cantrip': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'war_magic_cantrip',
            name: feature.name,
            spellList: auto.spellList || 'wizard_cantrips',
            action: auto.action || 'action',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'war_magic_spell': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'war_magic_spell',
            name: feature.name,
            spellList: auto.spellList || 'wizard_spells',
            maxSpellLevel: auto.maxSpellLevel || 2,
            action: auto.action || 'action',
            casting_time: auto.casting_time || '1 action',
            replacesWarMagic: !!auto.replacesWarMagic,
            hasAutomation: true
        }
    },

    'arcane_charge': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'arcane_charge',
            name: feature.name,
            distance: auto.distance || '30 ft',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'guarded_mind': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'guarded_mind',
            name: feature.name,
            resource: auto.resource || 'psionicEnergy',
            action: auto.action || 'action',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'bulwark_of_force': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'bulwark_of_force',
            name: feature.name,
            range: auto.range || '30_ft',
            duration: auto.duration || '1_round',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'signature_spells': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'signature_spells',
            name: feature.name,
            action: auto.action || 'action',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'overchannel': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'overchannel',
            name: feature.name,
            effect: 'overchannel',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    }
}
