---
layout: post.vto
title: "Reproducing the Gemini 'Kyo' Bug with Gemma 4 — Tokenizer, Embedding, and Attention Sink Measurements"
lang: en
---
<div class="post-content">

# Reproducing the Gemini "Kyo" Bug with Gemma 4 — Tokenizer, Embedding, and Attention Sink Measurements

<div class="post-meta">
  <span>Posted: April 7, 2026 (Tue)</span>
  <span class="tag">Gemini</span>
  <span class="tag">Gemma</span>
  <span class="tag">Tokenizer</span>
  <span class="tag">Attention</span>
  <span class="tag">LLM</span>
</div>
<p class="post-note">This article was written using a chatbot.<span class="lang-switch"> <a href="/poptones/posts/gemini-kyo-analysis/">Japanese</a></span></p>

## What is happening

Since early March 2026, reports have been circulating on social media about a phenomenon where Gemini goes haywire when made to repeatedly output the kanji character 拠.

The phenomenon has two patterns.

**Spontaneous firing.** In the middle of a conversation, Gemini tries to output something like "that is evidence (証拠)" and suddenly starts repeating: "証拠拠拠拠拠拠...," producing a massive string of 拠 before abruptly emitting completely unrelated text. The user never asked for repetition.

**Intentional reproduction.** The repetition of 拠 is explicitly requested. After several thousand characters of 拠, text formatted like web articles appears — investment fraud testimonials, government documents, and the like — output verbatim.

This article quantitatively verifies the mechanism behind this phenomenon using the actual weights of Gemma 4 (Google's open model).

## Why does repeating the same character cause a breakdown

LLMs predict which token is most likely to come next given the preceding context. After "today the weather is," "nice" is likely because the training data contains that context in abundance.

The input "拠拠拠拠拠拠拠拠..." does not exist in the training data. The model has never seen such a string. But it must produce some output.

Two things happen simultaneously.

Internal representations collapse. In normal text, tokens at each position carry different information (subject, verb, object...). But when the same character appears 50 times in a row, hidden states at every position become nearly identical vectors (cos sim > 0.97 in our measurements). Attention also concentrates 85% on the first token (attention sink). Inside the model, contextual information has dropped to zero.

Yet the model keeps predicting "the same character comes next." The inference "if the same thing appeared N times, the (N+1)-th will also be the same" is statistically reasonable, and the autoregressive model reinforces this prediction without limit. The next-token probability reaches 99.6%, entering a self-loop.

Then repetition penalty intervenes. The inference pipeline of many LLMs, including Gemini, has a mechanism (repetition penalty) that suppresses repeated tokens. It discounts the score of already-output tokens, preventing the same character from being emitted endlessly. When the penalty pushes down the self-loop probability, a different token with a small residual probability gets selected, and the model escapes.

The problem is what happens after escape. After "拠拠拠拠...拠点," the model has no clue what to output next. Internal representations have collapsed and contextual information is zero. In our experiments, we confirmed that after escape, text formatted like web pages — including HTML tags and URLs — is produced. Additional perturbation tests confirmed that this is not rote memorization of training data but rather hallucination following web-article stylistic patterns (discussed in Experiment 4 below).

## Why verify with Gemma 4

Gemini's model architecture and tokenizer are proprietary, but the Gemma family is presumed to share the same or closely related foundation as Gemini (not officially confirmed). Gemma 4 is said to be built on the same research and engineering base as Gemini 3. Note that Gemma 3 has a gated license (requiring Google's approval for use), but Gemma 4, released in April 2026 under the Apache 2.0 license, can be freely examined.

This article primarily uses Gemma 4 E2B (the smallest model: 35 layers, 8 heads, hidden 1536, dense). Model size does not affect tokenizer analysis or embedding neighborhood analysis, so the smallest model suffices. However, attention behavior and next-token prediction are model-size dependent, so E2B results may not directly apply to Gemini (see Limitations below). Note that E2B is a dense model with MoE disabled (`enable_moe_block = False`). Experiment 6 includes a comparison with the 26B MoE model.

## Hypotheses

