# App Exploration Map

**DESCENT RUN DF — 2026-11-06 (post-DE batch descended: e923a05ef stroke-crit fix LIVE-VERIFIED all live faces (PT1 CLOSED), 8642a612d harmonized conversion copy LIVE-VERIFIED both twins; Stroke-of-Luck bug file confirmed in `resolved/`; 1 NEW BUG filed: boon on a nat-1 converts the auto-miss but the popup prints "CRITICAL MISS!" beside "✓ HIT" — mirror of the just-fixed stroke banner contradiction.)**

Live facts (all re-derived THIS run, test-campaign, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173):

1. **e923a05ef live — 2024 stroke attack conversion now arms the crit, every face.** Sanctioned EvasiveFighter 2-field disk surgery (class→Rogue/Arcane Trickster, level→20; md5 `0df29ff3…` backup → byte-exact restore, API `.json` GET re-proves Fighter/Battle Master/18). Hand-rolled 4-creature `type:player` board (EF/WC/DM/EP), EF→EP armed via scoped cs PATCH (applied:1). MISS (d20 8 +7 =15 vs AC 19) → popup arms ★ Stroke of Luck → press: popup prints **"CRITICAL HIT! — DAMAGE DICE DOUBLED"** (the `Natural 20!` face replaced, exactly as the fix intends) + "d20 20 (Stroke of Luck) +7 / ✓ HIT (27 vs AC 19)". Done → damage stage `1d6+1 [piercing]: 4*2 +1` = 9 (flat mod NOT doubled, §4 crit log shape), log row `formula "1d6*2+1 (4)" isCrit:true`. **Both persisted records**: `campaign.lastAttack` and `EvasiveFighter.lastAttackRoll` carry `hit:true, missConverted:true, convertedBy:"Stroke of Luck", convertedNat20:true, isCrit:true, isNatural20:true` over honest originals (`d20:8, total:15` byte-kept, DE doctrine). Post-consume MISS (d20 10, 17 vs 19): **no Stroke button** — economy latch intact. Old bug file verified gone from `plans/`, present in `plans/resolved/`.
2. **8642a612d live — one sentence, both twins.** Same-session boon face (Disciplined_Monk lv20, feat already on the fixture — zero surgery): ability_use = "…d20 1 + 11 = 12 vs ElderPaladin — **Miss converted to Hit.**"; stroke ability_use = "…d20 8 → 20 (total 15 → 27). **Miss converted to Hit.**" Identical tail sentence (pre-fix stroke copy said "Miss converted to a hit." — replaced live). Ledger legs for the untouched twins run green here: `AttackResultPopup.stroke-of-luck-crit.test.jsx` + `CharSheet.handlers.miss-conversion.test.jsx` **17/17** (5e-host non-crit, boon non-crit, save/check "Natural 20!" byte-unchanged, check-face write-free + sentence-free, foreign-attacker refusal).
3. **Boon twin stays non-crit (live face).** DM nat-1 (d20 1 +11 =12 vs AC 19) → " Boon of Combat Prowess" (leading space re-observed) pressed → converted popup "✓ HIT (12 vs AC 19)" + "Boon of Combat Prowess: Miss converted to Hit" note, **no crit banner**; damage single pool `1d6+5: 5 +5` = 10, log `isCrit:false`; persisted `lastAttack` `hit:true, isCrit:false`, `convertedBy` set, **no `convertedNat20` key at all** (helper only spreads the crit trio when the flag is passed). **BUG: the converted popup still renders "CRITICAL MISS!" beside "✓ HIT"** (showFumble never suppressed on the converted face — mirror of the stroke contradiction) → `bug-boon-nat1-conversion-keeps-critical-miss-banner.md`. Feats.json copy "When you miss with an attack roll, you can hit instead" has no nat-1 carve-out, so offering it is defensible; the double banner is not.
4. **New rig laws observed (folded into playbook).** (a) PC sheet attack lane resolves **"vs AC N" from the target's LIVE SHEET AC** (EP 19, WC 12), the hand-rolled board `ac` is display-only there — pick a genuinely high-AC target to bias MISSes. (b) Rogue-lv20 grant ALSO derives **Devious Strikes**: weapon row click opens an `.sp-overlay` chooser ("Apply Effects"/"Cancel") BEFORE the roll (Cancel = roll with no effect); a blind overlay-flush can accidentally APPLY an effect (the 1d6 sneak + poison CON-save prompt that then blocks every further row click until Roll Save/Dismiss drains it). (c) Any lingering `.sp-overlay` (chooser or save prompt) intercepts attack-row clicks → Playwright `rowclickfail` noise is an overlay-state symptom, not a dead lane: check overlays first. (d) Sheet damage lane writes PC HP to the runtime bucket (EP "HP: 224 → 215" — sheet truth), NOT the hand-rolled `cs.currentHp` (stayed 90) — §2 HP-truth re-confirmed from the attacker side.
5. **Session health:** 0 console errors / 0 warnings, 0 4xx/5xx (besides design), 1 lock line = own zz-probe; battle-arena md5 94fcd0bf byte-untouched; maps = 4 owner fixtures all inactive; no throwaways created (seeded/TV/delegation/allies lanes event-clear — no new commits touch them since CV/CQ rows); final closed-tab two-pass API clears → change-data `{}` + log `[]` GET-verified both passes, no rehydration.

