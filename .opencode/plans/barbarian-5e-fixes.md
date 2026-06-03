# Fix: Barbarian 5e Class Features Showing Incorrect Values

## Problem
The `BarbarianFeatures` component in `CharClassFeatures.jsx` reads top-level properties from the class level object (`extra_attacks`, `rages`, `rage_damage`, `weapon_mastery`) that only exist in the **2024** data format. For **5e** characters, these values are stored differently.

### Bugs
1. **Extra Attacks always 0**: 5e data doesn't have `extra_attacks` at the top level — "Extra Attack" is only a feature name in the `features[]` array. In 5e, any martial class gets 1 extra attack at level 5+.
2. **Rage Points always 0/0**: 5e data stores this as `class_specific.rage_count`, not `rages`.
3. **Rage Damage Bonus always 0**: 5e data stores this as `class_specific.rage_damage_bonus`, not `rage_damage`.

## Fix
Update the `BarbarianFeatures` component (lines 5-24) to detect the ruleset via `playerStats.rules === '2024'` and read from the appropriate data paths:

```jsx
const BarbarianFeatures = function BarbarianFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';
    const [rageActive, setRageActive] = React.useState(false);

    const extraAttacks = is2024
        ? (classLevel?.extra_attacks || 0)
        : (playerStats.level > 4 ? 1 : 0);

    const rageCount = is2024
        ? (classLevel?.rages || 0)
        : (classLevel?.class_specific?.rage_count || 0);

    const rageDamage = is2024
        ? (classLevel?.rage_damage || 0)
        : (classLevel?.class_specific?.rage_damage_bonus || 0);

    const weaponMastery = is2024
        ? (classLevel?.weapon_mastery ?? 'N/A')
        : 'N/A';

    return (
         <div data-testid="char-class-barbarian">
             <div><b>Extra Attacks: </b>{extraAttacks}</div>
             <TrackedResourceInput label="Rage Points" resourceKey="ragePoints" playerName={playerStats.name} getMax={() => rageCount} deps={[playerStats]} />
             <div>
                 <b>Rage Damage Bonus: </b>
                 <span className={rageActive ? "stat--buffed" : ""}>{rageDamage}</span>
                 <button className="automation-btn" onClick={() => setRageActive(!rageActive)} title={rageActive ? "End Rage" : "Enter Rage (toggle for damage bonus)"}>
                     <i className={`fas fa-${rageActive ? "fire-alt" : "fire"}`}></i> {rageActive ? "Raging" : "Rage"}
                 </button>
                 {rageActive && <span className="automation-badge">BPS Resist, STR Adv, +{rageDamage} dmg</span>}
             </div>
             <div><b>Weapon Mastery: </b>{weaponMastery}</div>
         </div>
    );
};
```

Also update the test file `CharClassFeatures.test.jsx` Barbarian test section (lines 321-357) to include a 5e ruleset test case using the correct 5e data structure with `class_specific.rage_count` and `class_specific.rage_damage_bonus`.

## Files to change
- `src/components/char-sheet/char-summary/CharClassFeatures.jsx` (lines 5-24)
- `src/components/char-sheet/char-summary/CharClassFeatures.test.jsx` (lines 321-357)