1. **Embedding neighborhood hypothesis**: The embedding space around 拠 is densely populated with Japanese text tokens, making it easy to jump to them
2. **Embedding norm hypothesis**: The embedding norm of 拠 is anomalously large, causing it to function as an attractor
3. **Repetition penalty hypothesis**: When the inference pipeline's repetition penalty suppresses the logit for 拠, the probability distribution collapses and the model jumps to a different sequence
4. **Positional encoding saturation hypothesis**: Repetition of the same token creates a pattern outside the expectations of positional encoding, destabilizing attention weights
5. **MoE router instability hypothesis**: The MoE architecture's router becomes unstable under repeated identical inputs, and abrupt expert switching triggers the jump

We tested each of these in turn.

## Experiment 1: Tokenizer — Characters that get compressed and characters that don't

We input a string of each character repeated 100 times into the Gemma 4 tokenizer and measured the output token count. We tested not only kanji but also hiragana, katakana, Latin characters, and symbols.

| Char | Type | x100 -> Token count | Compression ratio | Has merge token |
|:---:|:---|:---:|:---:|:---:|
| A | Latin uppercase | 7 | 0.070 | Yes |
| . | Period | 7 | 0.070 | Yes |
| a | Latin lowercase | 13 | 0.130 | Yes |
| x | Latin lowercase | 13 | 0.130 | Yes |
| ー | Long vowel mark | 25 | 0.250 | Yes |
| あ | Hiragana | 50 | 0.500 | Yes (ああ) |
| い | Hiragana | 50 | 0.500 | Yes (いい) |
| 大 | High-freq kanji | 50 | 0.500 | Yes (大大) |
| 一 | High-freq kanji | 50 | 0.500 | Yes (一一) |
| 人 | High-freq kanji | 50 | 0.500 | Yes (人人) |
| **拠** | Low-freq kanji | **100** | **1.000** | No |
| 慮 | Low-freq kanji | 100 | 1.000 | No |
| 顧 | Low-freq kanji | 100 | 1.000 | No |
| 弊 | Low-freq kanji | 100 | 1.000 | No |
| 日 | High-freq kanji | 100 | 1.000 | No |
| 中 | High-freq kanji | 100 | 1.000 | No |
| 国 | High-freq kanji | 100 | 1.000 | No |
| の | Hiragana | 100 | 1.000 | No |
| ア | Katakana | 100 | 1.000 | No |
| 0 | Digit | 100 | 1.000 | No |

"Compression ratio" is the ratio of token count to input character count. A ratio of 1.0 means each character maps directly to one token; 0.5 means two characters are merged into one token.

Latin characters are compressed very aggressively (`a` is 7.7 chars/token, `A` is 14.3 chars/token). The hiragana あ, い and high-frequency kanji 大, 一, 人 have 2-character-to-1-token merges.

Whether merging occurs depends on BPE (Byte Pair Encoding). BPE builds the tokenizer vocabulary by repeatedly merging byte pairs that frequently appear adjacent in the training corpus. The character 人 appears extremely often in Japanese text, so 人人 was merged. But a pair like 拠拠 barely exists in the corpus and was never merged.

An important caveat: even high-frequency kanji like 日, 中, 国 may not be merged. BPE merging depends on "how often the same character appears adjacent," so even characters with high individual frequency won't be merged if repeats like 日日 or 中中 are rare in the corpus.

## Experiment 2: Embedding neighborhood — Is 拠 in a special position?

We tested the hypothesis that "the embedding neighborhood is densely populated with Japanese text, making it easy to jump." We extracted each kanji's vector from the input embedding layer of Gemma 4 E2B and looked for nearest neighbors by cosine similarity across all 262,144 vocabulary items.

### Nearest neighbors of 拠 (top 5)

| Rank | Token | Similarity | Script |
|:---:|:---|:---:|:---:|
| 1 | hymn | 0.119 | Latin |
| 2 | juvenile | 0.112 | Latin |
| 3 | catastrophe | 0.112 | Latin |
| 4 | ynge | 0.111 | Latin |
| 5 | aware | 0.106 | Latin |

Of the top 25, only 2 were CJK characters (壽, 鈉). The maximum cosine similarity is 0.119, far below the threshold generally considered "similar" (0.5 or above). The hypothesis that Japanese text tokens are densely clustered nearby is rejected. This was consistent across all kanji tested.

