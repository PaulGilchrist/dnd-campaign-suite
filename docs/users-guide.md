# User Guide: Tips & Hidden Features

This guide covers features and behaviors that might not be obvious to new users. For a complete feature overview, see the README.

---

## NPC Names — Automatic Stat Blocks

### Naming NPCs after monsters

When you create an NPC (on the Initiative Tracker or Indoor Map), name it to match a creature from the Monster Manual to automatically load that monster's image and full stat block. Trailing numbers are ignored, so `"Goblin 1"`, `"Goblin 2"`, etc. will all match "Goblin" — letting you add multiple copies without losing their data.

The name autocomplete dropdown is your friend: as you type, it suggests matching monsters from the Monster Manual plus any campaign NPCs you've created with custom stat blocks.

### Clicking to view stat blocks

Clicking on an NPC card (initiative tracker) or NPC token (indoor map) that matches a monster will open a full stat block modal showing abilities, saving throws, skills, traits, actions, reactions, and more. Dice in the stat block are clickable — click to roll attacks, saves, skills, and damage.

### Priority order

The app checks for matching NPCs in this order:
1. **Campaign NPCs** you created with a custom stat block (takes priority)
2. **Monster Manual** entries (fallback)

---

## NPC Editor — Optional Stats Tab

The NPC editor has two tabs:

- **Roleplay** — appearance, personality, goals, secrets, notes. Fill this out for any narrative NPC.
- **Stats** — AC, HP, ability scores, skills, resistances, immunities, actions, traits, reactions. Only fill this out if you plan to add the NPC to combat later.

The stats tab is entirely optional. However, once you enter a numeric **Armor Class**, the app recognizes your NPC as "combat-ready" and will show:
- A shield icon badge next to the NPC in the list
- An **"Add to Initiative"** button for one-click combat addition
- A **"Save & Add to Initiative"** option in the editor footer

Without an AC value, the NPC stays lore-only with no combat integration.

---

## Dice Rolling — Retroactive Advantage/Disadvantage

When you click any ability score, saving throw, or skill name to roll, two d20s are rolled behind the scenes. Only one shows at first. After the result appears, **Advantage** and **Disadvantage** toggle buttons let you retroactively pick from the two dice. This means you don't need to know your roll modifier before rolling — roll first, then decide.

For forced disadvantage (from conditions like *Frightened* or range/proximity penalties), a purple badge shows the reason and locks the result to disadvantage automatically.

### Attack rolls and damage

Clicking an attack hit bonus rolls to hit against the current combat target's AC. On a hit, the damage formula auto-rolls after 1 second and applies damage to the target. Critical hits (natural 20) double damage dice automatically. If the target has resistance or immunity to the damage type, you'll see a notice.

### What about custom dice expressions?

There is no freeform dice input field. All dice formulas come from your character's weapons, spells, abilities, and actions defined on the sheet. To roll something not defined, add it as a custom action during character creation or editing.

---

## Fog of War — Indoor Maps Only

Fog of war is a DM-only feature that hides map areas until player characters move into line of sight. It works by drawing imaginary rays from each player token to every cell on the grid using a Bresenham line-of-sight algorithm. Walls and closed doors block visibility.

### How to reveal areas

Drag player tokens around the map. Areas come into view when no wall or closed door blocks LOS. Opening doors (via right-click context menu) also reveals what's behind them.

### Limitations

- **No exploration memory** — moving a token away instantly re-covers visible areas with fog
- **No vision range** — LOS extends infinitely until blocked; darkness, dim light, and spell effects like *darkness* are not modeled
- **DM-only** — remote players (non-localhost connections) see the full map without fog

---

## Spell Overlays — Visual AoE on Maps

Use the wand icon in the map toolbar to draw area-of-effect shapes. Five shapes are supported: Sphere, Cylinder, Cube, Cone, and Line. Each has adjustable parameters (radius, distance, angle, width).

### Drawing overlays

- **Sphere / Cylinder** — click once on the grid to place
- **Cube / Cone / Line** — click to set origin, drag to set direction/angle, release to finalize

You can reposition and rotate existing overlays by dragging their origin or edge handles. Spell overlays sync in real-time across all connected players, with movement updates debounced at 150ms for smoothness.

> Note: Overlays are purely visual — they do not automatically calculate which creatures are affected or trigger damage rolls.

---

## Encounter Builder — Beyond the Basics

### Auto-generate encounters

Click **Generate** to create balanced encounters. Choose from 11 environments (arctic, forest, swamp, etc.) or quick-pick presets like "Dungeon" or "Wilderness." The algorithm considers monsters present in those environments and within an appropriate CR range for your party's average level, then ranks suggestions by difficulty accuracy and monster variety. You get the top 3 options to inspect and apply.

