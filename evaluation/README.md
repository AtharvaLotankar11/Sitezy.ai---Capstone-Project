# Evaluation scripts

These scripts produce every number reported in the Sitezy paper. Each one runs the
deployed code (the `ai_engine/` models, the production generation prompt, the
production routing paths) rather than a re-implementation, and prints or writes JSON.

## Requirements

- Python 3.11+ with the `ai_engine/requirements.txt` packages plus `scipy`.
- Node.js 20+ with `backend/` dependencies installed (`npm install` in `backend/`).
- For generation experiments: a running Ollama server with `qwen3.5:4b` pulled.
- `backend/.env` for the scripts that call Gemini or read MongoDB (see below).

## Trained engines (CPU, no network)

Five seeds each; training and test sets are generated with disjoint seeds.

| Script | Paper | Output |
|---|---|---|
| `python seo_eval.py out/seo.json` | SEO scorer vs. baselines | R², MAE, RMSE, latency per model and seed |
| `python gru_eval.py out/gru.json` | Conversion models | AUC/F1/accuracy/Brier vs. LSTM, pooled baselines, deployed rule fallback, Bayes ceiling; counterfactual Δp on the 16 templates |
| `python design_eval.py out/design.json` | Design auditor | Section-level flaw injection into the 16 templates; AE, IF, AE+IF, rubric, union; per-category recall |
| `python reco_eval.py out/reco.json` | Block recommender | Zero-shot business-type accuracy (neutral vs. entailment index), McNemar, Wilson CIs, RF selection change, latency |
| `python latency_eval.py out/latency.json` | Tier-1 latency | Median/p90 of each deployed request path |

## Generation tier (GPU)

1. `python extract_prompt_template.py` — regenerates `prompt_template.txt` from the
   production `generateLayout` prompt (LF line endings; identical after `.trim()`).
2. `node decoding_exp.mjs out/decoding_results.jsonl [deadline_ms]` — paired 4-way
   decoding ablation (20 businesses × {reasoning on/off} × {JSON grammar on/off}) on
   `qwen3.5:4b` with the production options. Resumable: re-run until all 80 rows exist.
   Raw outputs go to `out/decoding_results_raw/`.
3. `node gemini_baseline.mjs out/gemini_results.jsonl` — the same 20 prompts through the
   production cloud path (`gemini-3-flash-preview`). **Uses `GEMINI_API_KEY` and incurs
   API cost** (about $0.014 per site at list price). Raw outputs go to
   `out/gemini_results_raw/`. Rows that failed on transport can be deleted and re-run.
4. `python decoding_summary.py out` — reads the two files above and reports Wilson CIs,
   exact McNemar tests, medians, and the local-vs-cloud speed and cost figures (GPU power
   60 W measured with `nvidia-smi`; electricity $0.12/kWh assumed).
5. `python rewrite_exp.py out/decoding_results_raw out/rewrite_results.jsonl` — the gated SEO
   rewrite loop on the generated pages, with the deployed scorer and `qwen3.5:4b`.
   Summarise with `python rewrite_summary.py out/rewrite_results.jsonl out/rewrite_summary.json`.
6. `python forms_eval.py out/decoding_results_raw "*_D_both.txt" out/forms_local.json` and
   `python forms_eval.py out/gemini_results_raw "*_gemini.txt" out/forms_gemini.json` —
   form-schema conformance per field type, after the same normalisation the production
   post-processing applies (keys renamed, defaults filled, no fields added).

## End-to-end ablation (GPU)

Run from `evaluation/` after steps 1–5 above, with all outputs in `out/`:

7. `node make_fallbacks.mjs out` — for every business whose reasoning-on generation failed
   validation, evaluates the production `buildFallbackLayout` (verbatim source) so the
   "reasoning enabled" arm uses exactly what production would serve.
8. `python e2e_ablation.py [deadline_s]` — runs the production SEO loop on the same 20
   sites with one factor changed per arm (reasoning mode, acceptance gate, rule scorer,
   cloud generation). Resumable; re-run until all arms report done.
9. `python ablation_summary.py` — table rows (final rubric score, regressed pages, time and
   cost per site) for the full system and every arm.

   New arms: `full_rerun` (independent re-run of the deployed configuration) and
   `llm_scorer` (the scoring/gating step routed to `qwen3.5:4b` instead of the Tier-1 model).
   `python e2e_ablation.py 1500 full_rerun,llm_scorer` runs only those arms.

## Repeated runs and form repair (GPU)

- `node decoding_exp.mjs out/decoding_rep2.jsonl 1560000 D_both,C_formatjson` — second
  independent run of the deployed and reasoning-with-grammar configurations (the fourth
  argument restricts the configurations). Run with the laptop on mains power: on battery the
  GPU is power-limited and latencies are not comparable.
- `node form_repair_eval.mjs out out/decoding_results_raw out/decoding_rep2_raw` — applies the
  production form validation and targeted regeneration (`backend/src/modules/ai/formRepair.js`)
  to every site generated with the deployed configuration, with the same local-model call as
  `generateLayout`; reports forms filled before/after, regenerated vs. defaulted, and latency.
  For the ablation arms run it on the other site sets as well:
  `FR_SUFFIX=_C.txt FR_OUT=form_repair_C.json node form_repair_eval.mjs out out/ablation_C_sites` and
  `FR_SUFFIX=_gemini.txt FR_OUT=form_repair_gemini.json node form_repair_eval.mjs out out/gemini_results_raw`.
- `ablation_summary.py` (step 9) reads both decoding runs, both cloud runs
  (`out/gemini_rep2.jsonl`, produced by `node gemini_baseline.mjs out/gemini_rep2.jsonl`) and the
  three form-repair outputs above, so run it last.

## Deployment pipeline and tenant isolation (no GPU)

Both need `npm install mongodb-memory-server@10` in `evaluation/` (downloads a MongoDB
binary of about 600 MB on first use). Neither touches MongoDB Atlas.

- `node deploy_eval.mjs out` — runs the agentic pipeline against the Firebase project in
  `backend/.env` under fresh random tenant IDs: 20 natural deploys, 42 fault-injection runs
  (7 error classes × transient/persistent × 3), and a circuit-breaker run. Deployment logs go
  to an in-memory database; all Firestore data under the test tenants is recursively deleted at
  the end and the deletion is verified. Use a test project.
- `node isolation_test.mjs out` — starts `backend/src/server.js` on an in-memory database,
  registers two tenants through the API, and attacks every authenticated route that takes a
  resource identifier with the other tenant's identifiers; also token tampering, role-claim
  forgery, intra-tenant RBAC, body `tenantId` injection, list leakage and draft exposure, with
  positive controls. Functional authorisation tests, not a penetration test. Payment and
  LLM-generation routes are excluded. `node iso_fs_cleanup.mjs` removes any page-view counters
  the public-site check left in Firestore (test tenant slugs only).

## Real tenant pages (read-only)

10. `node fetch_real_pages.mjs | python real_sites.py static` and
    `node fetch_real_pages.mjs | python real_sites.py loop [deadline_s]` — evaluate every
    published page. Page content is streamed through the pipe and kept in memory only;
    the output files contain numeric metrics and generic flaw codes, never page text.

## Field statistics (read-only)

`node db_stats.mjs`, `node db_monthly.mjs`, `node db_deploys.mjs`, `node db_pagecounts.mjs` compute aggregate
counts, rates and durations from MongoDB using `MONGO_URI`. They issue only `find`,
`aggregate`, `distinct` and `count` operations, never print the connection string, and
never read prompt or response content.