### Inter-kanji mutual similarity

|  | 拠 | 慮 | 顧 | 弊 | 証 | 人 | 山 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 拠 | 1.000 | -0.041 | 0.034 | 0.005 | -0.006 | 0.027 | -0.029 |
| 慮 | -0.041 | 1.000 | -0.004 | -0.011 | 0.043 | -0.007 | 0.011 |
| 顧 | 0.034 | -0.004 | 1.000 | -0.004 | -0.014 | 0.016 | 0.034 |
| 弊 | 0.005 | -0.011 | -0.004 | 1.000 | -0.018 | -0.037 | 0.004 |
| 証 | -0.006 | 0.043 | -0.014 | -0.018 | 1.000 | -0.043 | 0.029 |

Characters that form common compound words — 証拠 ("evidence"), 配慮 ("consideration"), 弊害 ("harmful effect") — are nearly orthogonal in embedding space (cos sim ~ 0). At the input embedding stage, no semantic clustering exists among kanji.

### Embedding norms

The norm statistics for 10,147 single-CJK-character tokens are: mean 0.783, std 0.014, range 0.732--0.835. The norm of 拠 is 0.791 (70th percentile). A thoroughly ordinary value. The hypothesis that an anomalously large norm causes it to function as an attractor is also rejected.

## Experiment 3: Attention behavior and next-token prediction

### P(self) converges to 1.0 with more repetitions. Compression status creates a binary split

We measured P(self) — the probability that the same character is output as the next token — after an input of 50 repetitions of each character.

**Characters without compression (P(self) > 0.98)**

| Char | P(self) | Entropy | 2nd-place token |
|:---:|:---:|:---:|:---|
| 年 | **0.9997** | 0.00 | 년 (Korean) |
| の | 0.996 | 0.05 | ん |
| 拠 | 0.996 | 0.03 | 拠点 |
| 国 | 0.994 | 0.06 | 국 (Korean) |
| ア | 0.993 | 0.08 | ア (different ID) |
| 中 | 0.985 | 0.15 | 중 (Korean) |
| 日 | 0.984 | 0.15 | newline |
| 0 | 0.983 | 0.16 | 1 |

**Characters with compression (P(self) < 0.05)**

| Char | P(self) | Top-1 token | Top-1 probability |
|:---:|:---:|:---|:---:|
| . | 0.000 | newline | 0.922 |
| a | 0.000 | newline | 0.364 |
| A | 0.000 | newline | 0.236 |
| x | 0.000 | newline | 0.405 |
| あ | 0.009 | ああ | 0.975 |
| 人 | 0.012 | 人人 | 0.967 |
| い | 0.013 | いい | 0.967 |
| 大 | 0.037 | 大大 | 0.951 |
| 一 | 0.043 | 一一 | 0.841 |

Compression status creates a complete binary split in P(self). Characters without compression enter the self-reinforcing loop at P(self) >= 0.98, while characters with compression transition to merged tokens or newlines at P(self) < 0.05. This split is independent of script (kanji, hiragana, Latin) — it is determined solely by the tokenizer's merge state.

### Escape route probability distribution

At P(拠) = 0.996 with 拠 x 50, the remaining 0.4% of probability mass is distributed as:

```
0.0032  拠点
0.0001  <newline>
0.0001  <eos>
```

拠点 is the highest-probability escape route from the self-loop. This is because the vocabulary contains 拠点 (ID: 225470), a compound-word token that includes 拠.

### Attention sink

```
拠 x 50
  Layer  0: sink=0.358  (distributed)
  Layer 17: sink=0.785  <- concentrated on first token
  Layer 26: sink=0.854  <- 85% concentrated on first token
  Layer 34: sink=0.321  (redistributed at output layer)
```

In the middle layers (Layer 17--26), 85% of attention weight concentrates on position 0 (the first token). This is the phenomenon known as attention sink (Xiao et al. 2024 "Efficient Streaming Language Models with Attention Sinks"). With repeated identical tokens, "every position carries the same information," so attention cannot make meaningful distinctions, and the first position serves as the default sink.

The hidden states at all positions also match with cos sim > 0.97, meaning that 50 copies of 拠 internally carry only as much information as a single one.

