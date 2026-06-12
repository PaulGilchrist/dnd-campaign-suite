export function collectSaveModifiers(features) {
    const modifiers = []
    if (!features) return modifiers

    features.forEach(feature => {
        if (!feature?.automation) return
        const auto = feature.automation
        if (auto.type === 'conditional_advantage') {
            const abilities = auto.abilities || (auto.saveType ? [auto.saveType.toUpperCase()] : []);
            modifiers.push({
                source: feature.name,
                target: auto.target,
                condition: auto.condition,
                effect: auto.effect,
                abilities
            })
        }
        if (auto.type === 'combat_stance' && auto.advantages) {
            for (const adv of auto.advantages) {
                const isSave = adv.toLowerCase().includes('saves');
                const abilityMatch = adv.match(/^(\w{3})\s+(?:checks|saves)/);
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
        }
        if (auto.type === 'auto_reroll') {
            modifiers.push({
                source: feature.name,
                target: auto.target,
                condition: auto.condition,
                effect: 'reroll',
                bonusExpression: auto.bonusExpression || '',
                oncePerRage: !!auto.oncePerRage,
            })
        }
        if (auto.type === 'conditional_replacement') {
            modifiers.push({
                source: feature.name,
                target: auto.target,
                condition: auto.condition,
                effect: 'replacement',
                saveType: auto.saveType || '',
                replacementAbility: auto.replacementAbility || '',
            })
        }
    })

    return modifiers
}
