# BUG — MA-0408: Blob of Annihilation "Lashing Goo" legendary = zero-affordance inert (MA-0407 twin)

**Verdict: FAIL** — the row renders as inert prose with zero clickable nodes. Clicks never run the Pseudopod attack pipeline. No to-hit, no dice, no damage, no spend, no refusal — silent nothing.

## Row
- Monster: Blob of Annihilation (monsterIndex `blob-of-annihilation`), category `legendary_actions`, actionIndex 3, name "Lashing Goo", type other.
- Intended mechanic: "The blob makes one Pseudopod attack." → should forward actions[1] Pseudopod: to-hit +15 vs AC9, 3d10+8 Force.

## Data (monsters.json, NOT edited)
- `legendary_actions[3] = { name: "Lashing Goo", description: "The blob makes one Pseudopod attack." }`
- NO `delegates_to`, NO `attack_bonus`, NO `damage_dice_primary`, NO `save_dc`, no usage struct.
- Header `legendary_actions[0]` "Legendary Action Uses: 3" lacks `uses` → legendary economy DEAD (MA-0405 twin, MA-0375 class).

## Static trace
- MonsterCardBody.jsx:54 — `legendaryHeaderAction()` null (no `uses`) → else branch (line 57) renders legendary section WITHOUT `legendaryGate`.
- MonsterAction.jsx — LegendarySpendLink:158 returns null (`!legendaryGate`); attack chip gated on `attack_bonus` (null); ActionDamageLinks:41-44 — `extractDamageDiceFromDescription("…makes one Pseudopod attack.")` → null, no formula → null; ActionSaveRoll gated on `save_dc` (null); row is not Spellcasting; GatedReactionSlot def null → **zero affordance by construction**.
- The only forwarding seam is `legendaryDelegateAction` (monsterLegendaryUses.js:6), keyed solely on authored `delegates_to`. No prose "makes one X attack" resolver exists anywhere; grep: zero src/server references to "Lashing"/blob "Pseudopod" outside monsters.json data. Aaspherin/arch-hag/ancient-dragon rows work ONLY because their data carries `delegates_to`.

## Live evidence (test-campaign, localhost:5173)
- Header `test-campaign`; EB exact "Blob of Annihilation" CR 23 → Join. cs: round 1, all targetName null.
- Armed: Blob target combobox → `targetName: "HexWarlock"` (curl-verified); HexWarlock ac 9, 100/100 HP.
- Lashing Goo row DOM: `<strong>Lashing Goo.</strong> <span>The blob makes one Pseudopod attack.</span>` — **0 clickable nodes** (no span.mc-dice-link, no button, no [role=button]). Identical shape to MA-0407 Grasping Glob.
- Forced clicks ×2 (row el.click() + strong.click()): no popup-overlay, no to-hit flip, no dice, log frozen at join-time 2 rows (`encounter`, init `roll`), no `monsterLegendaryUses`/cooldown stamp on blob store (keys `[]`), no `lastAttack`, HexWarlock hp unchanged 100/100. Zero spend, zero refusal — pure dead row.

## Impact
Player-facing legendary "attack" affordance silently inert; GM must hand-run the Pseudopod attack via the actions[1] row. Economy already ungated (MA-0405/0406), so this is a forwarding seam gap on top, not a gate refusal.

## Fix suggestion
Author `"delegates_to": "Pseudopod"` on legendary_actions[3] (existing MA-0022 delegate seam resolves the full attack roll+damage for free), and add the `uses: 3` header key (MA-0405 fix) so the gated spend path engages. Without `uses`, delegate resolution never runs either — the ungated branch offers no affordance for non-numeric rows.

## Cleanup
Admin "Clear Change Data" + "Clear Campaign Log" (native confirms, test-campaign); curl-verified cs `{}`, log `[]`.
