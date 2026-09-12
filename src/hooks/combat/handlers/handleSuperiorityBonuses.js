import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';

const SUPERIORITY_BONUS_SOURCES = [
    // Feinting Attack superiority die damage bonus
    { key: 'feintingAttackDieValue', resetKeys: [] },
    // Commander's Strike superiority die damage bonus (from ally)
    { key: 'commanderStrikeBonus', resetKeys: ['commanderStrikeActive', 'commanderStrikeSource'] },
    // Lunging Attack superiority die damage bonus (melee hit only)
    { key: 'lungingAttackDieValue', resetKeys: [] },
    // Attack-rider maneuver superiority die damage bonus (Goading et al.)
    { key: 'attackRiderDieValue', resetKeys: [] },
];

export function applySuperiorityDamageBonuses(characterName, campaignName, formula, total, rolls, context) {
    let newFormula = formula;
    let newTotal = total;
    let newRolls = rolls;
    const dmgType = context?.damageType || 'same_as_weapon';

    for (const { key, resetKeys } of SUPERIORITY_BONUS_SOURCES) {
        const bonus = Number(getRuntimeValue(characterName, key));
        if (!(bonus > 0)) continue;
        newFormula += ` + ${bonus} [${dmgType}]`;
        newTotal += bonus;
        newRolls = [...newRolls, bonus];
        setRuntimeValue(characterName, key, null, campaignName);
        for (const resetKey of resetKeys) {
            setRuntimeValue(characterName, resetKey, null, campaignName);
        }
    }

    return { formula: newFormula, total: newTotal, rolls: newRolls };
}
