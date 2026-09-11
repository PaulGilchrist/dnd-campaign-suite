const saveAbilities = (auto) => auto.abilities || (auto.saveType ? [auto.saveType.toUpperCase()] : [])

const SAVE_MODIFIER_BUILDERS = {
    conditional_advantage: (feature, auto) => [{
        source: feature.name,
        target: auto.target,
        condition: auto.condition,
        effect: auto.effect,
        abilities: saveAbilities(auto),
        skills: auto.skills || [],
    }],
    combat_stance: (feature, auto) => {
        const modifiers = []
        for (const adv of auto.advantages || []) {
            const isSave = adv.toLowerCase().includes('saves')
            const abilityMatch = adv.match(/^(\w{3})\s+(?:checks|saves)/)
            if (isSave && abilityMatch) {
                modifiers.push({
                    source: feature.name,
                    target: 'saving_throw',
                    condition: 'stance_active',
                    effect: 'advantage',
                    abilities: [abilityMatch[1].toUpperCase()]
                })
            }
        }
        return modifiers
    },
    auto_reroll: (feature, auto) => [{
        source: feature.name,
        target: auto.target,
        condition: auto.condition || (feature.name === 'Disciplined Survivor' ? 'disciplined_survivor' : ''),
        effect: 'reroll',
        bonusExpression: auto.bonusExpression || '',
        oncePerRage: !!auto.oncePerRage,
    }],
    living_legend: (feature) => [{
        source: feature.name,
        target: 'saving_throw',
        condition: 'living_legend_active',
        effect: 'reroll',
        bonusExpression: '',
    }, {
        source: feature.name,
        target: 'ability_check',
        condition: 'living_legend_active',
        effect: 'advantage',
        abilities: ['CHA'],
    }],
    conditional_replacement: (feature, auto) => [{
        source: feature.name,
        target: auto.target,
        condition: auto.condition,
        effect: 'replacement',
        saveType: auto.saveType || '',
        replacementAbility: auto.replacementAbility || '',
    }],
    tactical_mind: (feature, auto) => [{
        source: feature.name,
        target: auto.target || 'ability_check',
        condition: auto.condition || '',
        effect: 'tactical_mind',
        bonusExpression: auto.bonusExpression || '',
    }],
    elder_champion: (feature) => [{
        source: feature.name,
        target: 'saving_throw',
        condition: 'elder_champion_active',
        effect: 'disadvantage',
    }],
    large_form: (feature) => [{
        source: feature.name,
        target: 'ability_check',
        condition: 'large_form_active',
        effect: 'advantage',
        abilities: ['STR'],
    }],
    otherworldly_glamour: (feature) => [{
        source: feature.name,
        target: 'ability_check',
        condition: 'otherworldly_glamour',
        effect: 'wis_replacement',
        abilities: ['CHA'],
    }],
    reliable_talent: (feature) => [{
        source: feature.name,
        target: 'ability_check',
        condition: '',
        effect: 'reliable_talent',
    }],
    second_storywork: (feature) => [{
        source: feature.name,
        target: 'ability_check',
        condition: '',
        effect: 'dex_jump',
    }],
    stroke_of_luck: (feature, auto) => [{
        source: feature.name,
        target: auto.target || 'd20',
        condition: '',
        effect: 'stroke_of_luck',
    }],
    bardic_inspiration_use: (feature, auto) => [{
        source: feature.name,
        target: auto.target || 'd20',
        condition: '',
        effect: 'bardic_inspiration',
    }],
    modify_d20_roll: (feature, auto) => [{
        source: feature.name,
        target: auto.target || 'd20',
        condition: '',
        effect: 'modify_d20_roll',
        diceExpression: auto.modifier || '2d4',
        canBeBonusOrPenalty: !!auto.canBeBonusOrPenalty,
    }],
    // CLA-374: removed dead + wrong-by-rules 'use_magic_device' INT
    // advantage modifier — 2024 UMD grants no such advantage, and the
    // consumers only read target==='saving_throw' so it never fired.
    passive_immunity: (feature, auto) => {
        if (!auto.save_advantage) return []
        return auto.save_advantage.map(sa => ({
            source: feature.name,
            target: 'saving_throw',
            condition: sa.condition || '',
            effect: 'advantage',
            saveType: sa.saveType || '',
        }))
    },
    // CLA-295 restore_balance is a Reaction, not a passive modifier — never
    // collected here. It arms via restoreBalanceHandler (row click) and is
    // consumed by consumeArmedRestoreBalance at the roll seam (restoreBalanceState.js).
    trance_of_order: (feature) => [{
        source: feature.name,
        target: 'attack_roll',
        condition: 'trance_of_order_active',
        effect: 'no_advantage_against',
    }, {
        source: feature.name,
        target: 'd20',
        condition: 'trance_of_order_active',
        effect: 'd20_floor_10',
    }],
    dark_ones_luck: (feature) => [{
        source: feature.name,
        target: 'saving_throw',
        condition: '',
        effect: 'dark_ones_luck',
    }, {
        source: feature.name,
        target: 'ability_check',
        condition: '',
        effect: 'dark_ones_luck',
    }],
    clairvoyant_combatant: (feature) => [{
        source: feature.name,
        target: 'attack_roll',
        condition: 'clairvoyant_combatant_active',
        effect: 'disadvantage',
    }],
    potent_cantrip: (feature) => [{
        source: feature.name,
        target: 'saving_throw',
        condition: '',
        effect: 'potent_cantrip',
    }],
    soulstitch_spells: (feature) => [{
        source: feature.name,
        target: 'saving_throw',
        condition: '',
        effect: 'soulstitch_spells',
    }],
    empowered_evocation: (feature) => [{
        source: feature.name,
        target: 'damage',
        condition: '',
        effect: 'empowered_evocation',
    }],
    overchannel: (feature) => [{
        source: feature.name,
        target: 'damage',
        condition: '',
        effect: 'overchannel',
    }],
    conditional_save_bonus: (feature, auto) => [{
        source: feature.name,
        target: auto.target,
        condition: auto.condition,
        effect: 'save_bonus',
        abilities: saveAbilities(auto),
        bonusExpression: auto.bonusExpression || '0',
    }],
    conditional_disadvantage: (feature, auto) => {
        const target = auto.target || 'attack_roll'
        return [{
            source: feature.name,
            target: (target === 'saving_throw' || target === 'save') ? 'saving_throw' : target,
            condition: auto.condition,
            effect: 'disadvantage',
            abilities: saveAbilities(auto)
        }]
    },
    protection_from_poison: (feature) => [{
        source: feature.name,
        target: 'saving_throw',
        condition: 'protection_from_poison_active',
        effect: 'advantage',
    }],
    // holy_aura contributes both entries: attack_roll disadvantage first,
    // then saving_throw advantage (push order preserved from the old chain).
    holy_aura: (feature) => [{
        source: feature.name,
        target: 'attack_roll',
        condition: 'holy_aura_active',
        effect: 'disadvantage',
    }, {
        source: feature.name,
        target: 'saving_throw',
        condition: 'holy_aura_active',
        effect: 'advantage',
    }],
    portent: (feature) => [{
        source: feature.name,
        target: 'd20',
        condition: '',
        effect: 'portent',
    }],
    improved_illusions: (feature) => [{
        source: feature.name,
        target: 'spell_component',
        condition: '',
        effect: 'improved_illusions',
    }],
    illusory_reality: (feature) => [{
        source: feature.name,
        target: 'spell_component',
        condition: '',
        effect: 'illusory_reality',
    }],
    passive_rule: (feature, auto) => {
        if (auto.effect !== 'concentration_disadvantage_on_damage_dealt') return []
        return [{
            source: feature.name,
            target: 'saving_throw',
            condition: 'concentration_breaker',
            effect: 'disadvantage',
            abilities: ['CON'],
        }]
    },
}

export function collectSaveModifiers(features) {
    const modifiers = []
    if (!features) return modifiers

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            const builder = SAVE_MODIFIER_BUILDERS[auto.type]
            if (builder) modifiers.push(...builder(feature, auto))
        }
    })

    return modifiers
}
