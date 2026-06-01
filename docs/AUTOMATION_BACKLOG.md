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
- Resource tracking via TrackedResourceInput and restRules.js integration

### Automation Types Supported

| Type | Description | Examples |
|------|-------------|----------|
| `save_attack` | Roll damage + prompt for save | Breath Weapon, Warding Flare, Stunning Strike |
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
| `bonus_action_attack` | Bonus action attack | Frenzy (Berserker) |
| `resistance` | Damage resistance | Celestial Resistance, racial resistances |
| `meta` | Meta-mechanical effect | Resourceful (Human) |
| `healing_bonus` | Bonus healing on rest | Song of Rest (Bard) |

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
- **Barbarian** - Rage (combat_stance), Reckless Attack (temp_buff), Danger Sense (conditional_advantage), Berserker: Frenzy (bonus_action_attack), Mindless Rage (condition_immunity_while_active), Retaliation (reaction_damage), Totem Warrior: Bear/Eagle/Wolf options (resistance, passive_buff)
- **Bard** - Bardic Inspiration (buff_ally), Song of Rest (healing_bonus), Lore: Cutting Words (reaction_debuff), Valor: Combat Inspiration (enhanced_buff)
- **Fighter** - Second Wind (self_healing), Action Surge (extra_action), Champion: Improved/Superior Critical (passive_rule), Battle Master: Combat Superiority (resource_pool), Maneuvers (attack_rider)
- **Monk** - Deflect Missiles (damage_reduction), Slow Fall (damage_reduction), Stunning Strike (save_attack), Flurry of Blows (bonus_attacks), Open Hand Technique (flurry_effect), Wholeness of Body (self_healing)
- **Paladin** - Lay on Hands (healing_pool), Aura of Protection (passive_buff), Aura of Courage (passive_immunity), Divine Smite (damage_bonus), Devotion: Sacred Weapon (temp_buff), Vengeance: Vow of Enmity (temp_buff)

### 2024 Classes
- **Barbarian** - Rage (combat_stance), Reckless Attack (temp_buff), Danger Sense (conditional_advantage), Brutal Strike & Improved Brutal Strike (attack_rider), Berserker: Frenzy (bonus_action_attack), Mindless Rage (condition_immunity_while_active), Retaliation (reaction_damage), Zealot: Divine Fury (damage_bonus), Warrior of the Gods options (resistance, advantages)
- **Bard** - Bardic Inspiration (buff_ally), Lore: Cutting Words (reaction_debuff), Valor: Combat Inspiration (enhanced_buff), Glamour: Mantle of Inspiration (temp_hp_buff), Dance: Dazzling Footwork (advantages), Magical Discoveries
- **Fighter** - Second Wind (self_healing), Action Surge (extra_action), Battle Master: Combat Superiority & Maneuvers, Champion: Improved Critical, Psi Warrior: Psionic Energy (resource_pool)
- **Monk** - Deflect Attacks (damage_reduction), Slow Fall (damage_reduction), Stunning Strike (save_attack), Uncanny Metabolism (initiative_action), Martial Arts (passive_rule), Evasion (conditional_advantage), Acrobatic Movement (passive_buff), Heightened Focus (bonus_attacks), Self-Restoration (auto_effect), Deflect Energy (passive_rule), Disciplined Survivor (conditional_advantage, auto_reroll), Perfect Focus (resource_pool), Superior Defense (resistance)
  - **Warrior of Mercy** - Hand of Harm (save_attack), Hand of Healing (healing), Physician's Touch (auto_effect), Flurry of Healing and Harm (bonus_attacks), Hand of Ultimate Mercy (self_healing)
  - **Warrior of Shadow** - Shadow Arts (free_spell), Shadow Step (temp_buff), Improved Shadow Step (temp_buff), Cloak of Shadows (combat_stance)
  - **Warrior of the Elements** - Elemental Attunement (temp_buff), Stride of the Elements, Elemental Strike (attack_rider)
  - **Warrior of the Open Hand** - Open Hand Technique (flurry_effect), Wholeness of Body (self_healing)
- **Paladin** - Lay On Hands (healing_pool), Paladin's Smite (free_spell), Aura of Protection (passive_buff), Channel Divinity (resource_pool)
- **Sorcerer** - Metamagic (spell_modifier), Sorcery Points (resource_pool)
- **Cleric** - Channel Divinity (resource_pool: Divine Spark + Turn Undead), Searing Undead (damage_bonus), Blessed Strikes (damage_bonus / passive_buff), Improved Blessed Strikes (damage_bonus + temp_hp_buff), Divine Intervention (free_spell)
  - **Life Domain** - Disciple of Life (passive_buff), Preserve Life (healing_pool), Blessed Healer (self_healing), Supreme Healing (passive_rule)
  - **Light Domain** - Warding Flare (save_attack), Radiance of the Dawn (save_attack)
  - **Trickery Domain** - Invoke Duplicity (temp_buff)
  - **War Domain** - War Priest (bonus_action_attack), Guided Strike (passive_buff)
