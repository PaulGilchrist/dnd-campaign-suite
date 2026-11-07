# App Exploration Map

**DESCENT RUN DI — 2026-11-07 (post-DH improve batch: all 3 new commits live-VERIFIED — 9a82ec4ef spellValidation noise dead (DivinationWizard sheet load + full session, console errors 0, DH-era x2/sheet gone); 6ba0b73a0 crit `*2` marker stamped on sheet-lane damage rows across THREE crit faces (`1d6*2+3 [slashing] + 10d6*2 [Sneak Attack]`, flat never doubled, rolls stay single-set len 11, values honest 59=2×28+3 / 73=2×35+3); 82ded5c1c VT trip-success popup honest copy live (`Versatile Trickster: Trip attempted on X but X succeeded its Dexterity save (DC N) — no trip`), holder+primary excluded from VT list re-observed. 3 NEW BUGS: DS Poison/KO `repeatingSave` boolean has ZERO consumers — the turn-END repeat roller reads a DIFFERENT key (`te.repeatSave` object), so advertised "1 min, repeating" never offers a repeat save; Daze `dazed` condition never expires (save-gated riders skip the FT-082 `addExpiration` behind `if (!option.saveType)`) → victim grants every attacker permanent "Adv (conditions)" (chip on/off control-proven); and the DISPROVED poison-save-SUCCESS cost refund REPRODUCED on HEAD 616289b98 (`10d6`/11 rolls under a "Forgoing 1d6" row; same-tab controls Trip-success/Poison-fail/Daze all deducted correctly) — regression-or-flake re-filed.)**

Live facts (DI, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173, test-campaign):

