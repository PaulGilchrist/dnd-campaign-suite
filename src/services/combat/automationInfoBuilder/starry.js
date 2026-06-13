import { evaluateAutoExpression } from '../automationExpressions.js'

const CONSTELLATION_OPTIONS = ['Archer', 'Chalice', 'Dragon'];

export const starryHandlers = {
    'starry_form': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'starry_form',
            name: feature.name,
            effect: auto.effect || 'starry_form',
            duration: auto.duration || '1_minute',
            options: auto.options || CONSTELLATION_OPTIONS,
            resourceKey: auto.resourceKey || 'starryFormUses',
            uses: auto.uses || 0,
            hasAutomation: true
        }
    },

    'cosmic_omen': (feature, playerStats) => {
        const auto = feature.automation
        let usesMax = 0;
        if (auto.uses_expression) {
            usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 0;
        }
        return {
            type: 'cosmic_omen',
            name: feature.name,
            usesMax,
            usesRecharge: auto.recharge || 'long_rest',
            action: auto.action || 'action',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'twinkling_constellations': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'twinkling_constellations',
            name: feature.name,
            options: auto.options || CONSTELLATION_OPTIONS,
            hasAutomation: true
        }
    }
}