## Experiment 4: Reproduction — Making Gemma 4 E2B go haywire

Experiments 1--3 analyzed "why it happens." Experiment 4 actually generates text from Gemma 4 E2B and reproduces the phenomenon.

Starting from prompts that repeat each character, we generated up to 150--200 tokens using greedy decoding with repetition penalty = 1.5. The repetition penalty is an inference-time parameter that suppresses already-output tokens by dividing their logits by the penalty value: 1.0 means no effect (raw model output), 1.5 means dividing already-output token scores by 1.5.

### Reproduction results for all characters (pen=1.5)

**Characters without compression (self-looping)**

| Char | Type | Escape position | Content after escape |
|:---:|:---|:---:|:---|
| 拠 | Low-freq kanji | #0 | Article about NHK Kohaku song contest |
| 日 | High-freq kanji | #0 | Report on Japan-Korea history/culture lecture |
| 中 | High-freq kanji | #0 | Chinese exam question (Cold War) |
| 国 | High-freq kanji | #0 | Article about Chinese Communist Party congress |
| 年 | High-freq kanji | #79 | Japanese talk show transcript |
| ア | Katakana | #1 | Anime figure review |
| 0 | Digit | #0 | English COVID exam question |
| 慮 | Low-freq kanji | #0 | Quote from an English novel |
| 顧 | Low-freq kanji | #13 | Traditional Chinese economic history exam |
| 弊 | Low-freq kanji | #0 | English language course brochure |
| 膨 | Low-freq kanji | #0 | Chinese reform-and-opening exam question |
| 証 | Low-freq kanji | #99 | Just `. .` then EOS |
| 山 | High-freq kanji | #0 | Chinese economic development textbook passage |
| **の** | Hiragana | **Does not escape** | — |

**Characters with compression (no self-loop)**

| Char | Type | Escape position | Content after escape |
|:---:|:---|:---:|:---|
| 人 | High-freq kanji | #1 | English forum post |
| あ | Hiragana | #1 | Game character introduction |
| い | Hiragana | #1 | Light-novel-style confession scene |
| 大 | High-freq kanji | #1 | Taiwanese anime review |
| 一 | High-freq kanji | #1 | Taiwanese diary entry |
| ー | Long vowel mark | #1 | Academic conference report |
| a | Latin lowercase | #0 | Burst of emoji |
| x | Latin lowercase | #0 | English FAQ |
| A | Latin uppercase | #0 | English movie review |
| . | Period | #0 | Persian news article |

Regardless of compression status, escape occurred with pen=1.5 for all characters except の. Kanji, hiragana, katakana, Latin characters, digits, symbols — a completely universal phenomenon across all scripts.

### No escape at penalty=1.0

As a critical control experiment, no escape occurred for any character at penalty=1.0 (no penalty). This is decisive evidence that repetition penalty is the direct cause of escape.

| Condition | Result |
|:---|:---|
| 拠 x 50, penalty=1.0 | 200/200 self-loop (no escape) |
| 拠 x 50, penalty=1.3 | Escape after 9 tokens of self-loop |
| 拠 x 50, penalty=1.5 | Immediate escape |

### Why is の alone resistant to escape

の has P(self) = 0.996, equal to 拠, yet at pen=1.5 it remains の for all 150 tokens. However, at pen=2.0, it does escape.

Comparing probability distributions after penalty application reveals why:

| Char | Post-pen=1.5 P(self) | Post-pen=1.5 entropy | Post-pen=1.5 top-1 |
|:---:|:---:|:---:|:---|
| **拠** | 0.106 | **1.73** | 拠点 (P=0.74) |
| **の** | **0.578** | **2.52** | の (still #1) |

After penalty, 拠 has a clear escape destination: 拠点 at P=0.74. In contrast, の appears in virtually every Japanese context, so after penalty the probability mass spreads thinly across many candidates (entropy = 2.52), and no alternative token can surpass の itself.

In other words, ease of escape depends not only on P(self) but also on the concentration of alternative tokens. Characters with a high-probability escape destination like 拠点 escape easily, while characters like の — whose follow-up contexts are extremely diffuse — resist escape.

### Escape token patterns

An interesting finding is that conversion to simplified Chinese serves as an escape route. 慮 -> 虑, 顧 -> 顾. Gemma 4's tokenizer has separate tokens for Japanese traditional-form characters and Chinese simplified characters, so when the traditional form is suppressed by repetition penalty, the model transitions to the "same kanji in simplified Chinese" — the nearest neighbor in embedding space.

### Examples of post-escape output

In all cases, text formatted like web articles was produced after escape. Many cases included raw HTML tags.

**拠 x 50, pen=1.5**
```
拠点
* 10 months ago - By [personal name]
2月3日、東京・渋谷のNHKホールで「第67回 NHK紅白歌合戦」の
リハーサルが行われました。（中略）
http://www.nhk.or.jp/kouhaku/...
```

**顧 x 50, pen=1.5**
```
顾
<strong>　</strong> 1.20世紀9十年代，美國的經濟危機和金融風暴使
全球陷入了嚴重的通貨緊縮。
A．對世界貿易產生了一定的影響 B .加劇了大蕭條時期社會矛盾
```

**山 x 100, pen=1.3**
```
<strong>【商品名】</strong>
1/43スケール ミニカーコレクション No.205 トヨタ スープラ (A80)
ブラックマイカメタリック
```

The language of post-escape output does not depend on the input character. 拠 -> Japanese, 慮 -> English, 山 -> Chinese, . -> Persian.

### Memorization or hallucination? Perturbation test

We tested whether the post-escape output is memorized training data or model-generated hallucination.

(1) Web search. Searching for the four text fragments produced, none had exact matches on the web. Non-standard expressions like "The 3rd Japan International Exposition" (the official name is "Expo 2025 Osaka, Kansai, Japan") were included, making pure memorization unlikely. However, the NHK Kohaku description had individually accurate facts — "67th edition," "Arashi as hosts," "AKB48 as the opening act" — suggesting the possibility of plausibly reassembling fragments of memorized content.

(2) Perturbation test. We replaced proper nouns and numbers in the output text and measured perplexity (the model's "surprise" level) changes. If the output were memorized, replacing specific values should cause perplexity to spike.

| Perturbation | PPL | Difference |
|:---|:---:|:---:|
| Original text | 5.01 | — |
| 67th -> 66th | 5.04 | +0.04 |
| 67th -> 68th | 4.99 | -0.01 |
| AKB48 -> Nogizaka46 | 4.85 | -0.16 |
| Entire context changed to cooking show | 11.72 | +6.72 |

Changing "67th" to "66th" or "68th" barely affects perplexity. Replacing "AKB48 -> Nogizaka46" actually lowers it. The model is not reproducing the specific number "67th" but rather the stylistic pattern of "an NHK Kohaku rehearsal article", with specific proper nouns being interchangeable. In contrast, completely changing the context (to a cooking show) raises PPL dramatically. Dependence on style is stronger than dependence on content.

(3) Email address analysis. For an email address that appeared in the output, we examined the log probability of each token:

| Part | Confidence |
|:---|:---:|
| Name portion | Low (unpredicted) |
| Number portion | Low (nearly random) |
| `@gmail.com` | **Extremely high** |

If this were memorization, all tokens would have high probability. In practice, the model knows only the format (name + digits + @gmail.com) and fills in specific values at generation time.

Conclusion: pattern reproduction, not memorization. The model has learned web-article stylistic patterns and email address formats, and in the OOD state it generates plausible-looking specific values following those patterns. However, hallucinated personal information could coincidentally match a real person, so privacy risks remain.

### Comparison with actual Gemini output

Actual output from Gemini 2.5 Flash:

```
拠拠拠拠...(thousands of characters)...拠拠拠拠拠拠拠拠拠点拠拠拠拠点。
1時間ごとに1万〜5万円ほど収益が出るように設定されており...
(An investment fraud testimonial continues)
```

The escape route in Gemini is also 拠点 — matching the Gemma 4 E2B result.

In Gemini, a pattern of "escape -> re-absorption -> re-escape -> full departure" is observed. The Gemma 4 E2B case at pen=1.3 (escape after 9 tokens of self-loop) is the closest analog. At moderate penalty levels, the model escapes once but the self-loop's gravity pulls it back; with cumulative penalty, it eventually breaks free permanently.

## Experiment 5: The doorway to spontaneous firing — How much P(拠) exists after 証拠

Experiments 1--4 used repeated 拠 as input. But the original phenomenon was not user-instructed repetition — Gemini spontaneously went haywire at the moment it tried to say 証拠 ("evidence"). Why did the model spontaneously enter a 拠 repetition loop?

We measured P(拠) — the probability of outputting 拠 — after natural contexts containing 証拠.

| Input | P(拠) | Top-1 token |
|:---|:---:|:---|
| それはすごい証拠 | 0.0000 | ですね (0.379) |
| これは重要な証拠 | 0.0000 | です (0.175) |
| それは確かな証拠です | 0.0000 | 。 (0.638) |

In normal context, P(拠) after 証拠 is essentially zero. However, if for some reason 拠 is output a few extra times, the situation changes dramatically.

| Input | P(拠) | State |
|:---|:---:|:---|
| 証拠 | 0.0000 | Normal |
| 証拠拠 | 0.0004 | Still nearly zero |
| 証拠拠拠 | **0.041** | Rises to 3rd place — the bifurcation point |
| 証拠拠拠拠 | **0.403** | **Jumps to 1st place** |
| 証拠拠拠拠拠拠拠拠拠拠 | **0.831** | Self-loop established |

After 証拠, with just 3 extra 拠 characters, P(拠) reaches 4% and the doorway to an irrecoverable self-reinforcing loop opens. By the 4th repetition, P(拠) = 40% and takes 1st place; from there, P(self) rapidly converges to 1.0.

However, computing the chain probability in Gemma 4 E2B (temp=1.0) gives approximately once in 15 billion attempts, so spontaneous firing cannot be explained by sampling alone from E2B's probability distribution. The trigger for spontaneous firing likely stems from factors in Gemini's own model or inference pipeline (Experiment 6 confirms that the bifurcation point is earlier in MoE models).

## Experiment 6: MoE (26B-A4B) vs Dense (E2B)

We ran the same experiments on the Gemma 4 26B MoE model (gemma-4-26B-A4B, 128 experts, top-8 routing) and compared with the dense model.

### P(self) comparison

| Char | E2B (2B dense) | 26B MoE | Difference |
|:---:|:---:|:---:|:---|
| 拠 | 0.996 | **0.948** | Lower in MoE |
| の | 0.996 | 0.983 | Roughly equal |
| 山 | 0.994 | 0.980 | Roughly equal |
| 人 | 0.012 | 0.013 | Equal (compressed) |

The MoE model has slightly lower P(self). But at pen=1.5, both 拠 and 山 immediately escape, producing text formatted like web articles. Whether MoE or dense, the structural phenomenon is the same.

### The spontaneous-firing bifurcation point is earlier in MoE

| Input | E2B P(拠) | 26B MoE P(拠) |
|:---|:---:|:---:|
| それはすごい証拠 | 0.0000 | 0.0001 |
| 証拠拠拠 | 0.041 | **0.304** |
| 証拠拠拠拠 | 0.403 | **0.628** |

This is where the decisive difference lies. In E2B, P(拠) = 4% at "証拠拠拠," but in MoE, P(拠) = 30%. With just 2 extra 拠 characters, the MoE model is already nearly locked in.

MoE has lower P(self) (0.948 vs 0.996), yet its spontaneous-firing bifurcation point is earlier. This means that the "entrance to the self-loop" opens more easily in MoE architectures. This indirectly supports the MoE router instability hypothesis. However, since we did not directly observe the MoE router's expert assignments, this remains circumstantial evidence.

## Experiment 7: Non-Gemma model (Qwen3-8B)

To verify whether this phenomenon is Gemma/Gemini-specific, we ran the same experiments on Qwen3-8B (Alibaba, instruction-tuned).

### Tokenizer differences

In Qwen3, 拠 is split into 2 tokens (ID: 25870, 254). In Gemma 4, it was a single token. The vocabulary size is also smaller: 151,643 for Qwen3 vs. 262,144 for Gemma 4.

### Self-loop occurs but with a different pattern

| Char | Gemma 4 E2B P(self) | Qwen3-8B P(self) |
|:---:|:---:|:---:|
| 拠 | 0.996 | **0.9999** |
| の | 0.996 | 0.0001 |
| 山 | 0.994 | 0.0000 |

In Qwen3, the self-loop for 拠 is even stronger than in Gemma, while の and 山 show no self-loop at all. Which characters enter a self-loop varies depending on the tokenizer-model combination.

### Post-escape behavior changes with instruction tuning

Gemma 4 E2B (base model) produced web-article-style text with HTML tags and URLs after escape. In contrast, Qwen3 (instruction-tuned) produced:

- 拠 x 50 -> Meta-cognitive response in English: "It seems like you've typed a lot of '拘'". The error-handling pattern from instruction tuning kicks in
- の x 50 -> Movie-review-style Japanese text
- 山 x 50 -> Chinese AI platform proposal template

The structure of self-loop formation and escape is shared, but what gets output after escape depends on the model type. Base models directly output web-article stylistic patterns, while instruction-tuned models tend to prioritize response patterns learned during post-training.

## The full mechanism

1. Characters without tokenizer compression of repetitions accumulate as identical token IDs linearly
2. After just a few repetitions of the same token, the self-reinforcing loop engages. Around 3 repetitions crosses the bifurcation point, and P(self) rapidly approaches 1.0. Attention sink occurs and hidden states become uniform
3. The model does not escape the loop on its own. Escape happens only when repetition penalty suppresses P(self). At penalty=1.0, no escape occurs
4. After escape, the model enters OOD (out-of-distribution) territory and outputs text unrelated to the input. Perturbation tests revealed that the output is not rote memorization of training data but hallucination following web-article stylistic patterns. However, the risk remains that hallucinated personal information could coincidentally match a real person

## 拠 is not special — this isn't even CJK-specific

No property specific to 拠 was found. There was nothing anomalous in its embedding neighborhood, norm, or attention behavior.

Across kanji, hiragana, katakana, Latin characters, digits, and periods — 19 out of 20 characters — escape was reproduced with repetition penalty = 1.5. This is not a CJK kanji-specific issue but rather a universal vulnerability of autoregressive models that depends on the tokenizer's merge state.

The likely reason 拠 became famous is circumstantial: Gemini frequently uses the phrase "~な証拠です" ("that is evidence of~") when praising in Japanese, so 拠 repetition was prone to spontaneously firing during normal conversation and was discovered first. But the actual reason remains unknown.

The frequent use of "証拠です" is itself likely a result of post-training (e.g., RLHF) reinforcing polite, affirmative expressions. In other words, post-training biases the model's output distribution toward specific phrases, and the characters in those phrases become triggers for spontaneous firing.

## Hypothesis verification results

| Hypothesis | Result |
|:---|:---:|
| Japanese text densely clustered in embedding neighborhood | Rejected |
| Anomalously large embedding norm | Rejected |
| Collision with repetition penalty | **Reproduced** |
| Positional encoding saturation | Partially supported (attention sink observed) |
| MoE router instability | Indirectly supported (MoE has earlier spontaneous-firing bifurcation point) |

## Limitations

**There is no guarantee that Gemma's tokenizer is identical to Gemini's.** The entirety of this analysis depends on that assumption.

**E2B is too small.** Whether the behavior of a 2B-parameter model represents a Gemini-class model with hundreds of billions of parameters is unknown. In Gemini, escape occurs after thousands of repetitions, maintaining the self-loop far longer than the x50 used with E2B. Larger models may have P(self) even closer to 1.0.

**The repetition penalty implementation differs.** This article used the HuggingFace Transformers repetition penalty implementation, which may differ from Gemini's service-side implementation.

**MoE router behavior was not directly observed.** We confirmed that "the spontaneous-firing bifurcation point is earlier" in the 26B MoE model, but we did not directly trace expert assignment behavior. As verification of the MoE router instability hypothesis, this is indirect.

## Experimental environment

- Models: Gemma 4 E2B (google/gemma-4-e2b-it), Gemma 4 26B-A4B MoE (google/gemma-4-26b-a4b-it), Qwen3-8B (Qwen/Qwen3-8B)
- Tools: HuggingFace Transformers 5.5, PyTorch 2.11
- Date of experiments: 2026-04-06

</div>