- **Druid** - Wild Shape (temp_buff), Circle features vary by subclass
- **Ranger** - Cunning Strike (attack_rider), Favored Foe (damage_bonus), subclass features
- **Rogue** - Supreme Sneak (passive_buff), Sneak Attack (damage_bonus), subclass features
- **Wizard** - Arcane Recovery (resource_pool), Spell Mastery (passive_rule), tradition features
- **Warlock** - Eldritch Invocations (various passive effects), Pact Boon effects, patron features

### 5e Feats
- **Great Weapon Master** - attack_rider (-5/+10, bonus action attack on crit/kill)
- **Sharpshooter** - attack_rider (-5/+10, ignore cover)
- **Lucky** - resource_pool (3 luck points to reroll)
- **Heavy Armor Master** - damage_reduction (3 from nonmagical B/P/S)
- **Inspiring Leader** - temp_hp_buff (level + CHA mod, 30 ft, 6 creatures)
- **Sentinel** - reaction_debuff + passive_rule for opportunity attacks
- **Polearm Master** - bonus_action_attack + passive_rule for opportunity attacks
- **Mage Slayer** - reaction_damage + conditional_disadvantage for concentration
- **Defensive Duelist** - conditional_advantage for AC as reaction
- **Alert** - passive_buff for +5 initiative + passive_immunity for surprised
- **War Caster** - passive_buff for advantage on concentration saves
- **Healer** - healing (1d6+4+max HD from healer's kit)
- **Observant** - passive_buff for +5 passive Perception and Investigation
- **Mobile** - passive_buff for +10 speed and no opportunity attacks after melee
- **Durable** - passive_buff for minimum HP recovery from hit dice
- **Tough** - passive_buff for +2 HP per level
- **Dual Wielder** - bonus_attacks for two-weapon fighting + passive_buff +1 AC
- **Crossbow Expert** - passive_rule for ignoring loading and melee disadvantage
- **Shield Master** - passive_buff for shield AC bonus to DEX saves
- **Resilient** - passive_buff for save proficiency
- **Elemental Adept** - passive_rule for ignoring resistance + passive_buff for treating 1s as 2s

### 2024 Feats
- **Crusher** - attack_rider (push + advantage after crit)
- **Piercer** - attack_rider (reroll damage die on crit)
- **Slasher** - attack_rider (reduce speed on crit)
- **Charger** - attack_rider (+10 speed on Dash, +d8 damage or push on charge)
- **Dual Wielder** - bonus_attacks for two-weapon fighting + passive_buff +1 AC
- **Durable** - conditional_advantage on death saves + self_healing from bonus action
- **Defensive Duelist** - conditional_advantage for AC as reaction (add prof bonus to AC)
- **Athlete** - passive_buff for climbing and jumping
- **Chef** - passive_buff for extra healing on short rest + temp_hp_buff for treats
- **Boon of Fate** - buff_ally (roll 2d4 to modify any d20 test within 60 ft)
- **Boon of Combat Prowess** - auto_reroll (turn miss to hit once per turn)
- **Boon of Dimensional Travel** - temp_buff for teleport after Attack/Magic action
- **Boon of Energy Resistance** - resistance for 2 damage types + reaction_damage for redirection
- **Boon of Fortitude** - passive_buff for +40 HP max + self_healing on HP recovery
- **Boon of Irresistible Offense** - passive_rule for ignoring resistance + damage_bonus on crit
- **Boon of Recovery** - auto_effect for drop to 1 HP + self_healing pool (10d10)
- **Boon of Speed** - passive_buff for +30 speed + bonus_action_attack for disengage
- **Boon of Truesight** - passive_buff for 60 ft truesight
- **Boon of Skill** - passive_buff for all skill proficiencies
- **Actor** - conditional_advantage on Deception/Performance while disguised

---

## Remaining Automation Candidates (Backlog)

These are NOT yet fully implemented but could be added following the same pattern:

### 5e Classes (remaining work)
- **Cleric**
  - Some domain features still lack automation (Nature: Dampen Elements as reaction_dr, Trickery: Cloak of Shadows, etc.)
- **Druid**
  - Circle of the Land: Natural Recovery (resource_pool)
  - Circle of Stars: Starry Form (temp_buff with options), Cosmic Omen (buff_ally)
  - Circle of the Moon: Wild Shape improvements
  - Circle of the Sea: Wrath of the Sea (damage_bonus)
- **Rogue**
  - Uncanny Dodge (damage_reduction as reaction)
  - Evasion (auto save effect)
  - Assassinate (Assassin) - auto-crit on surprised
- **Sorcerer**
  - Draconic Bloodline: Elemental Affinity (damage_bonus)
  - Wild Magic Surge - roll on surge table
  - Tides of Chaos (temp_buff)
- **Warlock**
  - Dark One's Blessing (Fiend) - temp_hp_buff
  - Healing Light (Celestial) - healing_pool
  - Misty Escape (Archfey) - temp_buff
  - Form of Dread (Undead) - combat_stance
- **Wizard**
  - Portent (Divination) - pre-rolled d20 replacement
  - Sculpt Spells (Evocation) - AoE ally protection
  - Arcane Ward (Abjuration) - damage_reduction pool

### 2024 Classes (remaining subclass work)
- **Druid**: Wild Resurgence, Elemental Fury, all circle features need full automation review
- **Ranger**: All subclass features (Gloom Stalker, Horizon Walker etc.) need automation review
- **Rogue**: All subclass features (Arcane Trickster, Thief, etc.) need automation review
- **Warlock**: Full Eldritch Invocation automation, Pact Boon mechanics per level
- **Wizard**: All tradition features (Portent, Sculpt Spells, Arcane Ward, etc.)

### Racial Traits (additional)
- **Tiefling 5e/2024** - Infernal Legacy spell-like abilities (free_spell)
- **Genasi** - elemental resistances and movement traits (resistance, passive_buff)
- **Aasimar 2024** - LightBearer cantrip automation (already partially done)

### Feats (remaining low priority)
- **Interception** - damage reduction for ally
- **Mounted Combat** - various mounted benefits
- **Ritual Caster** - depends on spellcasting system integration
- **Spell Sniper** - range doubling (partially handled by range validation)
- **Tavern Brawler** - unarmed strike improvements
- **Weapon Master** - proficiency expansion

### UI/Enhancement Work
- Lay on Hands pool needs functional click-to-heal UI (currently shows info popup)
- Breath Weapon needs functional save prompt DC calculation from character stats
- Song of Rest needs functional short rest healing bonus application
- Conditional advantage needs to auto-apply in save rolls (currently shows indicator only)
- Resource pools need reset on rest (currently managed by TrackedResourceInput + restRules.js)
- Epic Boons need level 19 character support

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
   - Class features show in CharClassFeatures with actionable buttons
   - Passive effects like conditional_advantage integrate with the save system

4. **Save modifiers** (conditional_advantage, auto_reroll) are automatically
   passed to `computeConditionEffects()` via `CharSheet.jsx`

5. **Resource pools** should be added to both `TrackedResourceInput` components
   and `restRules.js` (SHORT_REST_RESOURCES / LONG_REST_RESOURCES) for proper
   rest reset behavior.

---

## Key Files Modified

| File | Changes |
|------|---------|
| `public/data/races.json` | Added automation blocks to Dragonborn, Elf, Half-Elf, Dwarf, Gnome, Halfling, Half-Orc |
| `public/data/2024/races.json` | All Aasimar, Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, Tiefling traits |
| `public/data/classes.json` | All classes and subclasses with automation |
| `public/data/2024/classes.json` | All classes and subclasses with automation |
| `public/data/feats.json` | All feats with combat automation |
| `public/data/2024/feats.json` | All feats and Epic Boons with automation |
| `src/services/automationService.js` | Processes 30+ automation types |
| `src/services/rules.js` | Integration point - calls automation processor |
| `src/services/conditionEffects.js` | Added save modifiers (conditional_advantage) |
| `src/services/restRules.js` | Added new resource pools for rest reset |
| `src/components/char-sheet/CharActions.jsx` | Clickable automation buttons for actions/bonus actions |
| `src/components/char-sheet/CharReactions.jsx` | Clickable automation buttons for reactions |
| `src/components/char-sheet/char-summary/CharClassFeatures.jsx` | Automation action buttons for all 12 classes |
| `src/components/char-sheet/CharAbilities.jsx` | Save advantage indicator for Fey Ancestry etc. |
| `src/components/char-sheet/CharActions.css` | Styles for .automation-btn, .automation-badge, .automation-actions |
