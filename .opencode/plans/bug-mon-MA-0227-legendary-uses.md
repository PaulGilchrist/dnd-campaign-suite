# BUG MA-0227 — Ancient Green Dragon "Legendary Action Uses: 3 (4 in Lair)" — display-only header, legendary economy never wired

**Verdict: FAIL** (verified live 2026-09-15, test-campaign, localhost:5173)
**Row:** MA-0227 | monster ancient-green-dragon | category legendary_actions | header row [0]
**Family:** MA-0217 (Ancient Gold) / MA-0092 (Adult Copper) / MA-0172 / MA-0184 / MA-0195 / MA-0206 — MA-0092 "no numeric uses on header" fingerprint, recurring across ancient dragons.

## Expected behavior (per row description)
Header declares numeric uses (3, 4 in lair); children should be gated: 1 expend per other-creature turn, refusal at exhaustion/own-turn/per-action cooldown, `monsterLegendaryUses` runtime map with decrement + regain-all at dragon turn-start, spend/refusal/regain log entries, numeric `(N left)` counter on the card.

## Actual behavior (evidence)
### Step 1 static (monsters.json ancient-green-dragon legendary_actions)
- `[0]` header keys: **name,description ONLY** — `"Legendary Action Uses: 3 (4 in Lair)"`, **no `uses` field**.
- `legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153-157) requires `rows[0].uses != null` → returns **null** for this monster.
- MonsterCardBody.jsx:38,54-58: legendaryHeader null → plain **UNGATED** branch rendered; `MonsterLegendaryHeaderRow` (sole `.mc-legendary-counter` producer, :246) never mounts; `legendaryGate` prop never passed → `LegendarySpendLink` (MonsterAction.jsx:148) returns null.
- Children: [1] Mind Invasion + [3] Pounce = prose-only `mc-action` (inert, MA-0163/0220 family); [2] Noxious Miasma has numeric save fields → clickable **ungated** chip (MA-0184 ungated-leak pattern).

### Live probe (EB join "Ancient Green Dragon 1" 402hp ac21 cs0; target armed ElderPaladin)
- Dragon card DOM dump: `counterInOverlay: 0`, `legendaryChips: 0`; header renders as plain text `<div class="mc-action"><strong>Legendary Action Uses: 3 (4 in Lair).</strong><span>Immediately after another creature's turn…</span></div>` — display-only.
- Same-window multi-fire probe on Noxious Miasma chip (max should be 3, once/other-turn): chip clicked 4×; **3 full cast resolutions** (picker "Selecting 14 targets" + 2× "Selecting 1/EP" logged; 14 CON saves DC21 resolved, damage + condition + hp_change logs), plus 1 zero-target confirm.
- change-data `monsterLegendaryUses`: **absent at every checkpoint** (never created).
- Refusal log entries: **0** (no `legendary_use_refused`, no `noxious_miasma_refused (once per turn)`) — despite repeated same-window fires and the row's authored "can't take this action again until the start of its next turn" clause.
- Regain: impossible — economy key never exists; no regain log.
- Control (engine alive elsewhere): same card's non-legendary Poison Breath row correctly logged `ability_use … Recharge 5-6; unavailable` (recharge economy gated, MA-0225 parity) — the legendary branch alone is unwired.

## Root cause
**DATA authoring:** `monsters.json` ancient-green-dragon `legendary_actions[0]` header lacks numeric `uses`. Consumers (`expendLegendaryUse`, `regainLegendaryUses` turnStartEffects.js:176, per-action cooldowns) EXIST and are proven live on fixed siblings but are never reached because the header gate (`legendaryHeaderAction`) returns null.

## Likely Location
- `public/data/monsters.json` ancient-green-dragon `legendary_actions[0]` — missing `uses: 3` (root).
- `src/services/encounters/monsterLegendaryUses.js:153-157` `legendaryHeaderAction()` — null path (correct engine behavior, gate source).
- `src/components/encounter/MonsterCardBody.jsx:38,54-58` — ungated fallback branch.
- `src/components/encounter/MonsterAction.jsx:148` `LegendarySpendLink` — returns null without gate.

## Fix shape (MA-0070/MA-0113 data pattern)
Header `uses: 3` ("4 in Lair" advisory text); numeric save row Noxious Miasma already gated by shape once header lands; prose rows Mind Invasion ("casts Spellcasting Mind Spike lv5") → `delegates_to:"Spellcasting"` cast branch (MA-0185 shape); Pounce → `delegates_to:"Rend"` (MA-0070 family fix shape). Beware §pitfalls: once header uses:N lands, prose-only rows gain an "Expend Legendary" chip that silently burns uses unless delegates_to authored (MA-0164); anchor data edits on monster-unique text + full git diff (MA-0209).

## Notes
- Same fingerprint family: MA-0217 (Ancient Gold, FAIL), MA-0172 (Ancient Blue), MA-0184 (Ancient Brass ungated save leak), MA-0195/MA-0206 siblings; engine recipes MA-0070/MA-0113 (Green adult? sibling) fixed-shape precedent.
- Ancillary: AoE save at 1/1-placeholder PCs produced death-save `.dsp-overlay` (rolled once, Done); picker pre-checks ALL combatants on first mount (party-wipe hazard for full-party pickers — select subset before confirm).
- Cleanup: Admin clear change-data + log; overlays/dialogs dismissed; final state log [] change-data {}.
