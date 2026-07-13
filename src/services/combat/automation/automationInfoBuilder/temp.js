export const tempHandlers = {
    'temp_buff': (feature, playerStats) => {
        const auto = feature.automation
        let usesMax = auto.uses || null;
        if (auto.uses === 'proficiency_bonus') {
            usesMax = playerStats.proficiency || 0;
        } else if (typeof auto.uses === 'string' && auto.uses.endsWith('_level')) {
            const className = auto.uses.replace('_level', '');
            if (playerStats.class?.name?.toLowerCase() === className) {
                usesMax = playerStats.level;
            } else {
                usesMax = playerStats.class?.levels || playerStats.level || 0;
            }
        }
        return {
            type: 'temp_buff',
            name: feature.name,
            effect: auto.effect || '',
            duration: auto.duration || '1_minute',
            action: auto.action || 'bonus_action',
            recharge: auto.recharge || 'long_rest',
            distance: auto.distance || '',
            extendedDistance: auto.extendedDistance || '',
            oncePerRage: !!auto.oncePerRage,
            bringAllies: !!auto.bringAllies,
            allyCount: auto.allyCount || 0,
            teleportRange: auto.teleportRange || '',
            enemiesDisadvantageSaves: auto.enemies_disadvantage_saves || [],
            triggerOnRage: !!auto.triggerOnRage,
            distanceExpression: auto.distanceExpression || '',
            casting_time: auto.casting_time || '',
            trigger: auto.trigger || null,
            uses: auto.uses || null,
            usesMax,
            hasAutomation: true
        }
    },

    'temp_hp_buff': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'temp_hp_buff',
            name: feature.name,
            buffExpression: auto.buffExpression || '',
            range: auto.range || '60_ft',
            targets: auto.targets || 1,
            targetsExpression: auto.targetsExpression || '',
            bonusMovement: !!auto.bonusMovement,
            extraEffect: auto.extraEffect || null,
            tempHpExpression: auto.tempHpExpression || '',
            triggerOnRage: !!auto.trigger_on_rage,
            ongoingHealingExpression: auto.ongoingHealingExpression || '',
            healingStartOfTurn: !!auto.healingStartOfTurn,
            healingRange: auto.healingRange || '',
            casting_time: auto.casting_time || '1 bonus action',
            includesSelf: !!auto.includesSelf,
            multiTargetAlly: !!auto.multiTargetAlly,
            hasAutomation: true
        }
    },

    'sacred_weapon': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'temp_buff',
            name: feature.name,
            effect: 'sacred_weapon',
            duration: auto.duration || '10_minutes',
            resourceCost: auto.resourceCost || '',
            options: auto.options || [],
            casting_time: auto.casting_time || '',
            hasAutomation: true
        }
    },

    'avenging_angel': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'temp_buff',
            name: feature.name,
            effect: auto.effect || 'avenging_angel',
            duration: auto.duration || '10_minutes',
            action: auto.action || 'bonus_action',
            flySpeed: auto.flySpeed || 60,
            hover: !!auto.hover,
            auraRange: auto.auraRange || 'aura_of_protection',
            saveType: auto.saveType || 'WIS',
            saveDc: auto.saveDc || 'ability',
            hasAutomation: true
        }
    },

    'holy_nimbus': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'holy_nimbus',
            name: feature.name,
            duration: auto.duration || '10_minutes',
            casting_time: auto.casting_time || '1_bonus_action',
            resourceCost: auto.resourceCost || '',
            hasAutomation: true
        }
    },

    'cloak_of_shadows': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'cloak_of_shadows',
            name: feature.name,
            effect: auto.effect || '',
            duration: auto.duration || '1_minute',
            hasAutomation: true
        }
    },

    'peerless_athlete': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'peerless_athlete',
            name: feature.name,
            duration: auto.duration || '1_hour',
            casting_time: auto.casting_time || '1_bonus_action',
            resourceCost: auto.resourceCost || 'channel_divinity',
            hasAutomation: true
        }
    },

    'dragon_wings': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'dragon_wings',
            name: feature.name,
            action: auto.action || 'bonus_action',
            duration: auto.duration || '1_hour',
            flySpeed: auto.flySpeed || 60,
            hover: auto.hover || false,
            uses: auto.uses ?? 1,
            recharge: auto.recharge || 'long_rest',
            resourceCost: auto.resourceCost || '',
            restoreCost: auto.restoreCost || 3,
            hasAutomation: true
        }
    },

    'revelation_in_flesh': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'revelation_in_flesh',
            name: feature.name,
            options: auto.options || [],
            duration: auto.duration || '10_minutes',
            action: auto.action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'living_legend': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'living_legend',
            name: feature.name,
            duration: auto.duration || '10_minutes',
            casting_time: auto.casting_time || '1 bonus action',
            unerringStrikeTrigger: auto.unerring_strike_trigger || 'attack_miss',
            unerringStrikeOncePerTurn: !!auto.unerring_strike_once_per_turn,
            saveRerollTarget: auto.save_reroll_target || 'saving_throw',
            charismaCheckAdvantage: !!auto.charisma_check_advantage,
            hasAutomation: true
        }
    },

    'holy_aura': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'holy_aura',
            name: feature.name,
            duration: auto.duration || '1_minute',
            auraRange: auto.auraRange || 30,
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'elder_champion': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'elder_champion',
            name: feature.name,
            duration: auto.duration || '1_minute',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'dark_ones_blessing': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'dark_ones_blessing',
            name: feature.name,
            tempHpExpression: auto.tempHpExpression || '',
            range: auto.range || '10_ft',
            hasAutomation: true
        }
    },

    'large_form': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'large_form',
            name: feature.name,
            duration: auto.duration || '10_minutes',
            casting_time: auto.casting_time || '1_bonus_action',
            resourceCost: auto.resourceCost || 'long_rest',
            hasAutomation: true
        }
    }
}
