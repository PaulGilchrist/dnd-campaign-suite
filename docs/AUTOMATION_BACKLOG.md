# Combat Automation Backlog

## Summary

Added an `automation` schema to class/race/feat JSON data files that enables
one-click die rolls, resource tracking, and automated effects during combat.

### What's Implemented

- New `automation` field on feature/trait objects in JSON data
- `automationService.js` - processes automation blocks into actionable info
- Integration into `rules.js` to process automation at character load time
- UI buttons for automated abilities in CharActions, CharReactions, CharClassFeatures
- Save modifiers for conditional advantage (Fey Ancestry, Gnome Cunning, etc.)
- CSS styles for automation badges and buttons

### Automation Types Supported

| Type | Description | Examples |
|------|-------------|----------|
| `save_attack` | Roll damage + prompt for save | Breath Weapon, Warding Flare |
| `healing` | Roll healing dice | Healing Hands (Aasimar), Second Wind |
| `healing_pool` | Track and spend from pool | Lay on Hands |
| `self_healing` | Self-heal with uses | Wholeness of Body, Second Wind |
| `damage_reduction` | Reduce incoming damage | Deflect Missiles, Slow Fall |
| `conditional_advantage` | Auto-advantage on specific saves | Fey Ancestry, Gnome Cunning, Brave |
| `auto_reroll` | Reroll specific results | Lucky (Halfling) |
| `temp_buff` | Temporary buff with duration | Heavenly Wings, Celestial Revelation |
| `temp_hp_buff` | Grant temporary HP | Mantle of Inspiration (Bard) |
| `damage_aura` | Ongoing area damage | Inner Radiance (Aasimar) |
| `damage_bonus` | Add damage to attacks | Divine Smite, Rage |
| `combat_stance` | Toggle-able stance | Rage (Barbarian) |
| `auto_effect` | Automatic effect on trigger | Relentless Endurance, Savage Attacks |
| `passive_buff` | Always-on bonus | Aura of Protection (Paladin) |
| `passive_immunity` | Always-on immunity | Aura of Courage (Paladin) |
| `passive_rule` | Passive rule change | Improved Critical (Champion) |
| `extra_action` | Additional action use | Action Surge |
| `buff_ally` | Buff an ally | Bardic Inspiration |
| `bonus_attacks` | Extra attacks as bonus action | Flurry of Blows |
| `flurry_effect` | Rider on Flurry of Blows | Open Hand Technique |
| `reaction_damage` | Damage as reaction | Retaliation (Berserker), Storm's Thunder |
| `reaction_debuff` | Debuff as reaction | Cutting Words (Lore Bard) |
| `free_spell` | Free spell cast | Paladin's Smite |
| `resource_pool` | Track resource uses | Channel Divinity, Superiority Dice |
| `attack_rider` | Rider on weapon attacks | Brutal Strike (2024 Barbarian), Maneuvers |
| `initiative_action` | Action on initiative roll | Uncanny Metabolism (2024 Monk) |
| `spell_modifier` | Modify spell casting | Metamagic (Sorcerer) |
| `condition_immunity_while_active` | Immunity while active | Mindless Rage (Berserker) |
| `resistance` | Damage resistance | Celestial Resistance, racial resistances |
| `meta` | Meta-mechanical effect | Resourceful (Human) |

---

## Automation Data Added (by Source)

### 5e Races
- **Dragonborn** - Breath Weapon (save_attack with scaling, variable damage type)
- **Dwarf** - Dwarven Resilience (conditional_advantage vs poison)
- **Elf** - Fey Ancestry (conditional_advantage vs charmed)
- **Half-Elf** - Fey Ancestry (conditional_advantage vs charmed)
- **Gnome** - Gnome Cunning (conditional_advantage vs magic on INT/WIS/CHA)
- **Halfling** - Brave (conditional_advantage vs frightened), Lucky (auto_reroll 1s)
- **Half-Orc** - Savage Attacks (extra_damage_die on crit), Relentless Endurance (drop_to_1_hp)

### 2024 Races
- **Aasimar** - Healing Hands (healing), Celestial Resistance (resistance), Heavenly Wings (temp_buff), Inner Radiance (damage_aura), Necrotic Shroud (save_attack)
- **Dragonborn** - Breath Weapon (save_attack with scaling), Draconic Flight (temp_buff)
- **Dwarf** - Dwarven Resilience (conditional_advantage), Stonecunning (temp_buff)
- **Elf** - Fey Ancestry (conditional_advantage)
- **Gnome** - Gnomish Cunning (conditional_advantage)
- **Goliath** - Giant Ancestry (resource_pool with 6 options)
- **Halfling** - Lucky (auto_reroll), Brave (conditional_advantage)
- **Human** - Resourceful (meta: Heroic Inspiration)
- **Orc** - Adrenaline Rush (temp_buff), Relentless Endurance (auto_effect)
- **Tiefling** - Otherworldly Presence (cantrip)