1. **DS cost/economy faces (rig: sanctioned EF Rogue-AT-lv20 + Poisoner's Kit surgery, md5 `0df29ff3` restored byte-exact both legs; hand-rolled 3-creature type:player board EF18/EP19/DM19; sandbox `di-vt` EF(5,5)/EP(6,5)/DM(7,5); warding_bond ±19 save dial):** cost-per-option census re-pinned live — Trip-success `9d6`, Poison-fail `9d6`, Daze `8d6` (2d6 cost), Cancel-no-choice crit full `10d6*2`, and the refund face `10d6` (see bug files). 10d6 sneak pool at lv20 confirmed (`sneak_attack_num_d6: 10` in classes.json).
2. **Stroke of Luck is ONCE per Short/Long Rest (data byte-confirmed: `recharge:"short_or_long_rest"`, "Once per Short or Long Rest")** — the §7 "deterministic crit dial" converts MISS→crit exactly once per rest per char: cycle 1's miss popup carried the button (used → `ability_use "d20 4 → 20"`, banner `CRITICAL HIT! — DAMAGE DICE DOUBLED`, no false Critical-Miss banner); every later miss popup honestly lacked it across 3 round bumps. Not a bug; the dial note now caps at "one ride per rest".
3. **Rider stack after a sheet-lane crit hit (EF holder of Charger+Shield Master+Slasher feats):** damage stage parks behind up to FOUR stacked overlays — DS chooser → Charge Attack chooser (re-offers EVERY hit, §17 accepted, Cancel-safe) → Shield Bash STR DC17 prompt (fires on every hit, Roll Save/Dismiss) → on STR-FAIL a NEW choose-one chooser `Push—Push 5 ft / Prone—Target gains Prone`, buttons `Apply Effect` + **`Skip (do not consume use)`**. Both faces ridden: Push → `ability_use "Shield Bash used against X: pushed 5 ft."` + `push|instant` te + "Pushed" badge, token does NOT move (§17 movement subsystem gap, advisory by design); Skip → zero spend, zero state delta. Drain-loop doctrine: click the LAST `.sp-overlay` (stacked chooser + prompt both mount), and allow `^Cancel$|^Skip|Trip Secondary Target|Apply Effects?$` — the VT confirm button is `Trip Secondary Target`, the DS confirm is plural `Apply Effects`, Shield Bash confirm singular `Apply Effect`.
4. **Repeat-save lane split (NEW BUG 1):** classes.json Devious Strikes options author `repeatingSave:true` (Poison + Knock Out); `attackRiderHandler.buildRiderEffect` copies it to the te as a BOOLEAN; `repeatSaveService.applyRepeatSaveTurnEnd` (wired at navigationHandlers turn-END, works for thri-kreen/whirlwind) filters `te.repeatSave && typeof te.repeatSave === 'object'` → never matches. Victim walked past own turn: zero log/prompt/te delta, `poisoned` stays forever except by rest/clear. Filed `bug-devious-strikes-poison-repeat-save-never-fires.md`.
5. **Save-gated rider expiry gap (NEW BUG 2):** the FT-082 `addExpiration` in attackRiderHandler is gated `if (!option.saveType)` → Daze/Obscure/etc. te rows (`until_start_of_next_turn`) register NO clock (`pendingExpirations:[]`) and no duration-string consumer exists (`until_start_of_next_turn` grep-zero in expireStaleEffects). `dazed` counts as an advantage-granting condition in `contextBuilder-sync` (`adv += countIn(condSet,['dazed','slow'])`) → every later attack vs the victim prints `Adv (conditions)`: CONTROL-PROVEN — chip present at rounds 5–6+ post-Daze, gone within one scoped-PATCH after removing `dazed` from the bucket (all else byte-identical). Filed `bug-devious-strikes-daze-never-expires.md`.
6. **Poison-success refund recurrence (NEW BUG 3):** forced-success face (dial +19, `save_result … succeeded CON save … full success`, `…succeeded — no effect` row) still logged `Forgoing 1d6` then rolled the FULL `10d6` pool (11 rolls, 41 dmg). 5949aa22b's disproof (4×`9d6`) stands as that run's observation; current HEAD reproduces the original DH fingerprint. Filed `bug-poison-save-success-refund-regressed.md` (fix-verify must sample ≥3 success faces — flaky-lane suspicion).
7. **Session health:** console 0 errors / 0 warnings entire session (incl. caster-sheet load — the spellValidation fix); no failed app requests; no monsters EB-joined; no throwaways created (seeded/TV/delegation/allies lanes git re-checked event-clear: zero touching commits since 2026-11-05 in npc/quest/encounter/settlement/tv/routes paths); f4cca8f96 (initiative overlay dead-option suppression, Nov 5, unit-ledgered) landed under DH's "event-clear" claim for the monster-card lane — face NOT live-re-ritten this run, see Blocked. battle-arena md5 94fcd0bf untouched; di-vt created→ridden→DELETED (maps back to 4 owner fixtures); final closed-tab two-pass clears → change-data `{}` + log `[]` + combatSummary null, GET-verified twice; campaigns/ = 5 baseline folders; lock grep = false-positive only.
8. **Freshness:** new-code faces opened this run: crit-marked sheet ledger (deep), VT success copy (deep), DS economy+expiry seams (deep — 2 bugs), stroke rest-economy face (deep). NEXT fresh code: fix-verify the 3 DI files; f4cca8f96 live face (needs dead-token overlay board); Knock-Obscure expiry audit leg named in the daze bug.

## Live-Claims Folded History

<details><summary>DE/DF/DF+/DG/DH/DC/CQ-CV-era records (folded, full text in git log of this file)</summary>

**DH** (2026-11-06): sneak-cycle fix CLOSED (e81bdd985, mergeModalStates law); 4 improves live-PASS (live breakdown, chooser cost-lock, te-evict both legs, VT holder-exclusion); FULL Devious Strikes 6-option matrix (Withdraw/KnockOut/Obscure/Daze-fail/Skip/Poison refusal+fail+success); wizard spell-step class filter PASS; music persistent playback PASS; poison-success refund filed (later DISPROVED same evening by owner re-run). **DG**: boon nat-1 fix all faces; VT picker first ride; sneak-cycle seam born. **DF+**: AI-Dress live-model cycle (omlx :8000, Qwen-only policy); 5e Stroke twin. **DF**: stroke-crit fix; boon nat-1 banner filed. **DE**: aura-caveat faces; Stroke live face. **DC**: modal-family save-dismissed 5/5. **DA/DB**: boon hit-flag + Divine Spark fixes; savePrompt-injection rig. **CZ/CY/CX/CW/CV/CQ/CR/CS/CU**: corona family, ghost context menu, maps lanes, throwaway seeded lanes (quick-create, ×11 checklist, FULL regen ride, typed-name deletes), TV/delegation/allies editors, friendly-fire, sprites, fog, NPC-quest-faction CRUD — all filed/fixed/verified; see git log.

</details>

## Priority Targets (next descent)

1. **Fix-verify the three DI bug files** (repeat-save key mismatch, daze expiry, poison-success refund regression) — all rigs + controls are written in the files; the refund needs ≥3 success faces (flake suspicion).
2. **f4cca8f96 live face**: monster-card overlay picker must suppress dead-token targets — needs an EB-joined monster + a killed victim on the board (CY had the dead-KB rig recipe).
3. **Obscure (blinded "until end of its next turn") expiry audit** — named inside the daze bug; same save-gated no-clock path, verify same over-persistence (blinded is a BIGGER advantage/miss grant).
4. **Knock Out repeat-save face**: its classes.json copy literally says "repeats save at end of each turn" — confirm same dead lane (probably fixed by bug-1's repair; re-ride after).
5. **AI designer chat/plan/generate + refine live-model faces** (rig + Qwen-only policy playbook §2; dress lane deep at DF+).
6. Retired/deferred unchanged (3D per-mesh; hex-travel-3D; indoor wand-drag; Lion exemption).

## Depth Seeds (live 2026-11-07 DI unless noted)

- **DS rig shorthand (unchanged + DI deltas):** EF disk surgery (Rogue/AT/20 + Poisoner's Kit; restore md5 0df29ff3 + API GET proof); hand-rolled full-store POST cs board (type:player, targetName armed on ATTACKER row); sandbox map 3 adjacent tokens for VT; warding_bond ±19 scoped-PATCH win/lose dial; round-scope PATCH re-arms sneak + charge + shield-bash riders; Stroke dial = one MISS→crit conversion per REST; drain = LAST .sp-overlay first, buttons `Roll Save|Next Save|Done|Cancel|^Skip|Trip Secondary Target|Apply Effects?`; top-up victim (scoped PATCH currentHitPoints) before every expected big hit.
- **Repeat-save truth test:** after poison-fail grant, walk Next past the victim's own turn + bump rounds; discriminator = any new `save_result`/`ability_use` row naming the repeat — DI observed ZERO. Registry precedent that DOES work: `thri_kreen_bite_poison` te (repeatSave OBJECT + `grantRepeatSaveEffect`).
- **Adv-chip control-probe recipe:** `PATCH /:c/<Victim> {value:{activeConditions:[...minus dazed...]}}` → chip flips off next press, everything else byte-identical. `Adv (conditions)` renders in the popup header line; rolls become `d20 a, b → kept`.
- **Shield Bash choose-one:** fail-STR face opens `.sp-overlay` with label rows `Push—…`/`Prone—…`; clicking the LABEL ticks, `Apply Effect` enables; `Skip (do not consume use)` = clean exit. Push = advisory log + `push|instant` te (no token move).
- **Music rig / wizard filter probe / nat-1 hunt rig / throwaway seeded lanes:** unchanged — DH/CZ-era seeds + playbook §4/§12.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Crit ledger shape sheet lane (6ba0b73a0 `*2` on base+sneak groups, 3 faces: conversion crit, adv-nat20, plain nat20; flat undoubled; rolls single-set; values verified 2×dice+flat) | **deep (DI)** | `attackRollDamageCalc.js markCritDoubledGroups buildSneakAttackStep` |
| VT save-success copy (82ded5c1c honest "attempted…no trip" popup + holder/primary-excluded picker + primary-save-success still offers VT) | **deep (DI)** | `versatileTricksterHandler.js` |
| spellValidation noise fix (caster sheet + full session, console errors 0) | **deep (DI)** | `spellValidation.js` |
| DS cost economy faces (Trip 1d6 / Daze 2d6 / Poison 1d6 deduct live; Cancel = full pool; success refund REGRESSED — filed) | **deep (DI)** | `attackRollDamageCalc.js cunningStrikeUtils.js` |
| Repeat-save lane (repeatingSave boolean vs repeatSave object; victim turn walked, zero delta) | **deep (DI) — filed** | `attackRiderHandler.js repeatSaveService.js navigationHandlers.js` |
| Daze/condition expiry (no clock for save-gated riders; permanent adv chip; control-proven) | **deep (DI) — filed** | `attackRiderHandler.js:619 gate, contextBuilder-sync.js, expireStaleEffects.js` |
| Shield Bash feat chain (STR prompt per hit → fail chooser Push/Prone both faces, Skip no-spend, Push advisory te) | **deep (DI)** — DG's open leg CLOSED | `feats handler family, attackRiderHandler` |
| Stroke of Luck rest economy (once per short/long rest button-lifecycle) | **deep (DI)** | `classes.json 2024 rogue, CharSheet.handlers.js` |
| Sneak-cycle fix / DS option matrix / VT picker / boon-stroke family / dice fairness / PC melee popups | deep (DH–DG) ; event-clear re-checked DI (no touching commits since except the 3 verified improves) | rows as dated in folded history |
| Wizard spell-step filter / music persistence / modal-merge law | deep (DH); event-clear | `SelectableList.jsx / App.jsx music / modalStateMerge.js` |
| Monster-card overlay dead-option suppression (f4cca8f96, unit-ledgered) | **shallow — live face not re-ridden DI** (landed under DH's event-clear claim) | `initiative/CreatureCard.jsx` |
| Throwaway seeded lanes / TV / delegation / allies / friendly-fire / maps / fog / sprites / NPC-quest-faction CRUD / inventory-rules-tray | carried — event-clear (git re-check DI: zero touching commits ≥2026-11-05 in npc/quest/encounter/settlement/tv/routes paths) | rows as dated in folded history |

## Baseline Fingerprints (canonical test-campaign state at DI exit — verified 2026-11-07)

- change-data `{}` + log `[]` + combatSummary null — closed-tab clears, GET-verified twice, no rehydration.
- maps = the 4 owner fixtures all inactive (battle-arena md5 94fcd0bf untouched all session); sandbox `di-vt` created→used→DELETED.
- npcs [Marta Copperkettle]; 13 char files canonical — EvasiveFighter restored byte-exact (md5 0df29ff3 + API GET Fighter/Battle Master/18, backpack [Shortsword]). No registry additions; no monsters joined; no throwaways; campaigns/ = 5 baseline folders. Lock grep = own false-positive only.
- Bug files this run: 3 (`bug-devious-strikes-poison-repeat-save-never-fires.md`, `bug-devious-strikes-daze-never-expires.md`, `bug-poison-save-success-refund-regressed.md`).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- RESOLVED 2026-11-07 (repeat-save fix): the `saveAbility:"DEX"` alongside `saveType:"CON"` on Devious Strikes options is NOT a mislabel — `buildSaveDc` reads `saveAbility` as the DC-SOURCE ability and 2024 Cunning Strike DC = 8+PB+DEX by RAW for every option (live DC 15 matches). Do not flip it; the repeat-save repair uses it correctly as the DC source.
- 2026-11-07 DI chooser button-label inconsistency: rider choosers use `Apply Effects` (DS, plural), `Apply Effect` (Charge/Shield Bash, singular), confirm for VT is `Trip Secondary Target`, decline faces are `Cancel` vs `Skip (do not consume use)` — harmless to humans, a trap for every automation; consider one shared footer API in the `.sp-modal` family.

## Blocked / Not Verified (fold-gate ledger)

- CLOSED at DI 2026-11-07: 3-post-DH improve batch live-verified; DG's Shield-Bash Push leg + Skip face; DS cost-per-option live census; stroke once-per-rest face; DH PT2 expiry descent for Poison+Daze (produced 2 bugs).
- OPEN: fix-verify ×3 DI bug files; f4cca8f96 overlay dead-option live face; Obscure/blinded expiry audit (same family as daze); Knock Out repeat face post-fix; designer chat/plan/generate live-model faces (PT5).
- NOT VERIFIED this run (honest scope): poison-SUCCESS face flake sampling beyond 1× (refund filed on n=1 + 3 controls — fix-verify must re-sample); Trip-fail→prone expiry leg (persistent-prone is the documented standard); throwaway seeded/TV/delegation/allies lanes not re-entered (event-clear); audible YouTube audio (headless); Charge Push 10ft leg on APPLIED face (Skip/Push-Bash ridden, Charger's own Push row not applied).
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D; indoor overlay wand-drag; Lion "another Barbarian" exemption.
