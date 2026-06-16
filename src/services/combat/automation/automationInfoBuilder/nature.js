export const natureHandlers = {
    'nature_sanctuary': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'nature_sanctuary',
            name: feature.name,
            range: auto.range || '120_ft',
            cubeSize: auto.cubeSize || 15,
            duration: auto.duration || '1_minute',
            moveRange: auto.moveRange || 60,
            movesPerDuration: auto.movesPerDuration || 1,
            resourceCost: auto.resourceCost || 'wild_shape',
            hasAutomation: true
        }
    },

    'nature_sanctuary_move': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'nature_sanctuary_move',
            name: feature.name,
            action: 'bonus_action',
            moveRange: auto.moveRange || 60,
            hasAutomation: true
        }
    }
}