### 5e Classes
- **Barbarian** - Rage (combat_stance), Reckless Attack (temp_buff), Danger Sense (conditional_advantage)
- **Bard** - Bardic Inspiration (buff_ally), Song of Rest (healing_bonus), Lore: Cutting Words (reaction_debuff), Valor: Combat Inspiration (enhanced_buff)
- **Fighter** - Second Wind (self_healing), Action Surge (extra_action), Champion: Improved/Superior Critical (passive_rule), Battle Master: Combat Superiority (resource_pool), Maneuvers (attack_rider)
- **Monk** - Deflect Missiles (damage_reduction), Slow Fall (damage_reduction), Stunning Strike (save_attack), Flurry of Blows (bonus_attacks), Open Hand Technique (flurry_effect), Wholeness of Body (self_healing)
- **Paladin** - Lay on Hands (healing_pool), Aura of Protection (passive_buff), Aura of Courage (passive_immunity), Divine Smite (damage_bonus), Devotion: Sacred Weapon (temp_buff), Vengeance: Vow of Enmity (temp_buff)

### 2024 Classes
- **Barbarian** - Rage (combat_stance), Reckless Attack (temp_buff), Danger Sense (conditional_advantage), Brutal Strike & Improved Brutal Strike (attack_rider), Berserker: Frenzy (bonus_action_attack), Mindless Rage (condition_immunity_while_active), Retaliation (reaction_damage)
- **Bard** - Bardic Inspiration (buff_ally), Lore: Cutting Words (reaction_debuff), Valor: Combat Inspiration (enhanced_buff), Glamour: Mantle of Inspiration (temp_hp_buff)
- **Fighter** - Second Wind (self_healing), Action Surge (extra_action), Battle Master: Combat Superiority & Maneuvers, Champion: Improved Critical
- **Monk** - Deflect Attacks (damage_reduction), Slow Fall (damage_reduction), Stunning Strike (save_attack), Uncanny Metabolism (initiative_action), Open Hand: Wholeness of Body & Technique
- **Paladin** - Lay On Hands (healing_pool), Paladin's Smite (free_spell), Aura of Protection (passive_buff), Channel Divinity (resource_pool)
- **Sorcerer** - Metamagic (spell_modifier), Sorcery Points (resource_pool)

---

## Remaining Automation Candidates (Backlog)

These are NOT yet implemented but could be added following the same pattern:

### 5e Classes
- **Cleric**
  - Channel Divinity variants (multiple subclasses) - `save_attack` or `resource_pool`
  - Disciple of Life (Life domain) - `passive_buff` on healing spells
  - Blessed Healer (Life domain) - `self_healing`
  - Preserve Life (Life domain) - `healing_pool`
  - Radiance of the Dawn (Light domain) - `save_attack`
  - Warding Flare (Light domain) - `save_attack` as reaction
  - Dampen Elements (Nature domain) - `damage_reduction` as reaction
  - Invoke Duplicity (Trickery domain) - `temp_buff`
  - War Priest (War domain) - `bonus_action_attack`
  - Turn Undead - `save_attack` or auto-effect

- **Druid**
  - Wild Shape - `temp_buff` with form tracking
  - Natural Recovery (Land) - `resource_pool`
  - Starry Form (Stars) - `temp_buff` with options
  - Cosmic Omen (Stars) - `buff_ally` / `debuff_enemy`
  - Moonlight Step (Moon) - `temp_buff`
  - Wrath of the Sea (Sea) - `damage_bonus`

- **Ranger**
  - Favored Enemy - tracking bonus
  - Natural Explorer - terrain benefits
  - Hunter's Prey (Hunter) - `damage_bonus`
  - Beast Master companion - action automation

- **Rogue**
  - Sneak Attack - `damage_bonus` (could auto-calculate)
  - Uncanny Dodge - `damage_reduction` as reaction
  - Evasion - auto save effect
  - Assassinate (Assassin) - auto-crit on surprised

- **Sorcerer**
  - Draconic Bloodline: Elemental Affinity - `damage_bonus`
  - Wild Magic Surge - roll on surge table
  - Tides of Chaos - `temp_buff`

