import { getSaveDc } from '../automationExpressions.js'
import { withAutoDefaults } from './infoDefaults.js'

const WARPING_IMPLOSION_DEFAULTS = {
    action: 'action',
    damage: '',
    damageType: '',
    saveType: 'STR',
    shape: '',
    range: '',
    conditionInflicted: null,
    duration: '',
    recharge: 'long_rest',
    resourceCost: '',
    restoreCost: null,
    options: [],
    optionDetails: {},
    dcSuccess: null,
}

function warpingSaveDc(auto, playerStats) {
    if (auto.saveDc !== 'ability') return auto.saveDc || 10
    return getSaveDc(playerStats, auto.saveAbility || 'CHA', playerStats.proficiency || 0)
}

export const sorceryHandlers = {
    'sorcery_aura': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'sorcery_aura',
            name: feature.name,
            uses_max: 2,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'sorcery_incarnate': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'sorcery_incarnate',
            name: feature.name,
            casting_time: auto.casting_time || '1 bonus action',
            cost: auto.cost || 2,
            hasAutomation: true
        }
    },

    'bastion_of_law': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'bastion_of_law',
            name: feature.name,
            range: auto.range || '30_ft',
            action: auto.action || 'action',
            casting_time: auto.casting_time || '1 action',
            resourceCost: auto.resourceCost || 'sorcery_points',
            maxSP: auto.maxSP || 5,
            minSP: auto.minSP || 1,
            hasAutomation: true
        }
    },

    'trance_of_order': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'trance_of_order',
            name: feature.name,
            duration: auto.duration || '1_minute',
            action: auto.action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            restoreCost: auto.restoreCost || 5,
            hasAutomation: true
        }
    },

    'clockwork_cavalcade': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'clockwork_cavalcade',
            name: feature.name,
            action: auto.action || 'action',
            range: auto.range || '30_ft_cube',
            maxHeal: auto.maxHeal || 100,
            restoreCost: auto.restoreCost || 7,
            hasAutomation: true
        }
    },

    'warping_implosion': (feature, _playerStats) => {
        const auto = feature.automation
        const uses = auto.uses ?? 1
        return {
            type: 'save_attack',
            name: feature.name,
            ...withAutoDefaults(auto, WARPING_IMPLOSION_DEFAULTS),
            saveDc: warpingSaveDc(auto, _playerStats),
            saveAbility: auto.saveAbility || 'CHA',
            uses,
            usesMax: uses,
            resourceKey: 'sorcery_points',
            hasOptions: !!auto.hasOptions,
            healExpression: null,
            hasAutomation: true
        }
    }
}
