# BUG CLA-041 — Branches of the Tree (Path of the World Tree lv6, 2024 Barbarian)

**VERDICT: FAIL(b)** — 2026-10-03, test-campaign, live Playwright (dev :5173, host DraconicDragon lv20 WT as-is).

## Feature data (truth)
`public/data/2024/classes.json` Barbarian `majors[2].features[1]`, **level 6** (ticket "lv14" wrong), automation
`{type:'reaction_debuff', trigger:'creature_starts_turn_within_30ft_while_raging', effect:'teleport_and_slow', saveType:'STR', saveDcExpression:'8+STR+PB', range:'30 ft', teleportRange:'5 ft'}`.
Real chain (manifest paths stale): `automationRouter.js:227 routeCtPassiveOrReaction` → `reactions` → `automationInfoBuilder/reaction.js:73` → `CharReactions.jsx:872 b.clickable` → `executeHandler` → `automation/index.js:335` → `handlers/reactions/reactionDebuffHandler.js handleTeleportAndSlow (:172)`.

## LIVE WORKING (exact)
- Reactions row `Branches of the Tree:` renders `b.clickable` on host sheet; manual-press affordance lane (no auto turn-start prompt; same accepted lane as Stone's Endurance).
- DC math EXACT: DC **19** = 8 + STR +5 (base16+4 Primal Champion) + PB +6 — printed in popup/prompt/logs on every press.
- STR save prompt seam live (`createSaveListener` → `.sp-modal` "Saving Throw Required… Roll Save → SAVE FAILURE/SUCCESS verdict → Done"), rolls real NPC mod (+0 Bandit, −1 WSD), threshold correct (19=SUCCESS, 11/8/4..=FAILURE).
- Fail branch: te `{effect:'speed_reduction', target:<t>, source:'Branches of the Tree', value:1000}` at campaign root; sheet shows **"Speed: 0 ft."** + badge **"Speed 0"** (`creature-badge effect-debuff`); `addExpiration {remove_target_effect, rounds:1, appliedRound:3}` stamped; round-wrap walk → te drained to 0 at round 4.
- Logs: `ability_use` (press, w/ promptId) + paired `save_result` fail ("teleported and speed reduced to 0 until end of current turn") and success ("Branches of the Tree has no effect.") — success leg farmed to 3 successes (d20 19, 19, 20), success writes NO te (verified ledger).

## DEFECTS
1. **TELEPORT NEVER EXECUTES (core-effect inert → FAIL(b))**: 38 failed saves live → ZERO destination chooser/modal, ZERO token movement (map tokens frozen: Wild_Sage_Druid stayed (8,4) — 25 ft from Dragon token (3,4), nowhere near "within 5 ft of you"), zero teleport-state keys in change-data (`grep 'teleport' root = []`). "Teleported" exists only as popup/log prose. CLA-384 (Warping Implosion) precedent: missing-teleport = FAIL, not advisory-PASS.
2. **Trigger→target binding broken (stale cs mirror)**: while root `activeCreatureName`='Bandit 1' (truth, Next writes top-level), handler's `getActiveCreatureName` read cached `cs.activeCreatureName`='Wild_Sage_Druid' → STR save prompt + te hit a PC, not the creature starting its turn — pre-reload AND post-hard-reload on first press. `combatData.js getActiveCreatureName` reads cs mirror; `resolveActiveCreatureName` fabricates creatures[0] fallback; campaign store never carries the truth key. Same family as bug-CLA-044 ("Next writes only top-level activeCreatureName"). Only after SSE churn did later presses finally resolve Bandit 1 — nondeterministic targeting.
3. **Rage gate absent**: control leg — Rage ended ("Rage ended" popup, `activeBuffs:[]`), press still fired full popup + DC 19 STR save prompt + te. Trigger says "while your Rage is active"; handler (:172–266) has zero isRaging/stance checks.
4. **Range gates inert**: 30 ft gate `gateBranchesInRange` requires cs gridX/gridY — cs entries carry NONE app-wide (grep: nothing writes gridX into combatSummary; map tokens ≠ cs) → gate returns null (lenient pass) every press; >30 ft differential unexpressible. 5 ft teleport destination gate moot (defect 1).
5. **Reaction never spent, no latch**: no `uses_expression` → budget 0; no round-latch key (root `grep 'branch' = []`); repeated presses same window all accepted (~24 duplicate te rows accumulated; only round-wrap expiry cleaned). RAW once-per-round Reaction economy unmodeled — MA-0891/CLA-295/CLA-035 family.
6. Cosmetic: duplicate `ability_use` tail per press (handler prompt-log + generic tail); prompt-logger `save_result` rows carry `characterName:'Unknown'`; expiry is round-wrap (round 4) vs RAW "end of the current turn" — lasts ~1 round too long.

## Recipe (repro)
Initiative page → + NPC → rename input to 'Bandit 1' (name lives in `input`; Remove via `button[title*="Remove"]`) → set Init via `input[placeholder=Init]` fill+Enter (DRAGON 30 / Bandit 20 / all other PCs 10 — empties sort FIRST and would eat 14 turns) → Next to Dragon (rage: `b.clickable 'Rage:'` → **Cancel Travel Along the Tree hijack modal**, confirm ragePoints 6→5 + stance) → Next to 'Bandit 1' → sheet `b.clickable 'Branches of the Tree:'` → popup DC 19 → `.sp-modal Roll Save` → verdict stage → Done → te+badge+logs; farm 19+/20 for success leg. Judge target via popup/prompt targetName vs GET root activeCreatureName (cs mirror stale fingerprint). Expiry: walk Next to round-4 wrap → te drained.

## Cleanup done
Bandit removed (native confirm), Initiative Clear (native confirm), Admin Clear Change Data + Clear Campaign Log (native confirms, server-verified `{}` + `[]` — then 1 mastery-arm log by re-arm), Longsword mastery re-armed (`_Weapon_Kind_Mastery_chosenWeapons=["Longsword"]`), host lv20 WT pristine, server left up. **No config/character/manifest/git edits.**
