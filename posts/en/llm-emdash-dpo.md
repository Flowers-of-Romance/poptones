---
layout: post.vto
title: On LLM Writing Style, Revisited
lang: en
---
<div class="post-content">

# On LLM Writing Style, Revisited

<div class="post-meta">
  <span>Posted: March 29, 2026 (Sun) 20:18:47</span>
  <span class="tag">LLM</span>
  <span class="tag">DPO</span>
  <span class="tag">Stylometry</span>
</div>
<p class="post-note">This article was written using a chatbot.<span class="lang-switch"> <a href="/poptones/posts/llm-emdash-dpo/">Japanese</a></span></p>

There's a widely noted observation that LLM outputs contain abnormally high rates of em dashes (—) and colons (:). Is this tendency already present in the base model, or is it amplified during the SFT/DPO stage? I conducted base/instruct comparisons across three model families, controlled for prompt format confounds, isolated the SFT and DPO stages, tested the tokenizer hypothesis, performed separate analyses for Japanese and English, measured GPT-4o, and directly analyzed preference data.

Scripts and raw data: [Flowers-of-Romance/llm-stylometry](https://github.com/Flowers-of-Romance/llm-stylometry)

## Experimental Setup

### Models

All models were run via ollama.

**Experiments 1–3: Base vs. Instruct Comparison**

| Model | Type | Parameters | Quantization |
|--------|--------|-----------|--------|
| gemma3-27b-base | base | 27B | q4_k |
| gemma3:27b | instruct | 27B | q4_K_M |
| llama3-8b-base | base | 8B | Q4_K_M |
| llama3:latest | instruct | 8B | Q4_K_M |
| qwen3-8b-base | base | 8B | Q4_K_M |
| qwen3-nothink:latest | instruct | 8B | Q4_K_M |
| huihui_ai/qwen3.5-abliterated:27b | abliterated | 27B | Q4_K_M |

**Experiment 4: SFT/DPO Isolation (Tulu 3)**

| Model | Stage | Source | Quantization |
|--------|---------|--------|--------|
| Meta-Llama-3.1-8B | base | QuantFactory GGUF | Q4_K_M |
| Llama-3.1-Tulu-3-8B-SFT | SFT only | bartowski GGUF | Q4_K_M |
| tulu3 (8B) | DPO final | ollama official | Q4_K_M |

**Experiment 4b: SFT/DPO Isolation (Zephyr)**

| Stage | Model |
|---------|-------|
| base | Mistral-7B-v0.1 (TheBloke GGUF) |
| SFT | mistral-7b-sft-beta (HuggingFaceH4) |
| DPO | zephyr-7b-beta |

**Experiment 7: GPT-4o**

Via the OpenAI API (temperature=0.7, no system prompt).

### Prompts

10 English topics (AI, economics, climate change, quantum computing, education, privacy, space exploration, remote work, healthcare, social media) and 5 Japanese topics.

- **Base models**: Given the opening of a passage and asked to complete it (`raw=True`, no template applied)
- **Instruct models**: Given the same topics with the instruction "Write a short essay about..."
- **Raw completion control**: Instruct models were also prompted in the same format as base models (`raw=True`)

### Generation Settings

5 generations per prompt (N=50/model). 256 tokens (2048 for Qwen models), temperature=0.7, top_p=0.9.

### Metrics

- Em dash (U+2014) and en dash (U+2013). These are distinct Unicode characters, but in instruct model outputs both serve the same function as parenthetical delimiters, so they were counted together as "dash." Which one the model produces depends on its tokenizer's vocabulary
- Colon (:)
- Semicolon (;)
- Bullet points (lines starting with `-` or `*`)
- Markdown headings (lines starting with `#`)
- Bold text (`**...**`)

All metrics were normalized to frequency per 1,000 words (per 1k words).

## Experiment 1: Base vs. Instruct Comparison

### Results (English, per 1k words)

| Model | Type | N | Words | dash | colon | semicolon | bullet | heading | bold |
|--------|--------|--:|------:|-----:|------:|----------:|-------:|--------:|-----:|
| Gemma3 27B | base | 50 | 10346 | 0.2 | 2.4 | 0.0 | 1.2 | 0.0 | 0.0 |
| Gemma3 27B | instruct | 50 | 10119 | **6.4** | **5.8** | 2.0 | 0.0 | **4.9** | 1.3 |
| Llama3 8B | base | 50 | 10507 | 1.3 | 3.2 | 2.4 | 0.9 | 0.2 | 0.0 |
| Llama3 8B | instruct | 50 | 10724 | 0.0 | 1.2 | 0.3 | 0.0 | 0.0 | 0.0 |
| Qwen3 8B | base | 50 | 10607 | 1.0 | 3.0 | 0.8 | 0.2 | 4.4 | 0.8 |
| Qwen3 8B | instruct | 50 | 15982 | **4.3** | 0.5 | 0.2 | 3.9 | 0.0 | **5.6** |
| Qwen3.5 27B | abliterated | 50 | 23012 | 1.6 | 3.3 | 2.6 | 2.2 | 0.0 | 2.2 |

Base models show low dash frequency (0.2–1.3/1k words). The change after instruct tuning varies by model family:

- **Gemma3**: Dashes, colons, and headings all amplified across the board
- **Llama3**: Dashes vanish entirely; other markers also suppressed
- **Qwen3**: Dashes and bold amplified; headings and colons suppressed

Goedecke (2025) argues that the cause is high-quality training data rich in dashes (19th- to early 20th-century books), but the base models were trained on the same data and barely produce dashes at all. The presence of dashes in training data and the model's tendency to overuse them are separate issues—the amplification requires instruct tuning as an intermediary.

### Abliterated Model (Supplementary Comparison)

A Qwen3.5 abliterated model (with safety training direction vectors removed) was included as a supplementary comparison. Dashes measured 1.6/1k (close to Qwen3 base at 1.0/1k, well below the instruct version at 4.3/1k). Abliteration removes the safety RLHF direction, suggesting that the style RLHF direction remains intact. However, the abliterated model (Qwen3.5 27B) differs in parameter count from the base model (Qwen3 8B), so this is not a strict controlled comparison.

## Experiment 2: Statistical Testing

Mann-Whitney U tests were applied to the Experiment 1 data, with effect sizes (rank-biserial correlation) and bootstrap 95% confidence intervals.

| Family | Metric | base | instruct | p-value | Significance | Effect size r_rb |
|-----------|------|-----:|--------:|----:|:------:|:----------:|
| Gemma3 | dash_total | 0.25 | 6.40 | 7.4e-12 | *** | 0.689 |
| Gemma3 | colon | 2.85 | 5.87 | 6.4e-10 | *** | 0.696 |
| Gemma3 | markdown_heading | 0.00 | 4.95 | 3.2e-20 | *** | 1.000 |
| Gemma3 | semicolon | 0.00 | 1.98 | 1.8e-06 | *** | 0.380 |
| Gemma3 | bold | 0.00 | 1.30 | 4.3e-02 | * | 0.080 |
| Llama3 | dash_total | 1.26 | 0.00 | 4.9e-04 | *** | -0.220 |
| Llama3 | semicolon | 2.25 | 0.29 | 1.4e-03 | ** | -0.237 |
| Qwen3 | bullet | 0.19 | 26.80 | 2.9e-11 | *** | 0.611 |
| Qwen3 | bold | 0.89 | 12.76 | 1.7e-07 | *** | 0.482 |
| Qwen3 | dash_total | 1.04 | 2.16 | 2.6e-02 | * | 0.167 |
| Qwen3 | markdown_heading | 4.46 | 0.00 | 2.3e-25 | *** | -0.820 |
| Qwen3 | colon | 3.08 | 1.25 | 1.4e-05 | *** | -0.309 |

Gemma3's dash amplification is 25.4× (p=7.4e-12), highly significant. The most amplified markers in Qwen3 are not dashes but bullet points (141×, p=2.9e-11) and bold text (14.3×, p=1.7e-07). Llama3 shows significant decreases in both dashes and semicolons.

## Experiment 3: Controlling for Prompt Format Confounds

In Experiment 1, the prompt formats differ between base (completion) and instruct (instruction). To isolate whether the observed differences stem from instruct tuning or from prompt format, instruct models were also run with raw completion (no chat template, generating text continuations).

### Results (English, per 1k words, raw completion for both)

| Family | Metric | base | instruct(raw) | p-value | r_rb |
|-----------|------|-----:|-------------:|----:|-----:|
| **Gemma3** | bold | 0.00 | **25.52** | 2.3e-15 | 0.820 |
| | colon | 2.92 | **28.51** | 3.5e-11 | 0.722 |
| | bullet | 2.64 | **25.16** | 1.8e-12 | 0.755 |
| | dash_total | 0.00 | 0.81 | 4.3e-02 | 0.080 |
| **Llama3** | colon | 2.74 | **21.61** | 3.5e-12 | 0.782 |
| | bold | 0.10 | **7.06** | 2.9e-05 | 0.325 |
| | bullet | 0.00 | **3.25** | 2.5e-04 | 0.240 |
| | dash_total | 0.99 | **0.00** | 1.8e-03 | -0.180 |
| **Qwen3** | (all metrics) | -- | -- | n.s. | -- |

### Interpretation

**Gemma3**: Style markers are amplified by instruct tuning regardless of prompt format. This is not a confound—it is a genuine effect of instruct tuning itself.

**Llama3**: Under instruction format, it appeared to show "across-the-board suppression," but under raw completion, colons, bold, and bullet points are heavily amplified. Llama3 instruct produces natural prose when given instructions, but emits structural markers in text completion mode. The style suppression under instruction format was not an effect of instruct tuning, but a response pattern to the prompt format.

**Qwen3**: Under raw completion, no metric reaches significance. Qwen3's style changes are a response to instruction format, not an internal style shift within the model.

## Experiment 4: Isolating SFT and DPO (Tulu 3)

The base→instruct comparison alone cannot determine whether SFT or DPO drives the style change. Allen AI's Tulu 3 is built on Llama-3.1-8B, with all three checkpoints publicly available: base, SFT, and DPO.

### Results (English, per 1k words)

| Metric | base | SFT | DPO | SFT direction | DPO direction |
|------|-----:|----:|----:|:--------:|:--------:|
| dash_total | 1.82 | **0.38** | **2.47** | DOWN (p=0.002) | UP (p=0.0002) |
| em_dash | 0.18 | 0.38 | **1.73** | n.s. | UP (p=0.005) |
| colon | 3.68 | 5.29 | 6.45 | n.s. | n.s. |
| semicolon | 1.85 | **0.36** | 0.76 | DOWN (p=0.012) | n.s. |
| bullet | 0.00 | 0.00 | **1.67** | == | UP (p=0.012) |
| bold | 0.00 | 0.00 | **3.14** | == | UP (p=0.0005) |
| markdown_heading | 0.49 | 0.00 | 0.00 | n.s. | == |

```
dash_total   base --[SFT: DOWN]--> SFT --[DPO: UP]--> DPO
em_dash      base --[SFT:    ~]--> SFT --[DPO: UP]--> DPO
bold         base --[SFT:   ==]--> SFT --[DPO: UP]--> DPO
bullet       base --[SFT:   ==]--> SFT --[DPO: UP]--> DPO
semicolon    base --[SFT: DOWN]--> SFT --[DPO:  ~]--> DPO
```

Dashes follow a V-shaped curve. SFT reduces them from 1.82 to 0.38, then DPO spikes them back up to 2.47. Bold and bullet points remain at zero through SFT and only emerge during DPO. SFT suppresses style; DPO amplifies it.

This is consistent with reward hacking—the phenomenon where the reward model optimizes not for what it was meant to measure (response quality) but for a proxy signal (formatting that looks intelligent). The DPO reward model learns from human evaluator preferences, and structured responses (headings, bold, bullet points) are easily judged as "well-organized" at a glance. This visual bias gets absorbed into the reward model and injected into the model's style through DPO.

## Experiment 4b: Replication with Zephyr (SFT/DPO Isolation)

Tulu 3 alone is insufficient for generalization. The same three-stage comparison was performed with Zephyr (Mistral-7B-based).

### Results (English, per 1k words)

| Metric | base | SFT | DPO | SFT direction | DPO direction |
|------|-----:|----:|----:|:--------:|:--------:|
| dash_total | 1.3 | **0.0** | 0.0 | DOWN (p=9.5e-04) | == |
| colon | 3.7 | **0.5** | 0.5 | DOWN (p=6.6e-06) | n.s. |
| bullet | 2.3 | **0.0** | 0.0 | DOWN (p=6.5e-03) | == |
| heading | 4.5 | **0.0** | 0.0 | DOWN (p=7.2e-11) | == |
| bold | 0.1 | 0.0 | 0.0 | n.s. | == |

```
dash_total       base --[SFT: DOWN]--> SFT --[DPO:   ==]--> DPO
colon            base --[SFT: DOWN]--> SFT --[DPO:    ~]--> DPO
bullet           base --[SFT: DOWN]--> SFT --[DPO:   ==]--> DPO
heading          base --[SFT: DOWN]--> SFT --[DPO:   ==]--> DPO
```

In Zephyr, SFT suppresses all markers, and DPO changes nothing. The exact opposite of Tulu 3.

| | Tulu 3 | Zephyr |
|---|---|---|
| SFT | Partial suppression | **Full suppression** |
| DPO | **Amplification** | No change |

The effect of DPO depends not on the technique itself, but on the content of the DPO training data (directly verified in Experiment 8).

## Experiment 5: Testing the Tokenizer Hypothesis

There's a hypothesis that "any token can follow an em dash, making it a convenient junction point for the model." If true, the entropy of the token distribution immediately following an em dash should be higher than for other punctuation marks.

### Method

Five punctuation marks (em dash, colon, semicolon, period, comma) were inserted into 30 contexts, and the top-20 logprobs for the next token were retrieved via ollama's OpenAI-compatible API. Shannon entropy was calculated with the residual probability added as one bin. 150 samples per base model (Qwen3-8B, Gemma3-27B, Llama3-8B), 450 samples total.

### Results (1 token)

| Comparison | Entropy difference | p-value | Direction |
|------|:-----------:|----:|:----:|
| em_dash vs period | **-0.160** | 0.002 | em dash is **lower** |
| em_dash vs semicolon | **-0.114** | 0.029 | em dash is **lower** |
| em_dash vs colon | -0.065 | 0.21 | Not significant |
| em_dash vs comma | -0.085 | 0.18 | Not significant |

### Results (up to 5 tokens ahead)

| Position | em_dash vs period | em_dash vs semicolon |
|---|---|---|
| pos0 (immediately after) | **-0.196** (p=0.005) | -0.130 (n.s.) |
| pos1 (2nd token) | +0.044 (p=0.04) | **+0.540** (p=0.0005) |
| pos2 (3rd token) | n.s. | n.s. |
| pos3 (4th token) | **-0.369** (p=0.04) | **-0.660** (p=0.003) |
| pos4 (5th token) | n.s. | n.s. |

The results are the opposite of what the hypothesis predicts. Entropy immediately after em dash (pos0) is lower. It rises briefly at the 2nd token, then drops again at the 4th. The token sequences following an em dash converge on a limited set of patterns (beginning of a parenthetical, rephrasing, specific examples). The "convenient junction point where anything can follow" hypothesis holds neither at the single-token nor multi-token level.

## Experiment 6: Separating Japanese and English

### Method

Word counts for Japanese data (225 samples) were recalculated using MeCab morphological analysis (fugashi + unidic-lite), normalized to per 1k morphemes.

### Results

In the models tested (Gemma3/Llama3/Qwen3, 8B–27B), em dash / en dash counts in Japanese output were zero across all models and all stages.

To rule out measurement gaps, all Unicode dash-like characters appearing in Japanese instruct output were surveyed:

| Character | Unicode | Occurrences in Japanese instruct output |
|------|---------|---------------------------:|
| ー (katakana prolonged sound mark) | U+30FC | 478 |
| - (HYPHEN-MINUS) | U+002D | 223 |
| ― (HORIZONTAL BAR) | U+2015 | 2 |
| — (EM DASH) | U+2014 | 0 |
| – (EN DASH) | U+2013 | 0 |

Counts are summed across all models' Japanese instruct outputs (75 samples). Em dash/en dash are zero—in Japanese output, models use the prolonged sound mark "ー" and hyphen "-" instead. These belong to a different character system from the em dashes used by English instruct models. The "insert em dashes as parenthetical delimiters" pattern learned through English DPO does not transfer to Japanese output.

Do these dash-like characters themselves get amplified by instruct tuning? Base vs. instruct comparison in per 1k morphemes:

| Family | Character | base | instruct | p-value | Direction |
|-----------|------|-----:|--------:|----:|:----:|
| Gemma3 | ー | 23.5 | 20.5 | 0.82 | n.s. |
| Llama3 | ー | 15.7 | **0.0** | 7.6e-06 | DOWN |
| Llama3 | - | 2.9 | **14.9** | 3.2e-07 | UP |
| Qwen3 | ー | 11.2 | 28.9 | 0.73 | n.s. |

The prolonged sound mark "ー" is not uniformly amplified by instruct tuning. Gemma3 shows virtually no change, and Qwen3 shows no significance due to sample size issues (the instruct side had only 874 total morphemes).

Llama3 is the outlier: the prolonged sound mark vanishes entirely (15.7→0.0, p=7.6e-06), while the hyphen "-" jumps 5× (2.9→14.9, p=3.2e-07). Instruct tuning is replacing Japanese prolonged sound marks with ASCII hyphens. This may be an effect of English-centric instruct tuning data pulling Japanese character usage toward ASCII.

That said, it is known that large-scale API models like ChatGPT (GPT-4o) and Claude do produce dashes in Japanese output, possibly due to differences in model size and language distribution in RLHF training data.

Markers significantly amplified by instruct tuning in Japanese:

| Family | Amplified | Suppressed |
|-----------|--------------|--------------|
| Gemma3 | colon (p=2.9e-04), heading (p=1.1e-06) | -- |
| Llama3 | colon (p=1.3e-05) | bullet (p=0.004), heading (p=3.9e-07) |
| Qwen3 | bullet (p=4.3e-05), bold (p=3.3e-04) | heading (p=0.046) |

In Japanese, models use colons and bold instead of dashes. The specific markers of "LLM-ness" vary by language, but the underlying tendency to inject structural markers is universal.

## Experiment 7: GPT-4o

The strongest source of the "dash overuse" impression is ChatGPT (GPT-4 series). Results from local models alone are insufficient.

### Results (per 1k words)

| Language | N | Words | dash_total | em_dash | colon | semicolon | bullet | heading | bold |
|------|--:|------:|-----------:|--------:|------:|----------:|-------:|--------:|-----:|
| en | 50 | 21321 | 0.2 | 0.2 | 0.1 | 0.0 | 0.0 | 0.0 | 0.0 |
| ja | 25 | 9392 (morphemes) | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |

Japanese word count was calculated using MeCab morphological analysis (fugashi + unidic-lite), normalized to per 1k morphemes.

GPT-4o (API, temperature=0.7, no system prompt) scores near zero on all metrics. Em dashes appeared in only 5 of 50 samples (0.2/1k words)—1/28th of Gemma3 instruct (6.4/1k).

This contradicts the conventional wisdom that "GPT-4o overuses dashes." Possible explanations:

1. **System prompt effects**: ChatGPT's web UI silently injects a system prompt. If it includes instructions like "structure your response" or "be clear," this could elicit dashes and formatting markers. This experiment's API calls included no system prompt
2. **Model version updates**: Sam Altman acknowledged that "users liked em dashes, so we increased them, then they became too frequent," and the model may have since been tuned to reduce dashes. The version behind the conventional wisdom may differ from the version tested here
3. **Claude untested**: Chambers (2026) reports em dash rates of 1.0–1.3/100 words for Claude Haiku/Sonnet/Opus 4.5+. This experiment did not include Claude, so these results cannot be generalized to all API models

None of these explanations have been verified, so I will simply report the fact: "GPT-4o via API produces virtually no dashes."

## Experiment 8: Direct Analysis of DPO Preference Data

Experiment 4 showed "DPO amplifies"; Experiment 4b showed "Zephyr does not amplify." To determine whether this difference stems from the content of the DPO training data, the preference data was analyzed directly.

### Datasets

| Dataset | Use | Samples analyzed |
|---|---|---|
| UltraFeedback Binarized | Zephyr DPO data | 10,000 |
| Tulu 3 Preference Mixture | Tulu 3 DPO data | 10,000 |

Formatting marker frequencies were compared between chosen (preferred responses) and rejected (rejected responses). Wilcoxon signed-rank test (paired).

### Results

**UltraFeedback (Zephyr DPO data)**

| Marker | chosen | rejected | Difference | p-value |
|---|---|---|---|---|
| colon | 25.55 | 22.26 | **+3.29** | 1.9e-24 *** |
| bullet | 3.59 | 3.15 | **+0.43** | 3.5e-03 ** |
| bold | 0.64 | 0.49 | **+0.14** | 5.8e-03 ** |
| dash_total | 0.13 | 0.11 | +0.02 | 1.6e-04 *** |
| em_dash | 0.03 | 0.03 | 0.00 | n.s. |

**Tulu 3 Preference Mixture**

| Marker | chosen | rejected | Difference | p-value |
|---|---|---|---|---|
| bold | 6.26 | 4.25 | **+2.01** | 1.9e-43 *** |
| colon | 32.96 | 31.54 | **+1.41** | 7.6e-16 *** |
| heading | 1.01 | 0.78 | **+0.23** | 1.1e-13 *** |
| bullet | 15.09 | 14.95 | +0.14 | 2.2e-20 *** |
| em_dash | 0.26 | 0.56 | **-0.29** | n.s. (rejected>) |

Across both datasets, **bold, colons, bullet points, and headings** are consistently more frequent in chosen responses. However, **em dashes are not more frequent in chosen responses**. In Tulu 3, they actually trend higher in rejected responses.

Dash amplification is not a direct preference in the DPO data. DPO does not select for individual tokens but shifts the entire output distribution toward the chosen direction. The bold, bullet points, and headings that are more frequent in chosen responses constitute a "structured expository style," and em dashes are elements that naturally co-occur within that style. Even though the data shows no direct preference for em dashes themselves, they get amplified as a byproduct of the overall style shift. This should be understood not as a preference for individual formatting markers, but as a shift in stylistic register.

This interpretation is also consistent with the difference between Tulu 3 and Zephyr. In Tulu 3's preference data, the formatting gap between chosen and rejected is large (bold +2.01, colon +1.41), and the DPO distribution shift moves the entire stylistic register significantly—dragging em dashes along with it. In UltraFeedback (Zephyr), the formatting gap is smaller (bold +0.14, colon +3.29), so the distribution shift is weaker. Zephyr's lack of dash amplification is because the magnitude of stylistic register shift was smaller.

## Integrated Interpretation

### 1. "LLMs overuse em dashes" is inaccurate

Em dash amplification was confirmed in Gemma3 (25.4×, p=7.4e-12), but Llama3 showed the opposite (dashes vanished), and GPT-4o was near zero (0.2/1k words). In Japanese, all models scored zero. Qwen3 appeared to show 2.1× amplification (p=0.026) under instruction format, but the raw completion control (Experiment 3) yielded no significant differences on any metric—the change was a response pattern to instruction format, not an internal style shift. Only Gemma3 and Llama3 show internal style changes from instruct tuning (confirmed via raw completion amplification), meaning one of three models drops out.

### 2. The cause of style amplification is the content of DPO data

In Tulu 3, DPO amplified formatting markers; in Zephyr, it changed nothing (Experiments 4, 4b). The same DPO technique produces opposite results. Direct analysis of preference data shows that bold, colons, bullet points, and headings are significantly more frequent in chosen responses in both datasets, but the formatting gap between chosen and rejected is larger in Tulu 3, which determines whether amplification occurs at the DPO stage (Experiment 8).

Em dashes are not more frequent in chosen responses (in Tulu 3, they actually trend higher in rejected responses). Dash amplification is not a direct preference in the data but a byproduct of DPO shifting the entire stylistic register toward "structured expository prose" (Experiment 8).

### 3. Tokenizers are irrelevant

Entropy immediately following em dashes is lower than for other punctuation marks (Experiment 5). Em dash overuse stems not from token-space structure but from human evaluator preferences amplified through DPO.

### 4. Relationship to sycophancy

GPT-4o's April 2025 update incorporated user feedback (thumbs up/down) as a reward signal, leading to reported amplification of sycophancy (excessive agreement) (OpenAI, 2025). The formatting marker amplification observed in this study is a different manifestation of the same mechanism. Sycophancy is content-level reward hacking (returning answers users like); formatting marker amplification is form-level reward hacking (returning the appearance users like).

### 5. Prompt format can reverse conclusions

The raw completion control (Experiment 3) requires revising per-model style characterizations:

| Metric | Gemma3 | Llama3 (instruction) | Llama3 (raw) | Qwen3 (instruction) | Qwen3 (raw) |
|------|--------|------------|----------------|-----------|---------------|
| Dash | Slight increase | Suppressed | Suppressed | Amplified | n.s. |
| Colon | Amplified | Suppressed | **Amplified** | Suppressed | n.s. |
| Bold | Amplified | No change | **Amplified** | Amplified | n.s. |
| Bullet | Amplified | No change | **Amplified** | Amplified | n.s. |

Llama3 appears to produce "natural prose" under instruction format, but under raw completion it amplifies colons, bold, and bullet points just like Gemma3. The prompt response pattern of "write prosaic text when given instructions" was merely masking the style. Qwen3's amplification is a response to instruction format, not an internal style change.

It is dangerous to discuss the effects of instruct tuning without controlling for prompt format, and most prior work (including Chambers, 2026; Goedecke, 2025) does not account for this confound.

### 6. Contrast with dashes in literature

In literature, several writers are known for heavy dash use. Emily Dickinson used dashes in place of nearly all punctuation, expressing interruptions and leaps of thought. Céline used chains of ellipses and dashes to convey the breathlessness of narration. Burroughs used dashes as splice points in his cut-up technique.

What these writers share is that their dashes work toward *breaking fluency*. Instruct models use dashes in the opposite direction—smoothly connecting parenthetical clauses, serving as ornamentation that adds an air of "intellectual depth" to sentences. The same symbol, used for diametrically opposite purposes.

## Limitations

- Prompt formats differ between base and instruct (completion vs. instruction). The raw completion control (Experiment 3) partially addresses this but is not complete
- The effect of quantization (Q4_K_M) has not been tested
- Some base/instruct pairs within the same family differ in parameter count (Qwen3 8B base vs. Qwen3.5 27B abliterated)
- SFT/DPO isolation was performed on only two families: Tulu 3 and Zephyr. Verification with Gemma3 or Qwen3 has not been done
- The tokenizer hypothesis test is an approximation based on top-20 logprobs. Full vocabulary entropy distribution is not available via ollama
- GPT-4o was tested via API, which differs from ChatGPT's web UI conditions. The web UI injects a system prompt, and model versions are frequently updated. The version behind the conventional wisdom that "GPT-4o overuses dashes" may differ from the version tested here. Claude was not tested
- Japanese results are limited to local models (8B–27B). Large-scale API models (GPT-4o, Claude) are known to produce dashes in Japanese output, possibly due to differences in model size and language distribution in RLHF training data

## Experimental Environment

- Machine: NucBox EVO-X2 (AMD Ryzen AI Max+ 395, 128GB RAM, Radeon 8060S iGPU)
- Inference: via ollama (all layers on GPU using iGPU shared memory)
- GPT-4o: via OpenAI API
- Dates: March 21–29, 2026

## References

- Chambers, Mike. "[Dash It All! Is AI Em Dash Addiction Real?](https://dev.to/aws/dash-it-all-is-ai-em-dash-addiction-real-40bh)" DEV Community, 2026.
- Goedecke, Sean. "[Why do AI models use so many em-dashes?](https://www.seangoedecke.com/em-dashes/)" 2025.
- OpenAI. "[Expanding on what we missed with sycophancy.](https://openai.com/index/expanding-on-sycophancy/)" 2025.
## Glossary: LLM Formatting Marker Amplification Experiments

### Models and Training

| Term | Meaning |
|------|------|
| **LLM** | Large Language Model. A model trained on massive amounts of text to predict the next token. The engine behind ChatGPT and Claude |
| **Base model** | A model trained only to "predict the next token." It cannot answer questions—it merely continues the input text |
| **Instruct model** | A base model further trained with SFT and RLHF/DPO to learn the behavior of "answering when asked a question" |
| **SFT** | Supervised Fine-Tuning. Additional training of a model on human-created "question→answer" pairs. The first stage of instruct tuning |
| **RLHF** | Reinforcement Learning from Human Feedback. Humans compare outputs, and the model is optimized in the direction judged "better" |
| **DPO** | Direct Preference Optimization. An alternative to RLHF that optimizes the model directly from human preference data without an intermediate reward model. Used in Tulu 3 and Zephyr |
| **Instruct tuning** | The collective term for SFT + RLHF/DPO. The process that turns a base model into a "usable" model |
| **Abliteration** | A technique that removes only the safety filter (refusal) direction vector from an instruct model. Does not affect style |

### Rewards and Optimization

| Term | Meaning |
|------|------|
| **Reward model** | A model that scores outputs as "good/bad." Used in RLHF. It has learned from human annotator judgments |
| **Reward hacking** | When the reward model optimizes not for what it was meant to measure (response quality) but for a proxy signal (formatting that looks intelligent) |
| **Sycophancy** | Excessive agreement. The tendency to return answers the user wants to hear. Content-level reward hacking |
| **Preference data** | The paired data of "chosen (preferred response)" and "rejected (rejected response)" used in DPO training |
| **Chosen / Rejected** | The two responses in preference data. A human judged the chosen response as "better" |

### Measurement and Statistics

| Term | Meaning |
|------|------|
| **per 1k words** | Frequency per 1,000 words. A unit for normalizing across different text lengths |
| **Mann-Whitney U test** | A nonparametric test comparing the distributions of two groups. Does not assume normal distribution |
| **Wilcoxon signed-rank test** | A nonparametric test comparing two paired groups. Used for comparing chosen/rejected pairs |
| **p-value** | "The probability this difference occurred by chance." p < 0.05 means statistically significant (less than 5% chance of being random). p = 7.4e-12 means "0.00000000074% chance of being random" |
| **Effect size (r_rb)** | Rank-biserial correlation. Measures the magnitude of the difference. The p-value tells you "whether a difference exists"; effect size tells you "how large the difference is" |
| **Bootstrap confidence interval** | A method of estimating the range of a statistic by repeatedly resampling from the data. A 95% CI means "there is a 95% probability the true value falls within this range" |
| **Entropy** | A concept from information theory. Measures the "spread" of a probability distribution. Higher means harder to predict (diverse tokens likely), lower means easier to predict (concentrated on a few tokens) |
| **Logprobs** | The log-probability of each token. Raw data showing how the model predicts "which token comes next" |

### Punctuation

| Term | Character | Unicode | Meaning |
|------|------|---------|------|
| **Em dash** | — | U+2014 | Long dash. The width of the letter "m." Used as a parenthetical delimiter. The character LLMs are said to overuse |
| **En dash** | – | U+2013 | Short dash. The width of the letter "n." Properly used for ranges (1990–2000), but in LLM output sometimes used with the same function as an em dash |
| **HORIZONTAL BAR** | ― | U+2015 | A conventional Japanese dash. Typically doubled as "――" |
| **Katakana prolonged sound mark** | ー | U+30FC | Japanese vowel lengthener. The "ー" in "コーヒー" (coffee). A different character from a dash, though visually similar |

### Model Names

| Name | What it is |
|------|------|
| **Gemma 3** | Google's open model. This study used the 27B parameter version |
| **Llama 3** | Meta's open model. This study used the 8B parameter version. Known for not using dashes |
| **Qwen3** | Alibaba's open model. Chinese/English base. This study used the 8B parameter version |
| **Tulu 3** | An Allen AI project. Built on Llama 3.1, it publishes all three checkpoints: base→SFT→DPO. Used in this study for SFT/DPO isolation |
| **Zephyr** | A HuggingFace H4 project. Built on Mistral-7B, also publishing three-stage checkpoints. Used as a counterpoint to Tulu 3 |
| **GPT-4o** | OpenAI's model. The engine behind ChatGPT. Considered the prime culprit for "dash overuse," yet showed near-zero dashes via API |

### Tools and Environment

| Term | Meaning |
|------|------|
| **ollama** | A tool for running LLMs locally. All local models in this study were run via ollama |
| **GGUF** | A quantized file format for LLMs. Can be loaded by ollama |
| **Q4_K_M** | A type of 4-bit quantization. Compresses model size by roughly 4×, allowing it to run with less memory |
| **raw=True** | An ollama parameter. Passes text directly as input without applying a chat template. Used for base model completion generation |
| **MeCab** | A Japanese morphological analyzer. Splits sentences into words (morphemes). Used for Japanese word counts |
| **Temperature** | A parameter controlling generation randomness. Higher values produce more diverse output; lower values produce more deterministic output. This study used 0.7 |
</div>
