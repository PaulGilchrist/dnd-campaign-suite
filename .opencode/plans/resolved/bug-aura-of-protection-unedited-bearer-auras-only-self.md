# Aura of Protection: unedited bearer auras only itself (legacy party default missing from the ally gate)

## Summary
`computeAuraBonus()` (the single production seam for the Aura of Protection save pad) gates coverage on `getAllyList(bearer).includes(targetName)`. For a bearer that has NEVER used the 🤝 Allies editor, `getAllyList` falls back to `[bearerName]` — so an unedited ElderPaladin grants the Cha-to-saves aura to **himself only**, silently dropping the RAW party-wide aura. Every sibling betrayal-gate lane (wolf, lion, opportunity attacks, and today's Wolf target-axis owner ruling) explicitly keeps a "pre-editor legacy party-by-type default"; Aura of Protection is the one lane that doesn't.

## Steps to reproduce
Starting state: campaign `test-campaign` on localhost (:5173), Battle Arena activated, Encounter Builder has Gazer joined (qty 1, armed target = FeyRanger), tokens on battle-arena: ElderPaladin @ (2,7), FeyRanger @ (3,8) (5 ft apart, inside the 10-ft aura), `ElderPaladin.change-data` bucket has **no** `selectedAllies` key (unedited).

1. Open Gazer's stat card (Initiative → Gazer avatar) and click the Frost Ray `DC 12 Dexterity` chip → saving-throw prompt modal appears for FeyRanger. Click **Roll Save**.
2. Read the result stage: bonus line prints `d20 (n) + 8` — FeyRanger's base DEX save only. The unedited ElderPaladin is 5 feet away and standing, but contributes **+0** (verified: "FeyRanger succeeded Dexterity save (DC 12, rolled 20 +8 = 28)").
3. Without changing anything else, add an explicit ally list to the bearer that INCLUDES the victim: POST `/api/campaigns/test-campaign/ElderPaladin` with the bucket's full value plus `selectedAllies: ["ElderPaladin","FeyRanger"]`.
4. Re-fire the same Frost Ray chip → Roll Save.
5. The result stage now prints `d20 (n) + 13` (+8 base **+5 Aura of Protection**, Cha +5) — verified: "Total: 30 vs DC 12 — d20 (17) + 13".

## Expected behavior
Per the doctrine documented in `src/hooks/useAllySelection.js:24-27` ("the allegiance override lanes (aura bearers, sneak flanking, opportunity reach) keep the pre-editor type-based defaults until an explicit list exists") and the owner ruling echoed in commit 8444e9f14 ("the bearer's unedited default treats party PCs as allies and NPC/monster tokens as enemies (legacy party-by-type split, same as the OA betrayal gate)"), step 2 should already include the +5 pad for a party-PC target within range. The editor should only be able to NARROW the aura (defectors), not be a prerequisite for it.

## Actual behavior
Step 2 (unedited): zero aura pad (+8). Step 4 (edited to include the same ally): +5 pad (+13). The ally leg of Aura of Protection is unreachable for every campaign that has never opened the Allies editor — the aura silently degrades to self-only for pre-editor users, contradicting both the documented doctrine and 2024 RAW ("you and friendly creatures within 10 feet of you").

## Likely location
Confident: `src/services/combat/auras/auraOfProtection.js:49-50` —
```js
const allies = getAllyList(name);
if (!allies.includes(targetName)) continue;
```
is missing the `hasExplicitAllyList(name)` legacy branch that `lionAuraUtils.js:9-11` / `wolfAuraUtils.js:10-27` carry. All four production seams call this function: `savePromptHandlers.js:21` (doReroll), `SavePromptModal.jsx:292`, `ConcentrationPromptModal.jsx:150`, `CharConditions.jsx:128` — verified live via the save-prompt seam. Note `computeAuraBonus` receives `allCreatures` from every caller but never destructures it (line 39 takes only `{targetName, characters}`) — the party set needed for the legacy split is already being passed in and dropped.

## Suggested fix
Mirror the Wolf target-side shape: import `hasExplicitAllyList`; derive `partyNames` from the already-passed `allCreatures` (entries with `type === 'player'`, matching the map/great-split doctrine: party tokens ally, NPC/monster tokens enemy when unedited); gate as
```js
const covered = hasExplicitAllyList(name) ? getAllyList(name).includes(targetName) : partyNames.has(targetName) || targetName === name;
if (!covered) continue;
```
Add faces to `auraOfProtection.test.js`: unedited-bearer party-target PADS, unedited non-party target does NOT, edited-named pads, edited-defector refuses. Also thread the campaign-name caveat: `hasCannotActCondition(name)` is called without campaignName (line 48) — pre-existing, cosmetic.

## Severity
Broken feature (rules correctness) — the paladin's headline defensive aura is silently ~halved for every pre-editor campaign; no UI signal explains why allies stop getting the pad. Not a data-integrity risk (no persisted corruption).

## Resolution
FIXED 2026-11-03 — the diagnosis was confirmed exact (not stale): `computeAuraBonus` gated coverage solely on `getAllyList(bearer).includes(target)`, and `getAllyList`'s `[bearer]` fallback made an UNEDITED bearer self-only. Every production seam (`savePromptHandlers.js:21`, `SavePromptModal.jsx:292`, `ConcentrationPromptModal.jsx:150`, `CharConditions.jsx:128`, plus `conditionSaveService.js:72` and `concentrationService.js:19` — six callers, two more than the bug file listed) already passes `allCreatures` (combat-summary creatures); the helper just ignored it.

### What changed
- `src/services/combat/auras/auraOfProtection.js` — added module-private `bearerCoversTarget(bearerName, targetName, partyNames)` mirroring the Wolf target-side gate (`wolfAuraUtils.js:24-27`) and the OA betrayal gate (`opportunityTrigger.js:47-48`): EDITED bearers pad only their named list (editor NARROWS — defectors refused); UNEDITED bearers keep the legacy party-by-type default — `partyNames` derived from the already-passed `allCreatures` (entries with `type === 'player'`, the great-split doctrine), bearer always covers itself. `computeAuraBonus` now destructures `allCreatures`. Range gate (`isWithinRange`), cannot-act gate, Cha clamp, tie rule and return shape untouched. No 2024 twin exists (single ruleset-agnostic module). The `hasCannotActCondition(name)` campaignName caveat was left as-is (pre-existing, cosmetic — the runtime store defaults to the loaded campaign).
- `src/services/combat/auras/auraOfProtection.test.js` — extended the `useAllySelection` partial mock with `hasExplicitAllyList`; default test posture is now an EDITED list naming the target (preserves every pre-existing face's meaning); added a 6-face regression block: unedited bearer PADS party-PC target, unedited REFUSES npc-type token, unedited covers self with no combat summary, unedited-without-party-set degrades to self-only (no regression vs old floor), edited-named pads, edited-defector `[self]` refuses.

### Verification
Live repro + fix, test-campaign :5173 (rig: Gazer EB-joined, armed target FeyRanger, `__map__.activeMapName=battle-arena`, tokens EP@(2,7)/FR@(3,8) via full-doc map PUT):
- Pre-fix unedited bearer, Frost Ray `DC 12 Dexterity` chip → `.sp-modal` → Roll Save: `d20 (12) + 8` (zero aura) — bug confirmed face-for-face; log `save_result` "rolled 12 +8".
- Edited `[EP,FR]`: `d20 (9) + 13 (+5 aura from ElderPaladin)` — the black-box differential.
- POST-fix, bearer restored to UNEDITED (bucket replaced with `{}`, replace-echo evicts the ghost key in the mounted tab): same chip → `d20 (4) + 13 (+5 aura from ElderPaladin)`; log "rolled 4 +13" — Expected behavior now occurs WITHOUT the editor.
- Defector face post-fix: edited `[ElderPaladin]` → `d20 (13) + 8` — narrowing still enforced (adjacent-behavior sanity).
- Tests: `auraOfProtection.test.js` 39/39; `src/services/combat/auras|conditions|concentration` 1124/1124; `src/components/common` + `char-summary` (all consumer seams) 1267/1267; `npm run lint` zero warnings; `no-timers-guard` OK.
- Campaign left as found: change-data `{}` + log `[]` + combatSummary `null` two-pass verified after admin clears; battle-arena.json md5-restored byte-exact to the CJ baseline `94fcd0bfe9e4cf6e1118f736b920e7a2`; all character disk files untouched (rig lived entirely in change-data + map).
