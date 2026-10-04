import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';

const SUPERIORITY_BONUS_SOURCES = [
    // Feinting Attack superiority die damage bonus
    { key: 'feintingAttackDieValue', resetKeys: [] },
    // Commander's Strike superiority die damage bonus (from ally) — MN-003:
    // label the folded die with the maneuver name ([Commander's Strike]) read
    // from the source stamp BEFORE reset, not the weapon damage type.
    { key: 'commanderStrikeBonus', resetKeys: ['commanderStrikeActive', 'commanderStrikeSource'], labelKey: 'commanderStrikeSource', fallbackLabel: "Commander's Strike" },
    // Lunging Attack superiority die damage bonus (melee hit only)
    { key: 'lungingAttackDieValue', resetKeys: [] },
    // Attack-rider maneuver superiority die damage bonus (Goading et al.)
    { key: 'attackRiderDieValue', resetKeys: [] },
];

export function applySuperiorityDamageBonuses({ characterName, campaignName, formula, total, rolls, context }) {
    let newFormula = formula;
    let newTotal = total;
    let newRolls = rolls;
    const dmgType = context?.damageType || 'same_as_weapon';

    for (const { key, resetKeys, labelKey, fallbackLabel } of SUPERIORITY_BONUS_SOURCES) {
        const bonus = Number(getRuntimeValue(characterName, key));
        if (!(bonus > 0)) continue;
        // MN-003: read the source stamp BEFORE it is cleared so the folded die
        // logs as [Commander's Strike] instead of the weapon damage type.
        const label = labelKey
            ? (getRuntimeValue(characterName, labelKey) || fallbackLabel)
            : dmgType;
        newFormula += ` + ${bonus} [${label}]`;
        newTotal += bonus;
        newRolls = [...newRolls, bonus];
        setRuntimeValue(characterName, key, null, campaignName);
        for (const resetKey of resetKeys) {
            setRuntimeValue(characterName, resetKey, null, campaignName);
        }
    }

    return { formula: newFormula, total: newTotal, rolls: newRolls };
}
