import { getAbilityModifier, resolveFeatChosenAbility } from '../../../shared/abilityLookup.js'
import { normalizeCastingTime } from '../../../shared/castingTimeUtils.js'

// ── Class Feature Handlers ───────────────────────────────────────────

export const classFeatureHandlers = {
    'telekinetic_shove': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        // FT-094: DC ability is the ASI actually chosen for the Telekinesis feat,
        // not the static feats.json saveAbility (fallback = known data value).
        const saveAbility = resolveFeatChosenAbility('Telekinesis', playerStats.featAbilityChoices)
            || auto.saveAbility
            || 'INT'
        const saveDc = auto.saveDc === 'ability'
            ? 8 + getAbilityModifier(playerStats.abilities, saveAbility) + prof
            : auto.saveDc || 10
        let action = auto.action
        if (!action && auto.casting_time) {
            const ct = normalizeCastingTime(auto.casting_time)
            if (ct === '1 bonus action') {
                action = 'bonus_action'
            } else if (ct === '1 action') {
                action = 'action'
            }
        }
        return {
            type: 'telekinetic_shove',
            name: feature.name,
            saveType: auto.saveType || 'STR',
            saveDc,
            saveAbility,
            range: auto.range || '30',
            pushDistance: auto.pushDistance || 5,
            action: action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'arcane_ward': (feature, playerStats) => {
        const auto = feature.automation
        const intMod = getAbilityModifier(playerStats.abilities, 'Intelligence')
        const wizardLevel = playerStats.level
        const maxHp = wizardLevel * 2 + intMod
        return {
            type: 'arcane_ward',
            name: feature.name,
            wardHpExpression: auto.wardHpExpression || `(2 * ${wizardLevel}) + ${intMod}`,
            wardRestoreExpression: auto.wardRestoreExpression || '2 * spell_slot_level',
            wardTrigger: auto.wardTrigger || 'abjuration_spell_cast',
            wardDuration: auto.wardDuration || 'long_rest',
            bonusActionRestore: !!auto.bonusActionRestore,
            maxHp,
            hasAutomation: true
        }
    },

    'arcane_ward_bonus_action': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'arcane_ward_bonus_action',
            name: feature.name,
            action: 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'projected_ward': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'projected_ward',
            name: feature.name,
            range: auto.range || 30,
            reaction: true,
            wardTrigger: auto.wardTrigger || 'ally_damage_taken',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'animal_aspect': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'animal_aspect',
            name: feature.name,
            options: auto.options || [],
            casting_time: auto.casting_time || '',
            hasAutomation: true
        }
    },

    'clouds_jaunt': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'clouds_jaunt',
            name: feature.name,
            distance: auto.distance || '30 ft',
            range: auto.range || '30_ft',
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 bonus action',
            automation: auto,
            hasAutomation: true
        }
    },
}