- **Warlock**
  - Eldritch Invocations - various passive effects
  - Dark One's Blessing (Fiend) - `temp_hp_buff`
  - Healing Light (Celestial) - `healing_pool`
  - Misty Escape (Archfey) - `temp_buff`
  - Form of Dread (Undead) - `combat_stance`

- **Wizard**
  - Arcane Recovery - `resource_pool`
  - Portent (Divination) - pre-rolled d20 replacement
  - Sculpt Spells (Evocation) - AoE ally protection
  - Arcane Ward (Abjuration) - `damage_reduction` pool

### 2024 Classes (additional work)
- All 2024 classes listed above need remaining subclass features
- **Cleric**: Blessed Strikes, Divine Spark, Turn Undead, all domain features
- **Druid**: Wild Shape changes, Wild Resurgence, Elemental Fury, all circle features
- **Ranger**: Cunning Strike, Favored Foe, all subclass features
- **Rogue**: Supreme Sneak, all subclass features
- **Warlock**: Eldritch Invocation automation, Pact Boon effects
- **Wizard**: Arcane Recovery, Spell Mastery, all tradition features

### 5e Feats (many could be automated)
- **Alert** - +5 initiative passive
- **Great Weapon Master** / **Sharpshooter** - toggle -5/+10
- **Heavy Armor Master** - damage reduction pool
- **Inspiring Leader** - temp HP buff ritual
- **Lucky** - reroll resource pool
- **War Caster** - advantage on concentration saves
- **Sentinel** - opportunity attack automation
- **Polearm Master** - bonus action attack + reaction
- **Mage Slayer** - reaction attack on spellcaster
- **Defensive Duelist** - reaction AC bonus
- **Healer** - healing kit uses
- **Interception** - damage reduction for ally
- **Crusher** / **Piercer** / **Slasher** - attack riders
- **Boon of Fate** - d4 modifier to any roll

### 2024 Feats & Backgrounds
- All 2024 backgrounds grant feats that can use the feat automation system
- Epic Boons are high-level powerful abilities with clear automation potential

### Racial Traits (additional)
- **Tiefling 5e/2024** - Infernal Legacy spell-like abilities
- **Genasi** - elemental resistances and movement traits
- **Aasimar 2024** - LightBearer cantrip automation

---

## How to Add New Automations

1. **Add automation block to JSON data** in the relevant class/race/feat JSON file:

```json
{
  "name": "Feature Name",
  "description": "...",
  "automation": {
    "type": "save_attack",
    "damage": "2d6",
    "damageType": "Fire",
    "saveType": "DEX",
    "saveDc": "ability",
    "uses": 1,
    "recharge": "long_rest"
  }
}
```

2. **If the automation type is new**, add a case to `buildAttackInfo()` in
   `src/services/automationService.js` that returns an automation info object.

3. **The UI automatically handles it**:
   - Actions with automation show in CharActions with a clickable button
   - Reactions with automation show in CharReactions with clickable button
   - Passive effects like conditional_advantage integrate with the save system

4. **Save modifiers** (conditional_advantage, auto_reroll) are automatically
   passed to `computeConditionEffects()` via `CharSheet.jsx`

---

## Key Files Modified

| File | Changes |
|------|---------|
| `public/data/races.json` | Added automation blocks to Dragonborn, Elf, Half-Elf, Dwarf, Gnome, Halfling, Half-Orc |
| `public/data/2024/races.json` | All Aasimar, Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, Tiefling traits |
| `public/data/classes.json` | Barbarian (Rage, Reckless Attack), Bard (Inspiration), Fighter (2nd Wind, Action Surge), Monk (Deflect Missiles, Stunning Strike, Flurry), Paladin (Lay on Hands, Auras, Smite), Champion, Battle Master |
| `public/data/2024/classes.json` | Barbarian + all subclasses, Bard + all subclasses, Fighter + Battle Master/Champion/Monk + all subclasses, Paladin, Sorcerer (Metamagic) |
| `src/services/automationService.js` | **NEW** - Processes 25+ automation types |
| `src/services/rules.js` | Integration point - calls automation processor |
| `src/services/conditionEffects.js` | Added save modifiers (conditional_advantage) |
| `src/components/char-sheet/CharActions.jsx` | Clickable automation buttons for actions/bonus actions |
| `src/components/char-sheet/CharReactions.jsx` | Clickable automation buttons for reactions |
| `src/components/char-sheet/char-summary/CharClassFeatures.jsx` | Automation action buttons for Monk, Paladin, Barbarian |
| `src/components/char-sheet/CharAbilities.jsx` | Save advantage indicator for Fey Ancestry etc. |
| `src/components/char-sheet/CharActions.css` | Styles for .automation-btn, .automation-badge, .automation-actions |
