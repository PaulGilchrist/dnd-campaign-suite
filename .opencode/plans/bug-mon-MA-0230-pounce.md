# Bug MA-0230 — Ancient Green Dragon "Pounce" (legendary_actions) — inert prose, no affordance

**Verdict: FAIL** (inert row + live zero-delta probe + grep-zero consumers). Same fingerprint as MA-0220/MA-0164/MA-0219 (inert legendary prose) and MA-0197 (Pounce family, 4th instance).

## Row
- id MA-0230 · monsterIndex `ancient-green-dragon` · category `legendary_actions` · actionType `other`
- expected: "The dragon moves up to half its Speed, and it makes one Rend attack."

## Evidence

### Static (STEP 1)
- `public/data/monsters.json:4162` ancient-green-dragon; `legendary_actions[3]` Pounce = bare `{name, description}` — NO `attack_bonus`, `save_dc`, `dice`, `delegates_to`, `move`, or `automation`. No 2024 monsters.json (monsters shared, `/data/` only).
- Header dict `legendary_actions[0]` = name-text "Legendary Action Uses: 3 (4 in Lair)" with NO numeric `uses` key (MA-0217 fingerprint).
- grep `pounce` (case-insensitive) across `src/` + `server/` = ZERO hits → no consumer anywhere.
- `delegates_to` IS consumed (`src/services/encounters/monsterLegendaryUses.js:7-9`, `MonsterCardModal.jsx`) but this row doesn't carry it.
- Gate chain: `monsterLegendaryUses.js:153-157` `legendaryHeaderAction()` requires `rows[0].uses != null` → null here → `MonsterCardBody.jsx:54` legendary-gated branch never taken; row renders via generic branch with no numeric affordance fields → inert.

### Live (test-campaign, localhost:5173; campaign header verified each select)
- EB exact "Ancient Green Dragon" → tick → Join Encounter → cs `Ancient Green Dragon 1|npc|hp402` idx 0; target armed ElderPaladin via initiative `[data-testid="target-select"]` (cs.targetName verified by curl).
- Pounce row outerHTML (dragon `.mc-overlay`): `<div class="mc-action"><strong>Pounce.</strong><span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>` — 0 `.mc-dice-link`, 0 `[role=button]`, 0 links; no `.mc-legendary-counter` on card.
- Clicks (evaluate el.click ×3 on row/strong/span + one TRUSTED locator click): ZERO popups, log stays 2→2, `lastAttack:null`, `monsterLegendaryUses` key never created (per-store or top-level), no movement.
- CONTROL (proves engine alive): live Rend chip via `.mc-action` with `<strong>` /^Rend/i → inner `.mc-dice-link` (" +15"): roll 3+15=18 vs AC 19 MISS, then 15+15=30 ✓ HIT → Done → lastAttack `{attackName:"Rend", hit:true, total:30, dmg:20, Slashing}` + new `roll`/`hp_change` log lines (log 2→6). Poison Breath save chip correctly NOT grabbed (scoped selector).

## Likely Location
- `src/components/encounter/MonsterCardBody.jsx` legendary block (:29-:58 section config + :54 header-gate fork)
- `src/components/encounter/MonsterAction.jsx` affordance gates (attack_bonus/save_dc/dice only)
- `src/services/encounters/monsterLegendaryUses.js` (`legendaryHeaderAction` :153-157, `delegates_to` resolver :7-9)
- `public/data/monsters.json` ancient-green-dragon `legendary_actions` block

## Fix (data-only, MA-0070/MA-0197 template — cf MA-0145 adult-silver/white FIXED Pounce)
1. Header dict gains numeric `uses: 3` ("(4 in Lair)" stays advisory name-text) → counter + spend/turn economy wire up automatically.
2. Pounce row gains `delegates_to: "Rend"` → routes through the existing delegation attack-roll seam so the click rolls the dragon's Rend with numbers.
3. Move-half-Speed clause: GM-advisory prose (no movement producer app-wide, §7 — halfSpeed consumers are PC reaction/rage only, MA-0220).
- Data-edit pitfall (MA-0209/MA-0164): Pounce description text repeats verbatim across dragon siblings — anchor edits on the ancient-green-dragon block (unique neighbour content), JSON.parse + full `git diff` review after.

## Cleanup
- Admin clear change-data + log via curl; overlays dismissed; post-reload verified log `[]`, change-data `{}` (no resurrection).