### XP budget behavior

The **difficulty filter** dropdown only affects which monsters appear in the table. The actual difficulty rating shown in the summary is calculated independently from your selections — so if you keep adding monsters past your chosen filter, the summary will correctly show a harder difficulty (Easy → Medium → Hard → Deadly).

### Getting encounters into combat

The **Start Encounter** button does several things at once:
- Expands monsters with quantity > 1 into individual creatures (e.g., "3x Goblin" becomes Goblin 1, 2, 3)
- Rolls initiative for all NPCs automatically
- Transfers all player characters with current HP, AC, resistances, and immunities
- Logs all initiative rolls to the campaign activity log

### Loot generation

After selecting monsters, click **Generate Loot** to produce currency, gems/jewelry, equipment, and magic items scaled to your monsters' CR tier. Lower-CR monsters have a chance to have no treasure at all (CR < 0.5 always empty, CR 0.5–2 has 30% chance).

### XP awards on completion

Clicking **Complete Encounter** divides total encounter XP evenly among party members and writes it directly to each character. Confirm before awarding.

### Session persistence

Your working encounter (unsaved monster selections, description, loot) persists in localStorage while you navigate between the builder and initiative tracker. To save encounters permanently across sessions, use the Save/Load buttons. Selected monsters stay visible even if they no longer match your current filters after changing difficulty or party level.

---

## Real-Time Party Sync — Getting Players Connected

Once the server is running (`npm start`), you'll see two URLs:
- **Local link** (`localhost`) — open this for the full GM experience with all editing features
- **Network link** (e.g., `192.168.x.x`) — share this with players

No accounts, logins, or pairing codes are needed. Players on the same WiFi just open the network link and are instantly connected. All changes sync automatically — character sheet updates, map movements, fog of war reveals, spell overlays, dice rolls, activity log entries — everything pushes to all connected screens in real time via Server-Sent Events.

If players can't connect:
- Verify everyone is on the same local network
- Check that your firewall allows incoming connections on port 80 (use `PORT=3000 npm start` as an alternative)
- Remote players will see a more limited view — GM-only features like campaign management, map editing, and encounter building are hidden

---

## Character Import/Export — Between Sessions

### Exporting characters

Click the **Download** button on any character sheet to save it as a `.json` file. The file contains the raw character data, pretty-printed and editable in any text editor.

### Importing characters

Click **Upload** and select one or more previously exported `.json` files. Same-name characters are replaced; new characters are appended. You can batch-import multiple characters at once.

### Important caveat

Uploaded characters only exist for the current browser session. To persist them permanently across page reloads, edit the character through the Edit wizard so it syncs to the server's campaign storage. Character import/export is a GM-only feature and is not available to remote players. Only one character can be downloaded at a time — select it first, then click Download.

---

## Dual Rulesets — 5e (2014) vs 2024 Essentials

Each character independently chooses its ruleset during Step 1 of the creation wizard. You can have 5e and 2024 characters in the same campaign with no warnings or errors — each character's stats are computed independently.

### Key differences between editions

- **Racial ability bonuses:** 5e races have fixed bonuses (e.g., Elf +2 DEX); 2024 has none
- **Proficiencies:** 2024 removes racial extra proficiencies; bonus proficiencies come from your class's "major" feature rather than subclass
- **Spells:** 2024 spells are always prepared (no prepare/spot checkbox); there are no subclass spell school restrictions and no racial free cantrips baked in
- **Fighting styles:** 2024 replaces fighting styles with Weapon Mastery — the attack table shows a "Mastery" column instead of style-based bonuses
- **Class features:** Different data structures mean subclasses work differently between editions

### Gotcha when switching rulesets mid-character

Changing your character's ruleset after creation clears all spells, feats, and background selections. The wizard resets you to Step 1 so you can re-select these from the correct edition's catalog. There is no automatic migration — everything must be re-chosen manually.

---

## Keyboard Shortcuts

### Initiative Tracker (global, always active during combat)

| Key | Action |
|-----|--------|
| `→` | Advance to next creature in turn order |
| `←` | Go back to previous creature |
| `↑` | Advance round counter +1 |
| `↓` | Decrement round counter |
| `+` | Add new NPC slot |

### Campaign Log

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Submit note to log (while in the textarea) |

### Everywhere else

- **Enter** commits inline edits (renames, values, map names, encounter saves)
- **Escape** closes modals and cancels in-progress renames
- Any keypress dismisses popup overlays and avatar viewer modals
