---
layout: post.vto
title: "On LLM Writing Style: Em Dash Injection Experiment"
lang: en
---
<div class="post-content">

# On LLM Writing Style: Em Dash Injection Experiment

<div class="post-meta">
  <span>Posted: April 1, 2026 (Tue)</span>
  <span class="tag">LLM</span>
  <span class="tag">SFT</span>
  <span class="tag">Stylometry</span>
</div>
<p class="post-note">This article was written using a chatbot.<span class="lang-switch"> <a href="/poptones/posts/llm-emdash-injection/">Japanese</a></span></p>

## Previous findings

In the [previous article](/poptones/posts/en/llm-emdash-dpo/), eight experiments showed

- **"LLMs overuse em dashes" is an inaccurate generalization.** Em dash amplification was confirmed in Gemma3, but vanished in Llama3, and was near-zero in GPT-4o. No em dashes appeared in Japanese outputs across all models
- **No direct preference signal for em dashes exists in DPO chosen data.** Colons, bold, bullets, headings are significantly more frequent in chosen. Em dashes are a byproduct of the style register shift toward "structured explanatory prose"
- **Same DPO method, different results depending on training data.** Tulu 3 shows a V-curve for dashes (base→SFT→DPO), while Zephyr shows no change
- **Tokenizer hypothesis rejected.** Token entropy after em dashes is lower than after other punctuation

The conclusion was "em dash amplification is a byproduct." The next question: **if it's a byproduct, is the em dash inseparably coupled to other style elements, or is it independent?** This article answers through injection experiments.

## Experimental design

### Why injection

Suppression experiments cut correlations. Injection experiments create them. If structural markers increase following injection, that provides evidence of bidirectional coupling between em dashes and the style register.

### Model selection

Qwen2.5-1.5B-Instruct. Baseline em dash frequency is **exactly zero** (not a single occurrence in 50 generations). Zero noise makes for a clean intervention. 1.5B is feasible for CPU training.

### Why SFT instead of DPO

DPO was attempted first but failed. Accuracy was 28% (below the 50% random baseline). The cause was cross-model DPO: Tulu 3's outputs are not "natural" token sequences for Qwen2.5, so both chosen and rejected are equally far from the reference model, drowning log-prob ratio differences in noise. SFT uses simple next-token prediction and avoids this problem.

### Training configuration

- Base model: Qwen/Qwen2.5-1.5B-Instruct
- Method: SFT + LoRA (r=32, alpha=64)
- Targets: q/k/v/o_proj + gate/up/down_proj
- Data: 200 samples, 5 epochs, learning rate 2e-5
- Hardware: AMD Ryzen AI Max+ 395, 128GB RAM, CPU training

## Experiment 1: SFT on Tulu 3 data

Generated responses from Tulu 3 (8B, DPO-trained). Collected 200 responses containing 2+ em dashes as SFT data.

### Results

| Marker | Baseline | SFT (Tulu 3) | p-value |
|---|---|---|---|
| **em dash** | 0.000 | 7.397 | **6.4e-14 \*\*\*** |
| **colon** | 3.603 | 5.664 | **1.4e-4 \*\*\*** |
| **semicolon** | 0.238 | 2.185 | **2.6e-5 \*\*\*** |
| bold | 0.490 | 1.102 | 0.19 n.s. |
| bullet | 0.000 | 0.080 | 0.33 n.s. |
| heading | 0.000 | 0.086 | 0.33 n.s. |

All values per 1,000 words. Mann-Whitney U test (two-sided). N=50.

Em dashes, colons, and semicolons all increased significantly. Bullets, headings, and bold did not change.

This appears to show em dashes coupled with a "punctuation sub-register." But the data contains Tulu 3's entire writing style, not just em dashes. Whether colons/semicolons increased due to internal coupling or because the model learned Tulu 3's overall style is ambiguous.

The em dash-colon correlation in training data was -0.19 (no co-occurrence), but this is token-frequency-level. "Tulu 3-like text tends to use more colons and semicolons" as a style-level co-occurrence cannot be ruled out by correlation analysis alone.