**PRIOR RUN DE — 2026-11-06 facts folded (full text in git log of this file):** aura-caveat 4/4 faces on fixed code (2c1c51cf7 sheet-only-tab board-echo adoption PROVEN), 517d48416 drop-note both views, 24afdd995 HAM breakdown data+UI, Stroke-of-Luck live face via grant recipe (conversion contract + latch PASS; crit bug filed — SINCE FIXED e923a05ef + DF-verified dead), hand-rolled cs board + savePrompt-injection rigs, popup flush laws.

**Freshness for the NEXT run:** DF entered/re-derived: stroke conversion lane end-to-end post-fix (`CharSheet.handlers.js` persistConvertedAttackHit/isStrokeConvertedNat20, `DiceRollResult.computed.js` computeConvertedNat20, `DiceRollResult.jsx` CritNotices, `AttackResultPopup.jsx` strokeNat20Applied), sheet-melee popup lane (~10 attacks incl. both conversion twins), boon lane economy + copy (`feats.json` copy unchanged). Rows demote only if THOSE see new commits. Untouched-and-event-clear: aura family, HAM breakdown, Divine Spark/SS, modal save-dismissed family, corona, EB join, overlay transport, maps lanes, throwaway seeded lanes, TV/delegation/allies, hex, sprites.

## Live-Claims Folded History

<details><summary>DE/DC/DB/CZ/CY/CX/CW/CQ/CR/CU/CV/CS/CJ-CP records (folded, full text in git log of this file)</summary>

**DE** (2026-11-06 pre-DF): 2c1c51cf7 aura-caveat 4/4 + 517d48416 drop note + 24afdd995 HAM breakdown live-verified; Stroke-of-Luck live face via sanctioned Rogue-lv20 grant (conversion contract + latch PASS; crit-damage bug filed — fixed+DF-verified dead); lastAttack is TOP-LEVEL; sheet attack rows are `div.left.clickable` in `.attacks` (spells are `td.left`).

**DC** (2026-11-06): modal-family save-dismissed live face CLOSED (BlindnessDeafnessModal 5/5 via sanctioned spell grant + md5 restore); lane-transport law: modal lanes arm ONLY the `savePrompt-<T>-<pid>` arrival key; slot pays PRE-modal at "Cast Spell"; 0 bugs.

**DB** (2026-11-06): c9ae24fc7 boon conversion 5/5, f526147ac Divine-Spark header both branches, 8b2dd5c78 caveat 4 faces (3 PASS, 1 bug — FIXED 2c1c51cf7); direct savePrompt-injection rig proven.

**DA** (2026-11-06): post-CZ batch all live-verified; 1 bug filed (boon hit-flag — FIXED c9ae24fc7, DB-verified dead); hand-rolled full-store cs board + popup-flush loop law born.

**CZ**: PT1 DivineSparkModal 7 faces — dismiss-softlock + no-target self-harm bugs (both FIXED + DA-verified dead); corona async 60/65 ft TRUE/EXACT-60; new-bucket full-store POST law (PATCH 404s on absent bucket).

**CY**: corona picker-route fix 3e3113213 ALL faces both seams; PT2 "second orphan lane" claim WRONG — live PC-cast producer found, lane KEPT; 0 bugs.

**CX**: ghost Rotate hidden + deactivated-map advisory; PT4 cross-tab adoption CLOSED; hex `character:` drop → orphan-lane (deleted); corona picker-route bug filed (fixed).

**CW**: seven post-CV commits live-verified (ghost-item fix, burst-PATCH coalescing, map self-heal, never-hijack, hex3d labels, skeleton row, wizard close); parentHex indoor-arm CLOSED.

