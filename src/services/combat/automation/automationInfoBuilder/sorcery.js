import { getSaveDc } from '../automationExpressions.js'

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

    'transe_of_order': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'transe_of_order',
            name: feature.name,
            duration: auto.duration || '1_minute',
            action: auto.action || 'bonus_action',
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
        const prof = _playerStats.proficiency || 0
        return {
            type: 'save_attack',
            name: feature.name,
            action: auto.action || 'action',
            damage: auto.damage || '',
            damageType: auto.damageType || '',
            saveType: auto.saveType || 'STR',
            saveDc: auto.saveDc === 'ability'
                ? getSaveDc(_playerStats, auto.saveAbility || 'CHA', prof)
                : auto.saveDc || 10,
            saveAbility: auto.saveAbility || 'CHA',
            shape: auto.shape || '',
            range: auto.range || '',
            conditionInflicted: auto.conditionInflicted || null,
            duration: auto.duration || '',
            uses: auto.uses ?? 1,
            usesMax: auto.uses ?? 1,
            recharge: auto.recharge || 'long_rest',
            resourceCost: auto.resourceCost || '',
            resourceKey: 'sorcery_points',
            restoreCost: auto.restoreCost || null,
            hasOptions: !!auto.hasOptions,
            options: auto.options || [],
            optionDetails: auto.optionDetails || {},
            healExpression: null,
            dcSuccess: auto.dcSuccess || null,
            hasAutomation: true
        }
    }
}