## Experiment 2: Self-injection SFT

To eliminate the confound, **em dashes were mechanically injected into Qwen2.5-1.5B's own outputs** for SFT.

Procedure

1. Generate responses from Qwen2.5-1.5B-Instruct
2. Mechanically replace comma-delimited insertions (", which", ", including", ", however," etc.) with em dashes
3. Collect 200 responses with 2+ injected em dashes
4. SFT with identical LoRA settings, 5 epochs

Critical control: colon and semicolon frequencies are unchanged by the substitution (colon/1k: 12.67→12.52, semicolon/1k: 0.05→0.05). The **only** manipulation is em dashes.

### Results

| Marker | Baseline | SFT (Tulu 3) | SFT (self-injection) |
|---|---|---|---|
| **em dash** | 0.000 | 7.397 \*\*\* | **12.467 \*\*\*** |
| **colon** | 3.603 | **5.664 \*\*\*** | 2.917 n.s. |
| **semicolon** | 0.238 | **2.185 \*\*\*** | 0.231 n.s. |
| bold | 0.490 | 1.102 n.s. | 0.895 n.s. |
| bullet | 0.000 | 0.080 n.s. | 0.158 n.s. |
| heading | 0.000 | 0.086 n.s. | 0.000 n.s. |

**With self-injection SFT, only em dashes increased** (0→12.5/1k, p=3.3e-20). Colons and semicolons did not change at all.

## Interpretation

### Em dashes are independent from other punctuation

When only em dashes are manipulated, colons and semicolons do not follow.

The colon/semicolon increase in experiment 1 was the model learning Tulu 3's overall style, not internal coupling with em dashes.

### The byproduct hypothesis still holds

Em dash amplification being a byproduct (not a direct DPO preference) remains valid. No em dash preference signal exists in DPO chosen data.

What changed is understanding of the byproduct **mechanism**. Em dashes are not internally coupled to colons/semicolons. Each punctuation element independently accompanies a broader style shift. When DPO selects for a particular style, the individual elements in that style are each amplified separately.

### Lessons in experimental design

1. **Cross-model SFT confound**: Fine-tuning model B on model A's outputs injects model A's entire style. To isolate specific tokens, you must mechanically modify the model's own outputs
2. **Correlation analysis is insufficient**: Zero token co-occurrence in training data does not rule out style-level co-occurrence. Controlled intervention conditions are necessary

## Limitations

- **1.5B model only**: Reproduction on 8B requires GPU access
- **Naturalness of mechanical injection**: Comma→em dash substitution is grammatically natural but does not cover all human em dash usage patterns
- **Larger em dash amplification**: Self-injection (12.5/1k) produced stronger amplification than Tulu 3 SFT (7.4/1k), likely because on-distribution data trains more efficiently. Whether this difference in magnitude affects results cannot be fully excluded

## Reproduction

Scripts and raw data: [Flowers-of-Romance/llm-stylometry](https://github.com/Flowers-of-Romance/llm-stylometry)

```bash
# Experiment 1: Tulu 3 data SFT (requires tulu3 via Ollama)
python emdash_injection_dpo.py
python emdash_injection_sft.py --use_cpu --epochs 5

# Experiment 2: Self-injection SFT (~90 min CPU)
python emdash_injection_self_sft.py

# Evaluation
python emdash_injection_eval.py eval \
  --model Qwen/Qwen2.5-1.5B-Instruct --label baseline
python emdash_injection_eval.py eval \
  --model emdash_injection/models/sft --lora --label sft
python emdash_injection_eval.py eval \
  --model emdash_injection_self/models/sft_self --lora --label sft_self

# 3-condition comparison
python emdash_injection_eval.py compare \
  emdash_injection/eval_baseline.json \
  emdash_injection/eval_sft.json \
  emdash_injection/eval_sft_self.json
```

Environment: NucBox EVO-X2 (AMD Ryzen AI Max+ 395, 128GB RAM), WSL2 Ubuntu, PyTorch 2.5.1+rocm6.2 (CPU fallback)

</div>