**CS**: stale-sheet fix 3-face PASS; scoped-PATCH arming PASS; corona 60 ft bug filed → fixed 13dd98cc4. **CQ**: f1deeb510/f07304b66/efa2d311a/da76fc38d PASS; corona-on-attack-roll filed (fixed+verified); PT2 OA denied-on-sticky CLOSED. **CR**: corona attack-lane twins, map-deactivate 6-face, friendly-fire, id-normalize, 400-copy all PASS; stale-sheet ghost-write filed (fixed b1ca01152). **CU**: cross-client HP adopt CLOSED; two-tab PATCH races clean. **CV**: full sprite lanes (2D/3D/LAN), throwaway seeded lanes deep (quick-create, wizard gate, ×11 checklist, FULL regen ride, typed-name deletes), ghost-item bug filed (fixed af07dd67e). **CJ-CP**: aura family (AoP edits, PowW Lion/Wolf matrices, monster-lane aura consult, wolf gridless fix), stale-sheet origin, allies betrayal flips, friendly-fire modal — all filed/fixed/verified cycles; see git log.

</details>

## Priority Targets (next descent)

1. **Fix-verify `bug-boon-nat1-conversion-keeps-critical-miss-banner.md`** when the fix lands (faces: boon press on a d20-1 MISS popup → converted face shows NO "Critical Miss!" notice and no crit banner; normal-miss boon face byte-unchanged; genuine nat-1 WITHOUT boon press keeps "CRITICAL MISS!"; ledger pins in `AttackResultPopup.stroke-of-luck-crit.test.jsx`). Zero-surgery rig: Disciplined_Monk (fixture already holds the feat) + hand-rolled board, arm via scoped cs PATCH.
2. **AI-Dress LIVE invention face** — still owed a model rig (no-config face verified honest twice, pre-disable face CY).
3. **save-dismissed census live spot-checks beyond the proven families**: DA/DB/DC-closed lanes are event-clear unless `AreaEffectTargetModalBase.jsx`/`AreaEffectSaveFlow.utils.js` see new commits.
4. **Divine Spark zero-charge + Cancel + refusals** — DA-proven, event-clear; only re-ride if `divineSparkHandler.js`/`DivineSparkModal.jsx` see new commits.
5. **Aura caveat mid-prompt refresh face (DE-by-design note):** snapshot-only re-derivation across an open prompt; only worth a live re-ride if the live-refresh UX is demanded (then it's an improvement, not a bug).
6. Deferred low-value list unchanged (3D per-mesh, hex-travel-3D, indoor wand-drag, Lion "another Barbarian" exemption).

## Depth Seeds (live 2026-11-06 DF unless noted)

- **Stroke-crit rig (DF, post-fix):** sanctioned EvasiveFighter 2-field disk surgery (Rogue/Arcane Trickster/lv20; md5 `0df29ff3…` restore law, API `.json` GET re-proof). Grant ALSO derives Devious Strikes — weapon row click opens `.sp-overlay` chooser first ("Apply Effects"/"Cancel"; Cancel = roll un-effecting). MISS detection: `✗` glyph in popup text (never /MISS/i). Stroke button via `[data-testid="popup-overlay"] button` hasText 'Stroke of Luck'. Converted face banner law: 2024+attack → "CRITICAL HIT! — DAMAGE DICE DOUBLED" REPLACES "Natural 20!"; Done dispatches `isCrit:true` → damage log `formula "1d6*2+1 (N)"` (flat mod not doubled). Persisted trio `{convertedNat20,isCrit,isNatural20}:true` on BOTH `campaign.lastAttack` (top-level bucket) and `<char>.lastAttackRoll`; honest originals (`d20/total`) stay byte-kept.
- **Boon face (DF, zero-surgery):** Disciplined_Monk lv20 fixture already holds `Boon Of Combat Prowess` in feats[] (feats.json copy "…you can hit instead", once/turn round-latch). Button label LEADING SPACE. Converted popup: "✓ HIT" + " Boon of Combat Prowess: Miss converted to Hit" note, no crit banner, no `convertedNat20` key in the records. Nat-1 face produces the filed double-banner bug. Both twins' ability_use rows end with the shared `MISS_TO_HIT_CONVERSION` sentence.
- **Board/AC laws (DF):** PC sheet attack popup "vs AC N" uses the target's LIVE SHEET AC (EP 19, WC 12) — hand-rolled board `ac` is ignored in that lane (still author sheet-truth for consistency); damage applies to the runtime HP bucket (EP "HP: 224 → 215" sheet truth), `cs.currentHp` untouched by sheet-lane hits. Any lingering `.sp-overlay` blocks all `.attacks` row clicks (rowclickfail = overlay symptom; probe overlays first, never conclude "lane dead").
- **Boon conversion rig (DB, re-used DF):** hand-rolled cs board (type:player + sheet-truth `ac`) via full-store POST; scoped cs PATCH arming adopted live (applied:1). `lastAttack` is a TOP-LEVEL change-data bucket. EF feat truth: **Heavy Armor Master** — Bludgeoning 7→1 through it (`damageBreakdown` status:"reduced", 24afdd995).
- **Divine Spark economy rig (DB):** modal radios Necrotic/Radiant, "Heal (1d8 + 4)"/"Harm (…)"/"Cancel" in `.sp-modal`; header chip `.sp-resource-info`; heal clamps at bucket `hitPoints` (seed via scoped PATCH once sheet-open created the bucket).
- **Aura-caveat rig (DB, faces DE):** direct savePrompt injection (playbook §7); caveat observable active-map + zero positioned tokens + bearer off board; tokened-bearer shows `p[data-testid="sp-aura-unmeasured"]`; on-board bearer on zero-token map = PLAIN tooltip (2c1c51cf7, ~3s settle); sandbox-map creation `POST /maps {name,type:'indoor',gridSize,players,placedItems}` → 201, DELETE by slug.
- **Popup flush upgrade (DA):** flush loop clicks root AND descendants of every `[data-testid="popup-overlay"]` until empty; NEVER `.remove()`; re-check `.sp-overlay` after every flush (choosers/prompts re-surface behind popups).
- **Overlay-arm rig / corona geometry / card anchoring / prompt-machine two channels / context-menu / maps API bodies / allies+regen rigs:** unchanged (no touching commits) — CZ/CY/CV/CW-era seeds.
- **Divine Spark auto-derivation (CZ, re-observed DB):** 2024 Cleric ≥lv2 sheet `b.clickable "Divine Spark:"` row from classes.json — zero fixture edits; DC 15 from `spellAbilities.saveDc`; harm needs no map (gridless-lenient).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Stroke-of-Luck conversion lanes post-fix (attack face: grant→MISS-offer→convert→CRIT banner + doubled pool + persisted crit trio; economy latch; copy sentence) | **deep (DF 2026-11-06 — e923a05ef live-verified every face via sanctioned Rogue-lv20 grant + md5 restore; DE bug verified DEAD, file in resolved/; 17/17 new ledgers green)** | `CharSheet.handlers.js DiceRollResult.jsx DiceRollResult.computed.js AttackResultPopup.jsx contextBuilder-sync.js useInitiativeEffects.js` |
| Conversion log copy (harmonized MISS_TO_HIT_CONVERSION both twins; check-face sentence-free) | **deep (DF — both twins' ability_use rows read live identically; check/5e legs ledger-pinned)** | `CharSheet.handlers.js` |
| Boon of Combat Prowess lane post-fix (non-crit twin live, round latch, leading-space label, nat-1 offer face) | **deep (DF — zero-surgery monk fixture face; 1 NEW BUG: converted nat-1 popup keeps CRITICAL MISS! banner)** | `AttackResultPopup.jsx DiceRollResult.jsx feats.json CharSheet.handlers.js` |
| PC melee attack popup flow (row click → chooser → Done → damage → HP apply; HAM breakdown) | **deep (DF re-rode ~10 attacks; DE-era breakdown rows event-clear)** | `DiceRollResult.jsx useLoggedDiceRollAttack.js applyDamage.js damageHandlerUtils.js LogHpHealingEntry.jsx` |
| Aura co-present caveat display lane (all 4 faces on fixed code) | **deep (DE 2026-11-06 — 2c1c51cf7 board-echo adoption PROVEN, 517d48416 drop-note both views)**; event-clear at DF | `App.jsx syncCombatSummaryCache auraOfProtection.js SavePromptModal.jsx combatData.js` |
| save-dismissed hygiene — modal-family live face (BlindnessDeafnessModal 5/5) | **deep (DC 2026-11-06)**; event-clear | `BlindnessDeafnessModal.jsx AreaEffectTargetModalBase.jsx AreaEffectSaveFlow.utils.js savePrompt.js` |
| Divine Spark lane economy + header decrement | **deep (DB — f526147ac both branches PASS)**; event-clear | `divineSparkHandler.js DivineSparkModal.jsx savePrompt.js classes.json` |
| Char-bucket scoped-PATCH seeding (404-before-seed, adopt-live) | carried — event-clear (DA/DB/DF re-observed arms live) | `server/routes/campaigns-changedata.js storage.js` |
| Direct savePrompt-injection rig (5 prompts, drain+evict faithful) | deep (DB) | `server/routes/campaigns-changedata.js SavePromptModal.jsx` |
| Corona family (picker BOTH seams + sync + attack-lane + async 60/65/type-gate) | carried — event-clear (CY/CZ) | `SaveAttackAoeModal.jsx coronaAuraUtils.js aoeService.js` |
| Save-AoE prompt queue UX (evasion stack, dispatch-latch) | carried — event-clear (CY) | `SavePromptModal.jsx LeadingEvasion` |
| AI-Dress no-config face | deep (CY) — live-invention face still **blocked** (no model rig) | `maps-manager/AiDressButton.jsx` |
| EB join → board → overlay arming | carried — event-clear (CY) | `Initiative.jsx createCreatureHandlers.js storage.js` |
| Overlay transport + map create/activate/whole-doc PUT | carried — event-clear (CZ/DE) | `server/routes/spell-overlay.js server/routes/maps.js` |
| Ghost context menu / map activate matrix / coalesced-burst adoption | carried — event-clear (CX/CW) | rows as dated |
| Admin regen + quick-create flavors + throwaway seeded lanes | carried — event-clear (CV) | `CampaignAdmin.jsx RegenerateAdventureModal FirstSessionChecklist CampaignSelection.jsx` |
| TV / victory / delegation / allies editor / friendly-fire | carried — event-clear (CQ/CR/CV) | `initiative/` |
| Hex 3D labels; ItemsPanel arms; fog-math; NPC/quest/faction CRUD; PowW/cover/OA/wolf+lion; LAN combat; inventory/music/rules-tray | carried — event-clear at CQ-CX | rows as dated |

## Baseline Fingerprints (canonical test-campaign state at DF exit — verified 2026-11-06)

- change-data `{}` + log `[]` — closed-tab two-pass API clears GET-verified both passes, no rehydration.
- maps = the 4 owner fixtures all inactive (battle-arena md5 **94fcd0bf** re-verified untouched); spell-overlay not exercised; no monsters joined (hand-rolled board only, swept); no throwaways; campaigns/ = 5 baseline folders.
- npcs [Marta Copperkettle]; 13 char files at canonical bytes — EvasiveFighter.json back to **0df29ff3** after the sanctioned Rogue-lv20 grant (Fighter/Battle Master/18 re-served by the API `.json` route); Disciplined_Monk read-only. No registry additions (rig used fixtures + change-data only).
- Lock grep = 1 line (own zz-lock-probe); console 0 errors/0 warnings; bug files this run: **1** (boon nat-1 double banner, DF); DE's stroke bug verified DEAD (file in `plans/resolved/`).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED at DF 2026-11-06: PT1 stroke-crit fix-verify (e923a05ef live, every face incl. economy latch + persisted trio); 8642a612d harmonized copy both twins live; boon non-crit twin + ledger 17/17.
- CLOSED at DC/DB/DE (see fold ledger): modal save-dismissed face, boon hit-flag fix, Divine Spark header, aura-caveat faces ×4, HAM breakdown, Stroke live face (superseded by DF).
- OPEN: fix-verify `bug-boon-nat1-conversion-keeps-critical-miss-banner.md` (new PT1); AI-Dress LIVE invention face (model rig — infra — the ONLY genuine infra blocker).
- NOT VERIFIED this run (honest scope): stroke CHECK-face live leg (no reachable failing check/save face without a heavier savePrompt rig — structurally gated `rollType==='attack'` + pinned by the 17-ledger pair, both twins' save/check faces byte-unchanged by the fix); 5e-ruleset stroke host live face (same ledger pinning, gate is the literal `rules==='2024'` read); Devious Strikes effect legs (accidental Apply face produced poison save prompt + 1d6 sneak twin — chooser lane noted, effect adjudication NOT descended); throwaway seeded lanes not re-entered (event-clear CV); TV/delegation/allies not re-entered (event-clear CQ-CV); 3D faces untouched (deferred list); monster-damage-chip-with-overlay arm still not clicked live (CY carry).
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D; indoor overlay wand-drag; Lion "another Barbarian with this option" exemption.
