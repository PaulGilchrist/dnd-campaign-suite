# D&D Campaign Suite — User Guide

A full-stack virtual tabletop for D&D 5e (2014) and the 2024 Essentials rules. One person (or machine) runs the app as the **host**; everyone else joins with a browser — no accounts, no installs, no logins. Everything syncs in real time: character sheets, initiative, maps, fog of war, spell overlays, dice, and the campaign log.

The app is designed to be used **as much or as little as you want**. It supports five levels of assistance, and you choose yours per campaign. Levels 1–4 are the classic experience (the app helps, the GM decides). Level 5 adds optional rule enforcement and a local AI that can reduce — or remove — the need for a GM. **With Level 5 switched off, the app behaves exactly as the classic tool it always was.**

---

## Table of Contents

1. [How it works](#1-how-it-works)
2. [Starting the app](#2-starting-the-app)
3. [The five levels of assistance](#3-the-five-levels-of-assistance)
4. [Quick start — a one-shot tonight](#4-quick-start--a-one-shot-tonight)
5. [Quick start — building a full campaign](#5-quick-start--building-a-full-campaign)
6. [A guide for players](#6-a-guide-for-players)
7. [Running combat](#7-running-combat)
8. [Switching on the helpers (optional enforcement)](#8-switching-on-the-helpers-optional-enforcement)
9. [AI assistance (optional)](#9-ai-assistance-optional)
10. [Sessions, travel and phase tracking](#10-sessions-travel-and-phase-tracking)
11. [Maps, tokens and fog of war](#11-maps-tokens-and-fog-of-war)
12. [Encounters and loot](#12-encounters-and-loot)
13. [Rests, recovery and leveling](#13-rests-recovery-and-leveling)
14. [Dual rulesets — 5e (2014) and 2024 together](#14-dual-rulesets--5e-2014-and-2024-together)
15. [NPCs — custom characters only](#15-npcs--custom-characters-only)
16. [The campaign log and the audit trail](#16-the-campaign-log-and-the-audit-trail)
17. [Safety net — snapshots, backup and reset](#17-safety-net--snapshots-backup-and-reset)
18. [Dice, music and quality-of-life](#18-dice-music-and-quality-of-life)
19. [Keyboard shortcuts](#19-keyboard-shortcuts)
20. [Tips, quirks and troubleshooting](#20-tips-quirks-and-troubleshooting)

---

## 1. How it works

- **The host machine runs one server** (`npm start`). It holds all campaign data as simple JSON files — your campaign folder is yours to back up, edit, or version.
- **The GM opens `http://localhost`** on the host machine. Localhost = full GM powers: campaign management, map editing, encounter building, admin tools, enforcement settings, AI configuration.
- **Everyone else opens the network address** the server prints at startup (e.g. `http://192.168.x.x`, or the hosted/VPN address). Players see exactly what they need: their character sheet, the initiative tracker, the active map, and the campaign log — and everything updates live.
- **Real-time sync** uses Server-Sent Events: when anyone rolls, moves a token, opens a door, or updates a sheet, every connected screen updates within moments.
- **You are always in turn-based mode.** Nothing in this app expires on a wall clock. Prompts, saves, and decisions wait indefinitely — nobody gets penalized for thinking.

---

## 2. Starting the app

```bash
npm install && npm start
```

The server builds the app if needed and listens on port **80**. On startup it prints two links:

- **Dungeon Master** → `http://localhost` (open this on the host — full control)
- **Player's** → e.g. `http://100.92.171.80` (share this with your players)

If port 80 is taken: `PORT=3000 npm start`. If players can't connect, check the firewall allows incoming connections on that port and that everyone is on the same network (a Tailscale/VPN address works too — the app prints one if available).

**Development** (live-reload while hacking): `npm run dev`.

---

## 3. The five levels of assistance

Every level builds on the one below it, and every level stays available forever. You choose your level per campaign, mostly by simply using — or not using — the features it offers. Levels 5's optional controls live in **Admin → Enforcement & Referee** and **Admin → AI Referee**, and every one of them defaults to **off**.

| Level | Name | What you get | Typical table |
|---|---|---|---|
| **1** | **Pre-game only** | Build campaigns, maps, encounters, quests, NPCs, settlements; create and level up characters; print everything. | Paper + real dice on game night. The app is your prep bench. |
| **2** | **Minimal game use** | The Initiative tracker on a TV or monitor: whose turn it is, who's hurt, who's buffed, round counter. | Paper play with a live turn order on screen. |
| **3** | **Maps** | Tactical grid maps: token movement, fog of war, walls and doors, spell area-of-effect overlays, rulers, item drops. | Theater of the mind replaced by a shared battle map. |
| **4** | **Combat** | The rules run with you: to-hit vs target AC, damage auto-rolls with criticals, resistances/immunity notices, conditions with action-blocking, saves, spell automation, loot and XP, full PvE **and** PvP / NPC-vs-NPC / ally / arena matchups. | Fully digital play; the GM adjudicates anything unusual. |
| **5** | **GM-optional** | Optional enforcement (turn lock, action economy, movement budgets, line of sight, cover, zones, opportunity attacks, auto-encounters, auto-rewards) plus a **local AI** that can propose NPC decisions, adjudicate rules questions, and maintain world continuity — always through the same engine lanes a human click uses. | The app referees the rules and can run NPCs; a human referee is optional, and can take over at any moment with one button. |

**The promise:** every level-5 capability is a switch, default off. With all switches off the app is byte-for-byte the classic levels 1–4 experience — no gates, no prompts, no AI traffic.

---

## 4. Quick start — a one-shot tonight

1. **Create the campaign.** Open the GM link → **Campaigns** → **Add** → type a name → **Create**.
2. **Create the characters.** **Add Character** opens the creation wizard: choose the ruleset (5e or 2024), name, race, background, class, subclass, feats, ability scores (point-buy or roller), skills, spells, and starting gear. **Create Character** when done. Repeat per player — or hand players the network link and have them pick their sheet themselves.
3. **(Optional) Roll initiative for the party** — the tracker works even before combat: everyone sits at round 1 with empty initiative slots you can fill.
4. **Build the first fight.** **Encounters** → search or filter the Monster Manual, tick monsters, set quantities → **Join Encounter**. The engine rolls initiative for every monster, brings in the party at their current HP, AC, and resistances, and the tracker lights up. No encounter handy? **+ NPC** drops a quick statless slot you can name and give HP inline.
5. **Play the fight.** The active creature is highlighted. Players act from their sheets (click an attack — see §7). Monsters act from their card: click the monster's **avatar** to open its full stat block, then click the **dice chip** on the action you want — to-hit rolls against the target's AC, damage auto-rolls on a hit, and the target's HP updates on every connected screen.
6. **Advance turns** with **Next →** / **← Prev** (or arrow keys). **Clear** ends combat; the party returns to camp and you can re-arm the next fight.
7. **Award the loot.** **Generate Loot** on the tracker scales treasure to the monsters' CR; **Complete Encounter** splits XP evenly among the party.

That's it — nothing to enable, nothing to configure. This is levels 2–4 working out of the box.

---

## 5. Quick start — building a full campaign

Everything below is created on the GM link and is instantly visible to players (except GM-only tools, noted).

1. **Campaign** → Add → name it.
2. **Characters** → build the party (or let players do it).
3. **Settlements** (GM only) → New or **Generate Settlement** — villages, towns, cities with services, resident NPCs, and rumours. Add rows manually or let the generator pre-fill them.
4. **NPCs** → custom recurring characters: appearance, personality, goals, secrets, tags. Give a roleplaying NPC no AC and it stays lore-only; add an AC and it becomes combat-ready with an **Add to Initiative** button. (Monsters are *not* NPCs — see §15.)
5. **Quests** → hooks, status, descriptions; players can read them.
6. **Factions** → powers behind the throne: goals, influence (1–10), notes.
7. **Maps** → create a battle map from an image, or **Generate Dungeon** for a procedural one. Paint walls, place doors, set spawn points, drop items. **Activate** to push it live to everyone. Maps also include the overland **hex travel map** — move the party hex by hex, camp, roll weather, and let travel events trigger encounters (accepting a combat event can even start the initiative tracker for you — see §8).
8. **Encounters** → build, save, and reuse fights; **Generate** offers three balanced options for your party's level and the chosen environment.
9. **Sessions** (GM planner) → plan each night: link the maps, encounters, NPCs, quests and settlements you expect to use, build a prep checklist, suggest XP budgets and rumours, then **Mark as Played** afterwards (the recap prompt flows into the campaign log).
10. **Notes** → markdown scratchpad for the world: locations, loose threads, anything.
11. **Log** → the campaign's shared memory: every roll, hit, condition, spell, rest, and story note.

Progress persists to files on the server; see §17 for snapshots and backups.

---

## 6. A guide for players

Open the network link the GM shares — nothing to install, no account. Pick your character from the sidebar; your sheet is now your command center.

- **Your sheet:** abilities, savings throws, skills, attacks, spells (click to cast), bonus actions, reactions, features, inventory. Click an ability/skill/save name to roll it (with retroactive advantage/disadvantage — see §18).
- **During combat:** click an attack to roll to-hit against your selected target; damage and criticals resolve automatically. Conditions applied to you show up as badges and genuinely block what they should — incapacitated means the buttons say so.
- **Your turn on the map:** drag your own token; the fog lifts as you explore; you can see spell overlays and everyone's HP bars.
- **Rests:** **Short Rest** / **Long Rest** on your sheet track hit dice and class resources.
- **Inventory:** pick up, equip, and move items between your pack and the party stash.
- **The log:** every roll anyone makes lands here, so nobody needs to shout numbers across the table.

Players can't manage campaigns, edit maps, or touch enforcement — those live on the GM's localhost screen (and, in enforced play, with the referee — see §8).

---

## 7. Running combat

Combat runs the same at every level; enforcement switches (§8) only decide *who says no* when rules are broken.

1. **Who goes first:** the tracker sorts by initiative. The active creature is highlighted on every screen.
2. **Players act:** select a target (the Target dropdown on the tracker card, or click a token), then click the attack/spell on your sheet. The engine rolls to-hit, compares to AC, rolls damage on a hit (doubling dice on a natural 20), applies resistances/immunity notes, and pushes the result everywhere.
3. **Monsters act:** click the monster's **avatar** → its full stat block opens → click a **dice chip** (+6 🎲) to roll that attack, save, or skill; damage chips apply to the current target. The card stays open so a monster can be run in seconds.
4. **Conditions and automation:** 5e conditions block the actions they should (paralyzed can't act; restrained halves speed and gives attackers advantage, and the app tells you). Spell and monster automations (concentration saves on damage, lair actions, legendary uses, recharge dice…) are built in, with clear prompts where a human decides.
5. **End of combat:** **Clear** wipes the tracker back to camp (players keep their sheet state; monsters respawn if re-added). Loot and XP are handled per §12.

> Nothing resolves on a timer. Death saves, concentration prompts, contested decisions — they wait until someone answers.

---

## 8. Switching on the helpers (optional enforcement)

**Admin → Enforcement & Referee** (GM screen; localhost only) is where the optional rules engine lives. A master switch turns the whole box on; ten individual checkboxes decide what it actually enforces. All default **off**, all server-validated, and every decision is written to the campaign log — you can audit exactly what was denied, spent, or moved, and take over at any time.

| Switch | What it does when ON |
|---|---|
| **Enforcement (master)** | Nothing is gated until this is on. With it off every other switch is inert and the app is classic mode. |
| **Turn lock** | Only the active creature may take Actions or Bonus Actions — a wrong-turn button click is refused with a clear reason (Reactions still fire off-turn, as the rules intend). Companions and commanded creatures act on their owner's turn and spend their own economy. |
| **Action economy** | Each creature gets 1 Action + 1 Bonus Action (+1 Reaction) per turn; extra attempts are refused: *"No action left this turn."* Every tracker card shows the economy chips draining and refilling. Some features legitimately grant more than one reaction per round — the engine supports per-creature reaction caps (up to 3) raised by those features. |
| **Movement budget** | Token drags clamp to the creature's remaining speed — an 8-cell drag by a 30-ft creature snaps at 5 ft, logging the honest partial spend. Difficult terrain costs double, greater difficult quadruples. |
| **Teleport token-move** | Teleport automations move tokens to the nearest legal space near the selected target (on the active map). |
| **Auto-encounters** | Accepting a travel combat event also seeds the initiative tracker — the engine rolls initiative for every monster. Off: the encounter map spawns and you start initiative when you like. |
| **Auto-rewards on clear** | Clearing combat automatically generates loot and splits XP to every character through the normal award lanes — **kills only**. Monsters that fled or were driven off pay nothing; the app never fabricates a reward. |
| **Zones & areas** | Zone automations (insect clouds, fog, lair effects) run real expiry rounds and turn-end saves/damage: a creature ending its turn inside the cloud makes the save, taking full damage on a fail and half on a success (as the spell says). Lair cadence matures at the top of the tracker. |
| **Line of sight** | Attacks and spells targeting someone behind a wall or closed door are denied **before** the slot is charged: *"behind a wall at (12,9) — no line of sight."* |
| **Opportunity attacks** | Leaving a hostile creature's reach spends that defender's reaction and prompts its controller to resolve the attack on their sheet — spend it or refuse it honestly. |

**End Turn.** With enforcement on, the initiative bar grows an **End Turn** button — the formal turn seam that closes the active creature's economy, sweeps turn-end effects, and advances the tracker.

**Referee.** The referee is the authority who runs enforcement and AI confirmations — by default the localhost GM. **Claim Referee** / **Release** (Admin panel) bind or hand back that authority to the browser running the session, with the holder's name shown to everyone. Enforcement changes and AI confirmations require referee authority.

**Take over manually.** One button on the Session panel flips enforcement and AI off immediately (values preserved for later), logging *"manual control (L1–4 behavior)"*. Whatever the machine was doing, a human outranks it, instantly.

**Server truth.** Enforcement is evaluated client-side for instant UX, but the server *validates* every enforcement-relevant write — impossible budgets, bogus turn states, and illegal flags are rejected with a plain-English reason, and refusals persist to the campaign log so the audit trail outlives the moment.

---

## 9. AI assistance (optional)

The AI is **local, private, and a proposer — never a decision-maker**. It runs against a model server on your own machine (any OpenAI-compatible local server: oMLX, LM Studio, vLLM, llama.cpp — or Ollama). Campaign data never leaves your machine: the app refuses to configure remote AI endpoints.

### Setup (Admin → AI Referee, GM screen)

1. Start your local model server (e.g. oMLX on `http://localhost:8000/v1`).
2. Choose the API dialect (**OpenAI-compatible** or **Ollama**), enter the **endpoint** and the **exact model id**.
3. If your server requires a bearer key, paste it once — it's stored **server-side only**, never in campaign data, never sent to players.
4. Set the mode: **off** · **suggest (referee confirms)** · **autopilot (safe atomic actions auto-apply)**.

If the model is unreachable, the app fails closed: it says so honestly and everything falls back to manual — the game never quietly degrades or guesses.

### What the AI can do (in suggest mode, every action needs your click)

- **AI Referee** — ask a rules question; get a ruling with reasoning. If a die is needed, it proposes the *expression* (`1d20+7`); **the engine rolls it**, never the model. HP-change proposals carry an **Override** box: edit the number before confirming if you disagree.
- **AI NPC director** — on a monster's turn, an *"Ask the AI to decide X's turn"* button offers a bounded intent chosen **only from that monster's real stat block** (unknown actions/targets are refused before the model is even consulted). Confirm stamps the action and target onto the monster's card; you then roll it like any monster action — the engine rolls, not the AI. Movement proposals are advisory (drag the token — the movement budget enforces the cap).
- **World keeper** — session recaps and flavour grounded in your actual campaign ledger (quests, factions, NPCs, settlements, recent log). It may reference entities that exist; fabricated NPCs or settlements fail closed. Confirmed recaps land in the log; AI-drafted quests are saved to the quest ledger with a provenance note.

### Autopilot mode

With no human referee (or by choice), autopilot auto-applies only **atomic, safe** actions — the dice it rolls are still engine dice, the gates still charge and deny, and every auto-action is audited. Anything requiring judgement falls back to *"needs_human"* and waits indefinitely.

**In all modes:** every AI proposal, confirmation, override, denial, and auto-action is written to the campaign log (`AI director proposed…`, `confirmed…`, `needs_human…`). You can retrace every decision the machine made.

---

## 10. Sessions, travel and phase tracking

Your campaign now tracks **what mode of play you're in** — Exploration, Encounter, Travel, Roleplay — as a set of pills on the Session panel:

- It moves **by your actions**: initiative stamped → Encounter; combat cleared → Exploration; traveling on the hex map → Travel; and you can click a pill at any time to declare the table's mode.
- The Session panel also shows the **enforcement & AI audit ledger** — denials, spends, covers, auto-rewards, AI decisions, takeovers — refreshed on demand.
- **Take over manually** (§8) lives here too.

The overland **hex map** is where Travel happens: move the party across terrain, camp (log + rest seam), roll weather, and meet armed encounters — with auto-encounters on, accepting a combat event seeds the initiative tracker immediately.

The separate **Sessions** planner view (§5, item 9) is the GM's offline planning notebook — linked resources, checklists, contingencies, XP suggestions, post-play recaps.

---

## 11. Maps, tokens and fog of war

**Create** a map from an uploaded image (or **Generate Dungeon**), then **Open** it to edit: paint walls, place doors and secret doors, drop items, set token spawn points. Editing autosaves (≈1s). **Activate** makes it the live map for every connected screen — players waiting on a map see *"Waiting for the GM to open a map…"* until then.

- **Tokens:** drag characters and items onto the grid. Players drag their own tokens; the GM can move anyone's (Shift-drag for fiat placement when enforcement is off). With movement enforcement on, drags clamp to speed budgets (§8).
- **Fog of war (indoor maps):** unseen areas are veiled — translucent for the GM, opaque for players. Lines of sight reveal as tokens move (Bresenham rays; walls and closed doors block); revealed areas stay revealed for everyone. Right-click doors to open them. GM toolbar: **Reset Fog**; player toolbar: **Reset View**.
- **Spell overlays:** the wand tool draws Sphere/Cylinder/Cube/Cone/Line AoEs with adjustable radius/angle/width; drag origins and edges to reposition; synced live to all players. Overlays are visual aids — affected-creature rolls stay with the automation engine (§7).
- **Ruler, items panel, 3D** round out the editor (measure ranges, manage what's on the ground).

---

## 12. Encounters and loot

**Encounters** is the builder: party list (auto-filled), difficulty selector, searchable Monster Manual table with type/size/CR filters.

- **Join Encounter** expands quantities (3× Goblin → Goblin 1/2/3), rolls NPC initiative, transfers the party at current HP/AC/resistances, and logs it all. (Auto-encounters, §8, let travel events do the same.)
- **Generate** produces three balanced options for your party's level and a chosen environment, ranked by difficulty accuracy and monster variety.
- The **difficulty summary recalculates honestly** as you tick monsters — past your filter it will tell you it's Deadly.
- **Generate Loot** scales treasure to CR (low-CR fights genuinely come up empty — CR < 0.5 is always bare). **Award** hands it to the party's inventory; **Complete Encounter** splits XP evenly, with confirmation.
- With **auto-rewards on clear** (§8), all of the above happens automatically at combat close — kills only.

XP on character sheets tracks advancement; level-up edits happen in the character wizard.

---

## 13. Rests, recovery and leveling

- **Short Rest** and **Long Rest** sit on every character sheet: they restore hit dice, class resources, recharge rolls, and clear what the rules say to clear — and anything tied to the combat you just finished.
- Concentration: broken automatically on a failed CON save when the caster takes damage (players get the save prompt; it waits indefinitely).
- Monsters manage their own recovery — legendary uses regain at the monster's turn start, recharges roll their d6s.
- Rests also sweep combat-scoped effects (zones, durations that said "until combat ends") — even across the party taking a rest mid-dungeon.

---

## 14. Dual rulesets — 5e (2014) and 2024 together

Each character picks its ruleset in Step 1 of the creation wizard, and both coexist in one campaign without warnings — every character's numbers are computed by their own edition's engine.

Key differences you'll notice:

- **Racial ability bonuses:** 5e races have fixed bonuses; 2024 moves them to Backgrounds (no fixed race bonuses).
- **Weapon Mastery** (2024) replaces Fighting Styles — the attack table shows a Mastery column.
- **Spells:** 2024 characters always have their spell list prepared; some 5e subclass-school restrictions don't apply.
- **Class features & subclasses** come from the matching edition's catalog.

**Gotcha:** switching a character's ruleset after creation clears spells, feats, and background choices and resets the wizard — re-select them from the correct edition's catalog. There is no automatic migration.

---

## 15. NPCs — custom characters only

The **NPCs** view is for *your* characters — the innkeep, the cult leader, the rival knight: appearance, personality, goals, secrets, tags. Give one an AC and it becomes combat-ready (shield badge + **Add to Initiative**).

**Pre-made monsters never live in the NPCs list.** A published monster (Goblin, Zombie, Ancient Dragon…) joins your table through the **Encounter Builder**, pulling its real, current stat block from the monster data. If you try to save a bestiary name as an NPC, the app refuses with that advice — this keeps a stray placeholder from ever masking a monster's true stats at the table. (Custom homebrew with its own name and its own stat block is always welcome.)

Monster stat blocks are one click away during play: click any monster's avatar on the tracker to open its full card — dice chips included (§7).

---

## 16. The campaign log and the audit trail

The **Log** is the campaign's shared memory, synced live: initiative, attacks (rolls, modifiers, target, result), damage with breakdowns, saves, spell casts, conditions, rests, loot, story notes.

On top of that, the enforced and AI features write an **audit trail**:

- `enforcement_denied` — what was refused and why (*"It is AasimarTest's turn — FeyRanger cannot act now."*, *"No action left this turn."*, *"behind a wall at (12,9) — no line of sight."*)
- `enforcement_triggered` / `enforcement_cover` / `enforcement_clock_expired` — opportunity attacks provoked, cover applied, zone durations ending.
- `auto_encounter_started`, `loot_awarded {auto}`, `auto_rewards_awarded` — automatic lanes and exactly what they paid.
- `ai_ruling`, `ai_director`, `ai_director_applied` — every AI proposal, confirmation, override, and honest *needs_human*.
- `manual_takeover` — when a human flipped the machine off.

Server-side refusals are persisted too, so even rejected writes leave a trace. The Session panel shows a rolling enforcement/AI ledger; the Log view has it all, timestamped.

---

## 17. Safety net — snapshots, backup and reset

**Admin** (GM only) holds the undo button for everything:

- **Create Snapshot** — timestamped archive of the whole campaign; the last 10 are kept.
- **Rollback to Snapshot** — restores one (you'll confirm; the campaign reloads and is re-selected for you).
- **Download Campaign** — the same archive, to your computer.
- **Upload Campaign** — replace the campaign folder wholesale (use with care).
- **Clear Change Data / Clear Campaign Log / Full Reset** — scoped wipes, each confirmed.
- Rename and **Delete Campaign** (deletion asks you to type the exact name).

All campaign state lives as JSON files under `public/campaigns/<name>/` — plain, portable, yours.

---

## 18. Dice, music and quality-of-life

- **Retroactive advantage/disadvantage:** clicking an ability/save/skill rolls **two d20s behind the scenes**; after the result appears, Advantage/Disadvantage togglets let you *then* decide which applies. Forced disadvantage (e.g. Frightened) shows a purple badge and locks to the lower die.
- **Attacks:** clicking a hit bonus rolls against the current target's AC; on a hit the damage auto-rolls and applies (crit doubles the dice); resistance/immunity notices appear.
- **Dice tray** (sidebar): d4–d100 quick rolls in a popup (press Escape to dismiss).
- **Spell sheets, actions, custom actions:** everything dice-related comes from defined sheet content — to roll something bespoke, add it as a custom action.
- **Music panel:** five moods (Town, Outdoors, Combat, Dungeon, Tavern) — selecting a mood auto-plays an ambience track (YouTube-backed; offline tables get silence), with pause/volume and per-mood track editing.
- **Spell overlays, rulers, items:** see §11.

---

## 19. Keyboard shortcuts

### Initiative tracker (during combat)

| Key | Action |
|-----|--------|
| `→` | Next creature |
| `←` | Previous creature |
| `↑` / `↓` | Round counter +1 / −1 |
| `+` | Add NPC slot |

### Everywhere

- **Enter** commits inline edits (renames, inline HP/initiative, saves)
- **Escape** closes modals and cancels renames
- Any keypress dismisses dice popups and the avatar viewer
- **Cmd/Ctrl + Enter** submits a note to the campaign log

---

## 20. Tips, quirks and troubleshooting

- **Session persistence:** a half-built encounter in the builder survives navigation; use Save/Load to keep it across sessions. Selected monsters stay selected even if they stop matching your current filters.
- **Character import/export:** Download any sheet as JSON; Upload imports (same name replaces). Uploaded sheets only persist once they're re-saved through the editor (GM-only feature). Duplicate names in the wizard **overwrite** — give characters unique names.
- **Statless `+ NPC`** slots default to 10 HP; rename them or match a published monster name to auto-load that monster's art and stat block for the card.
- **Two "Save" buttons** on the NPC form: *Save* vs *Save & Add to Initiative*.
- **A monster's card stays open** after rolling — close it with **×** before the next interaction.
- **Players can't see Admin, Settlements, or enforcement controls** — that's by design (GM = localhost; or the claimed referee in a session).
- **AI says "needs_human"?** That's working as designed: the model declined or couldn't ground its answer — decide yourself, or re-ask with more context. Check Admin → AI Referee shows the endpoint up (the status line tells you).
- **Players can't connect:** same network? port allowed through the firewall? re-copy the exact printed URL (the IP can change between boots).
- **Rules reference:** the **Rules** sidebar button opens the companion rules site in a new tab.
- **Lost a number across the table?** It's in the Log.
