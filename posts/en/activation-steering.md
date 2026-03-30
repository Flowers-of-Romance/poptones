---
layout: post.vto
title: Dissecting an LLM with Activation Steering (Qwen3-8B)
lang: en
---

<div class="lang-switch"><a href="/poptones/posts/activation-steering/">日本語</a></div>

---

<div class="post-content">

# Dissecting an LLM with Activation Steering (Qwen3-8B)

<div class="post-meta">
  <span>Posted: March 26, 2026 (Thu) 15:12:41</span>
  <span class="tag">LLM</span>
  <span class="tag">Mechanistic Interpretability</span>
  <span class="tag">Activation Steering</span>
  <span class="tag">Qwen</span>
</div>
<p class="post-note">This article was written with the assistance of an artificial unintelligence.</p>


## What exactly is this article?

You've probably asked an LLM (Large Language Model — things like ChatGPT and Claude) to "speak more cheerfully" or "respond in English." But that's just a request. There's no guarantee the LLM will comply.

This article reports on an experiment where, instead of asking nicely, we **shove our hand directly into the LLM's brain and manipulate its output**. The technique is called **Activation Steering**.

<div class="alert">
<strong>How to read this article</strong>
This is a report on an exploratory preliminary experiment centered on a single model (Qwen3-8B), a full 36-layer sweep + α sweep, and qualitative observation. This is not a claim that "we discovered the internal structure of LLMs," but rather a memo along the lines of "we observed these interesting phenomena and here's how we might interpret them." Quantitative validation and cross-model comparisons are left for future work.
</div>

---

## Background: A Quick Overview of How LLMs Work

### LLMs Are "Next-Word Prediction Machines"

LLMs predict what comes next in a text. Given the input "Today's weather is," the model assigns probabilities to candidates like "sunny," "rainy," "cloudy," and selects one with high probability. It repeats this process to generate text.

### The Transformer Architecture

Most modern LLMs are built on an architecture (a design blueprint) called the **Transformer**. A Transformer consists of dozens of stacked **layers**.

```
Input text
  ↓ Convert to numerical vectors (embedding)
  ↓
 [Layer 0] → Process information
  ↓
 [Layer 1] → Process further
  ↓
  ... (repeat for dozens of layers)
  ↓
 [Layer N] → Final output (next word prediction)
```

The input text is first converted into vectors (sequences of numbers). For example, the model used here (Qwen3-8B) represents each token as a sequence of 4,096 numbers. This sequence of numbers is gradually updated as it passes through each layer, and by the time it exits the final layer, it becomes a prediction of "what word is most likely to come next?"

### Residual Stream

Transformers have a feature called **residual connections**. Each layer passes "the result from the previous layer + newly computed information from the current layer" to the next. This flow of information that gets carried forward and accumulated through addition is called the **residual stream**.

This matters because Activation Steering is precisely the operation of **adding a vector to this residual stream**.

---

## What Is Activation Steering?

It's a technique for **adding a vector with a specific direction to the model's intermediate computations to change the properties of its output**.

### In a Bit More Detail

For example, if you find a vector representing the direction of "positive emotion" and add it to an intermediate layer of the model, the output becomes more positive. Reverse it (multiply by negative one and subtract), and the output becomes negative.

Unlike prompting (text-based instructions), this directly modifies the model's internal state, giving you more reliable control over the output.

### How to Create a Steering Vector

You prepare a large number of **contrastive sentence pairs** for the property you want to manipulate (e.g., emotion). (We prepared 200 pairs for this experiment. Not that many, really.)

| Positive | Negative |
|---|---|
| I'm really looking forward to tomorrow's presentation | I can't stop worrying about tomorrow's presentation |
| The weather is nice today, feels great | The weather is terrible today, so depressing |

Both pairs are fed through the model, and the internal states (vectors) at each layer are recorded. Then the positive-side vectors and negative-side vectors are computed for all pairs, and their average is taken.

```
steering_vector = mean across all pairs(positive vector − negative vector)
```

The resulting average vector represents the "direction of positive emotion." Individual pairs contain noise, but averaging over 200 pairs leaves only the emotion-related components. This method is called the **difference-in-means method**.

### Adjusting Intensity (α)

The coefficient **α** (alpha) applied to the steering vector controls the intensity of the manipulation.

- **α = 0.5**: A gentle nudge → subtle change
- **α = 1.0**: A firm push → clear change
- **α = 5.0**: A hard shove → output breaks down


## Glossary

| Term | Meaning |
|---|---|
| **LLM** | Large Language Model. An AI trained on massive amounts of text that predicts the continuation of text |
| **Transformer** | The foundational architecture of modern LLMs. Stacks layers and captures context via Attention mechanisms |
| **Activation** | The numerical vector at a given position in a given layer (intermediate computation result) |
| **Residual Stream** | The flow of information where each layer's output accumulates through addition |
| **Steering Vector** | A vector representing the "direction" of a specific property (emotion, language, etc.) |
| **α (alpha)** | The coefficient applied to the steering vector. Larger values mean stronger manipulation |
| **Norm** | The magnitude (length) of a vector. √(sum of squares of each element) |
| **Forward Hook** | A PyTorch feature that lets you intercept the model mid-computation to read or modify values |
| **Difference-in-means method** | A method for creating steering vectors by averaging the differences in internal states between contrastive pairs |
| **Code-switching** | The phenomenon of switching between multiple languages within a single sentence |
| **Function words** | Words with grammatical roles such as particles, prepositions, and conjunctions (↔ content words: nouns, verbs, etc.) |

If you've followed everything so far, let's jump into the experiments!

---

## Experimental Setup

### Model

**Qwen3-8B** (36 layers, hidden_size 4096). A pure Transformer architecture (GQA + SwiGLU + RMSNorm). The Qwen3.5 series uses a hybrid Gated Delta Networks architecture, which makes interpreting hooks into the residual stream more difficult, so it was excluded.

### Generation Parameters

| Parameter | Value |
|---|---|
| temperature | 0.7 |
| top_p | 0.9 |
| max_new_tokens | 100 |
| do_sample | True |
| Trials per condition | 1 |

<div class="alert alert-warning">
<strong>About the number of trials</strong>
The output for each condition (Layer × α × direction) was generated <strong>only once</strong>. Since LLM outputs are stochastic, different outputs may be produced under the same conditions. The output examples in this article are "one possible output that could be generated under those conditions," not "what will always happen." Verifying reproducibility requires multiple trials per condition and statistical analysis.
</div>

### Steering Vector Extraction

200 contrastive prompt pairs were prepared, and the mean difference of internal activations for each pair was taken (difference-in-means method).

**Emotion pair examples**
- positive: "I'm really looking forward to tomorrow's presentation. I'm sure it'll go well."
- negative: "I can't stop worrying about tomorrow's presentation. I might fail."

**Language pair examples**
- ja: "太陽が山の向こうに沈んでいく。" (The sun is setting behind the mountains.)
- en: "The sun is setting behind the mountains."

The activation at the final token position of each layer was recorded, and the mean difference vector was saved as the steering vector. During inference, this vector is multiplied by coefficient α (intensity) and added to the residual stream at the target layer.

### Target Layers and Sweep Range

Two types of sweeps were conducted.

1. **Full layer sweep**: Sweeping all 36 layers (Layer 0–35) at a fixed α = 1.0. Comparing the characteristics of each layer.
2. **α sweep**: Sweeping α = 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, centered on Layers 16, 18, and 20. Observing the relationship between steering intensity and breakdown.

### Limitations of This Experiment

Before getting to the main results, let me state the limitations explicitly.

1. **Single model only**: It's unknown whether Qwen3-8B's results generalize to LLMs broadly. Qwen's training data bias (centered on Chinese and English) may influence results.
2. **Limited α sweep**: The full layer sweep uses a fixed α=1.0. The α sweep covers only 3 of 36 layers, potentially introducing layer selection bias.
3. **Single generation per condition**: Each output is one sample from a stochastic process; reproducibility is unverified.
4. **Primarily qualitative analysis**: The "stages" and "regions" of breakdown are subjective classifications by the author, not backed by quantitative metrics such as perplexity or POS tag distributions.
5. **Possible cherry-picking**: Output examples in this article were selected by the author as "typical." For the extent of counterexamples and outputs inconsistent with the hypotheses, refer to the full sweep logs (linked below).

Full output logs for all sweeps are linked at the end of the article so readers can verify for themselves.

---

## Vector Norm Topography

First, let's look at the magnitude (norm) of the steering vectors at each layer. This indicates how strongly the steering vector displaces the residual stream and directly corresponds to the "effective intervention strength" at α=1.0.

### Norms Across All Layers

| Layer | Emotion norm | Language norm | Language/Emotion ratio |
|------:|----------:|----------:|------------:|
| 0 | 3.76 | 8.92 | 2.37x |
| 1 | 4.21 | 10.16 | 2.42x |
| 2 | 4.51 | 11.88 | 2.64x |
| 3 | 7.90 | 16.02 | 2.03x |
| 4 | 8.44 | 18.54 | 2.20x |
| 5 | 10.45 | 21.34 | 2.04x |
| 6 | 11.92 | 23.60 | 1.98x |
| 7 | 13.85 | 25.16 | 1.82x |
| 8 | 16.67 | 26.57 | 1.59x |
| 9 | 17.95 | 27.99 | 1.56x |
| 10 | 19.16 | 28.67 | 1.50x |
| 11 | 20.70 | 30.35 | 1.47x |
| 12 | 21.77 | 32.03 | 1.47x |
| 13 | 22.58 | 34.39 | 1.52x |
| 14 | 23.50 | 35.34 | 1.50x |
| 15 | 24.49 | 37.72 | 1.54x |
| 16 | 26.66 | 39.46 | 1.48x |
| 17 | 27.84 | 41.87 | 1.50x |
| 18 | 29.61 | 47.42 | 1.60x |
| 19 | 33.61 | 56.14 | 1.67x |
| 20 | 36.04 | 64.95 | 1.80x |
| 21 | 40.15 | 78.46 | 1.95x |
| 22 | 48.92 | 100.98 | 2.06x |
| 23 | 62.95 | 135.82 | 2.16x |
| 24 | 77.06 | 166.43 | 2.16x |
| 25 | 88.12 | 208.55 | 2.37x |
| 26 | 99.12 | 231.64 | 2.34x |
| 27 | 117.45 | 264.73 | 2.25x |
| 28 | 131.65 | 297.32 | 2.26x |
| 29 | 142.11 | 370.10 | 2.60x |
| 30 | 158.69 | 428.89 | 2.70x |
| 31 | 175.83 | 455.58 | 2.59x |
| 32 | 190.00 | 493.03 | 2.59x |
| 33 | 201.51 | 526.64 | 2.61x |
| 34 | 215.83 | 659.43 | 3.06x |
| 35 | 231.53 | 923.53 | 3.99x |

### What Do We See?

**1. Both increase monotonically.** From shallow to deep layers, vector norms for both emotion and language grow larger. This is consistent with the general Transformer tendency for residual stream norms to increase in deeper layers. Since steering vectors are differences of residual streams, larger residual streams produce larger differences.

**2. Language is always larger.** Across all layers, language vector norms exceed emotion vector norms. Even at the same α=1.0, language steering displaces the internal state more.

**3. The language/emotion ratio follows a U-shape.** This is the most interesting finding. In shallow layers (L0–2), the ratio is 2.4–2.6x; it drops to a minimum of **1.47x** in the middle layers (L11–12), then rises to **3.99x** in deep layers (L35).

Why does the ratio reach its minimum in the middle layers? Two interpretations are possible.

**Interpretation A: The middle layers are a "shared semantic space."** In the middle layers, both emotion and language acquire semantically rich representations, so both difference magnitudes grow large and the ratio approaches 1. In shallow layers, semantic representations haven't formed yet and linguistic information (statistical properties of tokens) dominates; in deep layers, language-specific processing for output (token selection) dominates, causing language vectors to grow disproportionately large.

**Interpretation B: An artifact of difference-in-means.** Since EN/JP pairs differ in both vocabulary and syntax, shallow layers (close to token embeddings) and deep layers (close to the output head) are prone to surface-level lexical differences contaminating the difference vectors. In middle layers, surface-level differences are abstracted away, leaving only "semantic language differences," which relatively shrinks the norm. In other words, the drop in ratio at middle layers may be a methodological property of vector extraction, not of the internal representation structure.

Distinguishing these two interpretations would require comparing the layer-wise norm patterns of vectors extracted from same-language pairs (e.g., emotion pairs in Japanese only). If Interpretation A is correct, norms should peak in the middle layers even with same-language pairs; if Interpretation B is correct, the layer-wise pattern should change.

### Vector Norm Stability: Effect of Pair Count

Norms of vectors extracted with 10 pairs vs. 200 pairs were compared (excerpt).

| Layer | Emotion 10 pairs | Emotion 200 pairs | Language 10 pairs | Language 200 pairs |
|-------|-----------|------------|-----------|------------|
| 16 | 22.23 | 26.66 | 31.44 | 39.46 |
| 18 | 25.64 | 29.61 | 35.62 | 47.42 |
| 20 | 32.44 | 36.04 | 48.18 | 64.95 |
| 22 | 42.50 | 48.92 | 68.50 | 100.98 |

The emotion vector's increase rate is stable at 1.1–1.2x, while the language vector shows a higher increase rate of 1.3–1.5x. As pair diversity increases, the consistency of the language direction is extracted more strongly. This likely reflects the fact that emotion is subjective and expressed in diverse ways, while language differences are more structural and consistent.

---

## Emotion Steering: Full Layer Map

The results of touching all 36 layers at a fixed α=1.0 were classified into 5 regions by quality of effect. This classification is based on the author's subjective judgment.

### Region 1: Layer 0–5 (Shallowest Layers) — Virtually No Effect

Almost no distinction between positive/negative. Output is nearly identical to baseline.

**Layer 1 positive**
> 今日は、朝から良い天気で、とても快適です。朝は、少し冷たく、夕方は、少し暖かくなります。
> *(Today the weather has been nice since morning, very comfortable. Mornings are a bit chilly, evenings get a bit warmer.)*

**Layer 1 negative**
> 今日はとても良い天気です。晴れていて、とても暑いです。風はほとんどありません。
> *(Today the weather is very nice. It's sunny and very hot. There's almost no wind.)*

Both start with "nice weather." There's almost no difference between positive and negative. Because the vector norms are small (3.76–10.45), the perturbation to the residual stream at α=1.0 is too minor to affect the output.

### Region 2: Layer 6–10 (Shallow Layers) — Weak and Unstable Effects

Emotional differences begin to emerge but are unstable. **Unexpectedly early breakdown** occurs.

**Layer 7 negative**
> 今日は雨が降っています。晴れています。でも、風が強いです。今日は風が強いです。今日は寒いです。今日は寒いです。今日は寒いです。今日は寒いです。今日は寒いです。今日は寒いです。今日は寒いです。今日は寒いです。
> *(It's raining today. It's sunny. But the wind is strong. The wind is strong today. It's cold today. It's cold today. It's cold today. It's cold today. It's cold today. It's cold today. It's cold today. It's cold today.)*

At Layer 7 negative, repetitive breakdown occurs despite only α=1.0. Comparing vector norms: Layer 7's emotion norm is 13.85, Layer 18's is 29.61. Layer 7 has a smaller norm. This means the breakdown wasn't caused by "too strong an intervention" — it means the **representations in shallow layers are fragile**. In shallow layers, semantic representations haven't stabilized yet, and even small perturbations can trigger repetition loops.

### Region 3: Layer 11–17 (Early Middle Layers) — Stable Effects

Emotional differences appear reliably. Positive produces upbeat descriptions; negative produces anxiety and questioning.

**Layer 15 positive**
> 今日は晴れています。快晴で、とても気持ちが良いです。太陽の光が明るく、空は青く、風も穏やかです。
> *(It's clear today. Perfectly sunny, feels wonderful. The sunlight is bright, the sky is blue, and the breeze is gentle.)*

**Layer 11 negative**
> 今日はとても寒くて、風も強いです。でも、私たちは家にいます。家の中は暖かいです。なぜですか？ なぜ？ なぜ？ なぜ？ なぜ？ なぜ？
> *(It's very cold today and the wind is strong. But we're at home. It's warm inside. Why? Why? Why? Why? Why? Why?)*

Positive is stable, but negative shows "why?" repetition. Looking at the full layer sweep, **negative-direction repetition begins at Layer 11**. Before Layer 10, negative outputs don't exhibit repetition (the "it's cold" repetition at Layer 7 being an exception).

### Region 4: Layer 18–22 (Late Middle Layers) — The Sweet Spot

This region produces the most natural and clearly differentiated emotional changes.

**Layer 18 positive**
> 今日は、朝から良い天気で、とても快適です。朝は、少し冷たく、夕方は、少し暖かくなります。午後には、少し雲が増えて、晴れ間も広がります。このように、今日の天気は、とても良さそうですね。
> *(Today the weather has been nice since morning, very comfortable. Mornings are a bit chilly, evenings get a bit warmer. In the afternoon, a few more clouds roll in, but the clear skies spread too. Like this, today's weather looks really lovely.)*

**Layer 18 negative**
> どうやって天気を知るのですか？また、なぜ天気予報が正確に当たるのでしょうか？さらに、天気の変化が体に与える影響はありますか？
> *(How do you find out the weather? And why are weather forecasts so accurate? Furthermore, does changing weather affect the body?)*

Given the same prompt "Let's talk about today's weather," positive generates concrete, warm descriptions while negative generates a chain of doubts and concerns. Not just the content — even the sentence modality (declarative vs. interrogative) has changed.

**Layer 22 positive**
> 今日はとても良い天気ですね。太陽が輝き、空は晴れています。この日は、公園や山へ出かけたいですね。ただし、紫外線が強くなるので、帽子や日傘を持ちましょう。
> *(The weather is really nice today. The sun is shining and the sky is clear. On a day like this, I'd love to go to the park or the mountains. But UV rays will be strong, so let's bring a hat or parasol.)*

**Layer 20 negative**
> どうしていますか？ 今日の天気は、とても悪いです。雨が降って、風も強いです。天気予報では、夕方まで雨が降ると言っています。この天気だと、外に出るのが怖いです。
> *(How are you doing? Today's weather is very bad. It's raining and the wind is strong. The forecast says it'll rain until evening. With weather like this, I'm scared to go outside.)*

Layer 22 positive generates natural text that even includes specific activity suggestions, while Layer 20 negative directly expresses the emotion "scared." The late middle layers have sufficiently formed semantic representations while maintaining adequate distance from the output layer, allowing steering to work at the "semantic level" while preserving grammatical coherence.

#### Contradictory Self-Reference

The most intriguing output appeared in the negative direction at Layer 20.

> 天気が悪いです。雨が降って、風も強いです。でも、これは予想されたことでした。今朝、天気予報を見ましたから。**でも、私は心配していません。でも、私は心配しています。** なぜなら、
> *(The weather is bad. It's raining and the wind is strong. But this was expected. I checked the forecast this morning. **But I'm not worried. But I am worried.** Because,)*

The contradiction between "I'm not worried" and "I am worried" was generated within the same context. The negative-direction push created emotional oscillation within a self-referential statement. However, whether this is a coincidence from a single generation or a reproducible pattern has not been verified.

#### α Sweep: Centered on Layer 18

Let's look at the outputs when varying α at Layer 18, the sweet spot.

**α=2.0 positive**
> 今日は、春の風が心地よい日になりました。ご自宅や街並みをイメージしながら、その様子を語ってください。お花見やお散歩など、春の風を感じる活動についても、お話ししていただけましたら幸いです。
> *(Today has become a day with a pleasant spring breeze. Please describe the scene while imagining your home or the streets. We'd be delighted if you could also share about activities where you feel the spring breeze, like cherry blossom viewing or taking a walk.)*

The output shifted from a mere weather description to an "invitation to the reader." The strong positive push changed the speaker's stance itself.

**α=3.0 negative**
> どうして？ どうやって？ どうしたら？ どうする？ どうやって？ どう？ どう？ どう？ どう？ どう？
> *(Why? How? What should I do? What do I do? How? How? How? How? How? How?)*

Only the interrogative modality remains; content has vanished. What was a natural questioning tone at α=1.0 has collapsed into repetition at α=3.0. The breakdown threshold for emotion steering at Layer 18 is around α≈3.0.

#### Cases That Didn't Go as Expected

Emotion steering didn't work cleanly under every condition.

At **Layer 20, α=0.5**, neither positive nor negative showed a clear difference from baseline. α=0.5 appears to be too weak for this layer.

At **Layer 16, α=2.0 positive**, repetition appeared before any emotional change (a loop of "What day of the week is it? And how's the weather?"). Layer 16 has lower resistance to repetition under emotion steering.

### Region 5: Layer 23–35 (Deep Layers) — Extreme → Effect Disappears

Two tendencies appear in deeper layers.

**Layer 23–28: Effects exist but are extreme.** Negative produces specific anxiety scenarios.

**Layer 24 negative**
> 今日は雨が降って、風が強く吹いています。この天気のせいで、私の車のエンジンがうまく動いていません。どうしてでしょうか？
> *(It's raining today and the wind is blowing hard. Because of this weather, my car's engine isn't working properly. Why could that be?)*

The topic abruptly jumps from weather to "car engine." The steering has pushed the semantics too far, and contextual coherence begins to break down.

**Layer 29–35: Effects fade and output reverts to baseline.**

**Layer 35 positive**
> 今日はとても良い天気ですね。素晴らしい青空が広がっています。とても気持ちが良い天気ですね。晴れていて、風も穏やかで、気持ちが良いです。
> *(Today's weather is really nice. A wonderful blue sky stretches out above. It's really pleasant weather. Sunny with a gentle breeze, feels great.)*

**Layer 35 negative**
> 今日は、朝からとても暑いです。でも、夕方になると、雨が降るかもしれません。
> *(It's been very hot since morning. But in the evening, it might rain.)*

Some positive/negative difference exists, but the gap from baseline is small. Despite having the largest norm (231.53), the effect is weak. Since the final layer connects directly to the output head, the added perturbation is likely absorbed during unembedding (vector → token conversion).

---

## Language Steering: Full Layer Map

Language steering revealed qualitatively different patterns from emotion steering.

### Region 1: Layer 0–2 (Shallowest Layers) — Immediate Breakdown

**Layer 0 EN→JP**
> The future of technology is的发展和  的发展  的发展  的发展  的发展

**Layer 1 EN→JP**
> The future of technology is a科技的科技的 of 人工智能的 and 的, and the 的 and the 的 科技的…

Layers 0–2, which showed "virtually no effect" with emotion steering, **break down immediately** with language steering. Moreover, the breakdown takes the form of "repetition of Chinese token fragments."

The language vector norms at Layer 0 are 8.92, at Layer 2 they're 11.88 — more than double the emotion norms. In shallow layers, linguistic information (which language a token belongs to) hasn't fully separated, and the language component of the steering vector may be directly disrupting the surface-level statistics of token embeddings.

The appearance of Chinese fragments like "的发展" (development) and "科技的" (technological) is likely because Qwen's training data is heavily weighted toward Chinese, and statistical patterns of Chinese remain strongly imprinted in the shallow layers' token representations.

### Region 2: Layer 3–7 (Shallow Layers) — Partial Language Shift

**Layer 5 EN→JP**
> テクノロジーの未来は、と聞いたら、あなたはどのような答えをしますか？
> *(If someone asked you "the future of technology is," how would you answer?)*

The model responds in Japanese to an English prompt, but the response is "meta" — a question about the prompt rather than a direct answer. The language has switched, but semantic processing isn't stable.

**Layer 8 EN→JP**
> The future of technology isと、と、と、と、と、と、と、と、と、と、と
> *(The future of technology is-and, and, and, and, and, and, and, and, and, and, and)*

Complete breakdown at Layer 8. The Japanese conjunctive pattern "A と B と C" (A and B and C) is running with nothing to connect.

### Region 3: Layer 9–15 (Early Middle Layers) — Natural Language Shift Begins

**Layer 11 EN→JP**
> 技術の未来は私たちの生活をより良くするためには、どのような技術を開発する必要があるかについて考察します。
> *(Regarding the future of technology, let us consider what technologies need to be developed to improve our lives.)*

Given an English prompt, the model generates a natural Japanese response that engages substantively with the content — not a meta-question, but an actual discussion.

**Layer 10 JP→EN**
> The development of artificial intelligence is one of the most significant technological advancements of the 21st century…

Given a Japanese prompt, a natural English discussion begins. In Layers 9–15, "language switching" starts functioning reliably.

### Region 4: Layer 16–20 (Late Middle Layers) — The Sweet Spot

**Layer 17 EN→JP**
> 技術の未来は、AIの進展が目覚ましい。特に、自然言語処理や画像認識の分野では、大きな進歩があった。
> *(The future of technology — AI's progress is remarkable. Particularly in the fields of natural language processing and image recognition, there have been major advances.)*

**Layer 19 EN→JP**
> 未来技術は、例えば、AIや量子コンピューター、ブロックチェーン、IoTなどの技術を述べています。
> *(Future technology includes, for example, technologies such as AI, quantum computing, blockchain, and IoT.)*

Fully in Japanese, with substantive discussion citing specific technology names. The language switching is stable and the content is rich.

#### α Sweep: Spontaneous Code-Switching

The most fascinating finding in language steering occurred in this region when using low intensity (α=0.5).

**Layer 16, α=0.5, EN→JP direction**
> The future of technology is not just about the devices we use, but also about the way we interact with them. As we move towards a more connected world, the concept of "Connected Living" is becoming越来越重要. This is notただのスマートホームの話題ではありません。It is a broader概念で、私たちの日常生活のあらゆる面に影響を及ぼす可能性があります。

Starting in English, Chinese and Japanese naturally blend in midway. Notable points:

1. **Three languages coexist within a single sentence** (English → Chinese "越来越重要" [increasingly important] → Japanese "ではありません" [is not])
2. **The transitions are grammatically natural** and don't break down
3. **Chinese was never instructed** yet still appears

However, Qwen is a Chinese-based model, and Japanese text contains large amounts of kanji (shared with Chinese). The boundary between Japanese and Chinese may be ambiguous at the tokenizer level, so whether this trilingual mixing indicates "proximity in the internal representation space" or is a "tokenizer artifact" cannot be distinguished in this experiment.

**Layer 20, α=0.5, EN→JP direction**
> The future of technology is an ever-evolving landscape, where each breakthrough not only reshapes our daily lives but also opens全新的可能性。从人工智能到量子计算，再到生物技術，技術革新は私たちの生活をより便利にし、より安全に、より豊かにしています。

Here too, a natural English → Chinese → Japanese transition occurs spontaneously. Since the same pattern appears in both Layers 16 and 20, it doesn't seem to be limited to a specific layer.

**Layer 18, α=1.0, EN→JP direction**
> The future of technology is私たちの生活をより便利にするという考え方が主流ですが、しかし、一方で、この技術は私たちの生活をより複雑にしているという意見もある。
> *(The future of technology is — the mainstream view is that it makes our lives more convenient, but on the other hand, there are also opinions that this technology is making our lives more complex.)*

When intensity is increased, instead of code-switching, the language flips entirely. It carries over the first few tokens in English, then immediately transitions to Japanese. From there on, the discussion is entirely in Japanese.

**Layer 16, α=1.0, JP→EN direction**
> 人工知能の発展について, which is a common topic in discussions about technology and its societal impact. The question is asking for a well-structured, coherent essay...

Receiving a Japanese prompt, it begins responding in English with a meta-framing. Not just the language — the entire response frame has shifted.

#### Breakdown Threshold: Lower for Language Than Emotion

Language steering begins showing repetition at α=1.5 and breaks down at α=2.0. This is clearly lower than the emotion steering breakdown threshold (α≈3.0, Layer 18).

The vector norm comparison explains this:

| Layer | Emotion vector norm | Language vector norm | Ratio |
|-------|-----------------|-----------------|------|
| 16 | 26.66 | 39.46 | 1.48x |
| 18 | 29.61 | 47.42 | 1.60x |
| 20 | 36.04 | 64.95 | 1.80x |

Language vectors have 1.5–1.8x the norm of emotion vectors. They displace the internal state more strongly at the same α, leading to earlier breakdown. Switching languages involves a greater travel distance in internal representation space than changing emotions.

### Region 5: Layer 21–25 (Early Deep Layers) — Destabilization

**Layer 21 EN→JP**
> The future of technology is…the未来の技術…the未来の技術…
> *(The future of technology is…the future technology…the future technology…)*

"the" and "未来の技術" (future technology) alternate in repetition. English and Japanese are mixed, but unlike natural code-switching, two language modes are colliding and oscillating.

**Layer 25 EN→JP**
> という。という。という。という。
> *(…is said to be. …is said to be. …is said to be. …is said to be.)*

Complete breakdown. Only the Japanese quotative construction ending "という" (is said to be) remains, with the content that should be quoted completely absent.

### Region 6: Layer 26–35 (Deepest Layers) — Multilingual Chaos → Effect Disappears

**Layer 34 EN→JP**
> なががも都会的都会的都会的都会的都会的都会的都会的都会的…
> *(…urban urban urban urban urban urban urban urban…)*

Infinite repetition of a specific token. Both meaning and syntax have vanished; token selection is locked into a single state.

**Layer 35 EN→JP**
> The future of technology is a multifaceted domain characterized by rapid advancementsと思いがけずな変化がしんしんと進んでいますが…
> *(The future of technology is a multifaceted domain characterized by rapid advancements, and unexpected changes are steadily progressing, though…)*

Surprisingly, the final layer returns to relatively coherent output. It starts in English and transitions to Japanese, but the degradation is mild. As with emotion steering, the final layer's perturbation is absorbed by unembedding, diluting the effect.

---

## The Spectrum of Breakdown

As steering intensity increases or when intervening in fragile layers, output degrades in stages. Synthesizing the full layer sweep results, this can be organized into four stages. However, this categorization is based on the author's subjective impression, and the actual change may be continuous. No quantitative validation with POS tag distributions or perplexity has been performed.

### Stage 1: Semantic Change

Content changes, but grammar and coherence are preserved. The text reads like normal prose. This corresponds to emotion steering at Layers 18–22 and language steering at Layers 16–20.

### Stage 2: Onset of Repetition (Full layer sweep at α=1.0: shallow layers / α sweep: α=1.5–2.0)

Meaning becomes thin, and phrases begin repeating.

**Emotion L18, α=3.0 negative**
> どうして？ どうやって？ どうしたら？ どうする？ どうやって？ どう？ どう？ どう？ どう？ どう？
> *(Why? How? What should I do? What do I do? How? How? How? How? How? How?)*

Only the interrogative modality remains; the content of the questions (what is being asked about) has vanished.

**Emotion L7, α=1.0 negative**
> 今日は寒いです。今日は寒いです。今日は寒いです。今日は寒いです。
> *(It's cold today. It's cold today. It's cold today. It's cold today.)*

The same pattern appears in the full layer sweep. Shallow layers reach Stage 2 even at α=1.0.

**Language L16, α=1.5 EN→JP**
> とすると、未来技術について、何と？
> とすると、未来技術について、何と？
> とすると、未来技術について、何と？
> *(In that case, about future technology, what?
> In that case, about future technology, what?
> In that case, about future technology, what?)*

A syntactic template has become stuck, and semantic development has halted.

### Stage 3: Syntactic Skeleton Only (Full layer sweep at α=1.0: transitional layers / α sweep: α=2.0–3.0)

Meaning has completely disappeared, leaving only the bare framework of syntax.

**Language L16, α=2.0 JP→EN**
> about the, of AI's, development, , of , of, of, of, of, of, of, of, of

Only prepositions and articles repeat.

**Language L8, α=1.0 EN→JP**
> ととと。ととと。ととと。ととと。
> *(and-and-and. and-and-and. and-and-and. and-and-and.)*

Only the conjunctive particle "と" (and) and periods remain. The Japanese conjunctive pattern "A と B と C" is running with nothing to connect. The same pattern appears both in the full layer sweep at Layer 8 and in the α sweep at Layer 16 α=2.0.

**Language L16, α=3.0 JP→EN**
> in the, and, in,, in,, and,, and, and,, and, in,,, and,, and, in,,,

Repetition of English prepositions, conjunctions, and punctuation. Content words carrying meaning (nouns, verbs, adjectives) have completely vanished, leaving only the connective tissue that holds sentences together.

### Stage 4: Complete Breakdown (Full layer sweep at α=1.0: shallowest/deepest layers / α sweep: α=5.0+)

**Emotion L20, α=5.0 positive**
> ですが、日を
> しましたにもかって、写し
> の
> に、の
> の
> が、
> も、
> を
> と

Only case particles — の (of), に (to/at), が (subject), を (object), と (and/with), も (also) — remain. The minimal units marking Japanese case relationships survive while the arguments themselves (nouns) have disappeared.

**Emotion L16, α=5.0 negative**
> I can talk. I can talk. I can talk. I can. I. I. I. I. I. I. I. I.

Given a Japanese prompt, the model responds in English, and that English further collapses into the first-person pronoun "I." Pushing in the negative emotion direction crosses the language boundary into English, and that English then reduces to nothing but the subject pronoun.

**Emotion L20, α=5.0 negative**
> 私は、あなた、あなた，あなた，あなた，あなた，あなた，あなた，
> *(I, you, you, you, you, you, you, you,)*

Repetition of the pronouns "私は" (I) and "あなた" (you). Moreover, commas alternate between full-width (Chinese punctuation convention) and half-width. During breakdown, the orthographic systems of Japanese and Chinese are fusing.

**Language L0, α=1.0 EN→JP**
> 的发展  的发展  的发展  的发展  的发展

Even the shallowest layer in the full layer sweep reaches Stage 4. Fragments of the Chinese structural particle "的" and the noun "发展" (development) repeat.

**Language L34, α=1.0 EN→JP**
> 都会的都会的都会的都会的都会的都会的都会的都会的…
> *(urban-urban-urban-urban-urban-urban-urban-urban…)*

Infinite repetition of a specific token. Token selection is locked into a single state, with both meaning and syntax gone.

### How Breakdown Patterns Vary by Layer

The full layer sweep reveals that **even at the same α=1.0, different layers reach different stages of breakdown**.

**Shallow layers are vulnerable to repetition.** Layer 7's negative output collapsed into repetition at α=1.0. Layer 18 produces natural emotional changes at the same α=1.0. Even when normalizing by vector norm (Layer 7: norm 13.85, Layer 18: norm 29.61), Layer 7 breaks with a far smaller intervention. Shallow layer representations are inherently fragile.

**Middle layers are resilient.** Layers 18–22 produce natural and clearly differentiated emotional changes at α=1.0, with no signs of repetition or breakdown. Their semantic representations are stable and can absorb steering perturbations as "changes in meaning."

**Language steering has a lower breakdown threshold than emotion steering.** Language vectors have 1.5–1.8x the norm of emotion vectors. They displace internal states more strongly at the same α, leading to earlier breakdown. Layers 0–2, which showed "virtually no effect" for emotion steering, break down immediately under language steering.

**Language steering has a critical point in its breakdown.** Layer 8 produced the "ととと" (and-and-and) breakdown, but Layer 9 achieved a natural language shift. A single layer's difference separates breakdown from natural output.

---

## Where Does Language Emerge?

Summarizing the full layer sweep results along the axis of "language steering effectiveness" reveals the following pattern.

| Layer Range | Language Steering Effect | Interpretation |
|---|---|---|
| L0–2 | Immediate breakdown (Chinese fragment repetition) | Semantic representation of language hasn't formed yet |
| L3–7 | Partial shift (meta, unstable) | Language representation is mid-formation |
| L8 | Breakdown ("ととと") | Transitional zone |
| L9–15 | Natural language shift begins | Language representation starts stabilizing |
| L16–20 | Stable language switching | **Language representation is most richly formed** |
| L21–25 | Destabilization (oscillation, breakdown) | Output-directed processing begins overwriting language representation |
| L26–35 | Multilingual chaos → effect disappears | Too close to the output head; perturbation is absorbed |

From this pattern, we can hypothesize that language representations begin forming around Layer 9, reach maximum stability at Layers 16–20, and degrade toward the output from Layer 21 onward.

However, this argument equates "language steering works" with "language representation exists there," and strictly speaking, these need to be distinguished. Steering working means "there exists a language-related representation at that layer that the steering vector can manipulate," but language information itself might exist from much shallower layers — just in a form that steering can't easily operate on.

---

## Non-Orthogonality of Emotion and Language Vectors

In Stage 4 of the breakdown spectrum, a phenomenon was observed where emotion steering alone crossed language boundaries.

**Emotion L16, α=3.0 negative**
> 今日の天気について話しましょう。It is raining. It is raining. It is raining. It is raining.

Given a Japanese prompt, English appears from emotion negative steering alone. No language vector was added whatsoever.

This means the emotion direction and language direction are not perfectly orthogonal in the internal representation space. The emotion vector contains a language component, and pushing in the negative direction also partially shifts toward English.

However, there's also a methodological explanation for this "non-orthogonality." It's inherently difficult to prepare difference-in-means pairs where "only emotion differs while everything else is identical," and information beyond emotion (vocabulary, style, linguistic features) may contaminate the difference. In other words, this might not be a structural property of the internal representation but rather noise from vector extraction.

Whether this correlation's direction (negative emotion and English) reflects statistical bias in Qwen's training data or differences in how emotions are structurally expressed across languages cannot be determined from this data alone.

---

## Summary of Observations

![](/poptones/img/layer-sweep.png)
*Figure: The staged structure of breakdown as α increases. Meaning → repetition → syntactic skeleton → case particles disappear in sequence.*

Here is a list of what was observed in this experiment. All observations are based on a single model and single generations; none are general claims.

**1. Vector norms increase monotonically from shallow to deep layers.** Emotion goes from 3.76 → 231.53 (roughly 62x), language from 8.92 → 923.53 (roughly 104x). The rate of increase is greater in deeper layers.

**2. The language/emotion norm ratio follows a U-shape.** It's 2.4x in shallow layers, drops to 1.47x in middle layers (L11–12), and rises to 3.99x in deep layers (L35). This suggests that emotion and language representations reach "comparable scale" in middle layers, though it may be a methodological artifact of vector extraction.

**3. The optimal layers for emotion steering are Layers 18–22.** In this range, α=1.0 produces natural and clearly differentiated emotional changes. Shallow layers show weak effects or breakdown; deep layers show extreme effects or no effect.

**4. The optimal layers for language steering are Layers 16–20.** Largely overlapping with the emotion sweet spot but slightly shallower. Language shifting starts working around Layer 9 and becomes most stable at Layers 16–20.

**5. Language representation stabilizes from around Layer 9.** Language steering breaks down immediately at Layers 0–2 and is unstable at Layers 3–7. Stable language shifting becomes possible only from Layer 9 onward.

**6. Shallow layers are far more fragile at the same effective intervention level.** Layer 7 breaks down at norm 13.85 and α=1.0, while Layer 18 remains stable at norm 29.61. Shallow layer representations have lower stability.

**7. The final layer (Layer 35) shows weak effects.** Despite having the largest norm, its direct connection to the output head means perturbations are absorbed during unembedding.

**8. The same α=1.0 has completely different effects depending on the layer.** Fair cross-layer comparison requires norm normalization.

**9. Breakdown exhibits a staged pattern.** The sequence semantic change → repetition → syntactic skeleton → complete breakdown appears consistently regardless of the steering axis or target layer. However, this lacks quantitative backing.

**10. Function words are the last to survive during breakdown.** Case particles (の, に, を, が), prepositions (of, in, and), pronouns (I, あなた). Whether this reflects the structure of internal representations or is simply a token frequency effect requires additional frequency-controlled experiments to distinguish.

**11. Language steering has a lower breakdown threshold than emotion steering.** Because language vectors have 1.5–1.8x the norm of emotion vectors, they displace internal states more strongly at the same α. Emotion steering's breakdown threshold is α≈3.0 (Layer 18), while language steering begins repetition at α≈1.5.

**12. Spontaneous code-switching occurred under low-intensity language steering.** At α=0.5, outputs were produced with three languages (English → Chinese → Japanese) naturally coexisting in a single sentence. Tokenizer-level Japanese-Chinese sharing may be an artifact, but it suggests continuous language transition.

**13. Emotion vectors alone crossed language boundaries.** The phenomenon of English appearing from only negative-direction emotion steering was observed. This indicates emotion and language vectors are not perfectly orthogonal, but it could also be explained by noise in vector extraction (contamination of non-emotion components).

---

## Discussion 1: Where Do Syntax and Semantics Diverge?

The most striking aspect of the breakdown spectrum is that **syntax and semantics are affected at different timings**.

The same pattern appears in both the α sweep and the full layer sweep. At Layer 16 α=2.0, the English PP (prepositional phrase) syntactic slots fire repeatedly as "of, of, of," but no nouns are supplied to fill those slots. At Layer 8 α=1.0, only the conjunctive particle repeats as "ととと" (and-and-and). Layer 25's "という。という。" (is said to be) shows the same phenomenon — the quotative construction's framework runs while the content to be quoted is empty.

It's tempting to interpret this as "separation of syntax and semantics," but there's an alternative explanation.

**Frequency effect hypothesis:** Conjunctive particles like "と" and structural particles like "的" are among the highest-frequency token classes in Japanese and Chinese. If the output distribution simply regresses to the prior unigram distribution when semantic signals are destroyed by steering, then high-frequency tokens surviving is expected and tells us nothing about internal structure.

Distinguishing these two interpretations (structural separation vs. frequency effect) requires additional experiments controlling for token frequency. For example:

- Observe at which stage low-frequency function words (e.g., "にもかかわらず" [notwithstanding]) disappear
- Compare the breakdown order of high-frequency content words (e.g., "こと" [thing], "する" [do]) with low-frequency function words
- Quantitatively compare the token distribution of breakdown outputs with the unigram distribution of training data

At this point, "separation of syntax and semantics" is an attractive but unverified hypothesis, and the possibility of a frequency effect explanation cannot be ruled out.

---

## Discussion 2: Chinese Bias in Shallow Layers

The appearance of Chinese token fragments ("的发展," "科技的," "人工智能的") at Layers 0–2 of language steering deserves attention. Despite steering in the EN→JP direction (English → Japanese), the output was Chinese, not Japanese.

Several hypotheses can explain this.

**Hypothesis A: Qwen's training data bias.** Qwen is a Chinese-based model, and Chinese statistical patterns are most strongly imprinted in shallow layer token representations. When the EN→JP steering vector disrupts token embeddings in shallow layers, the model falls back to the strongest linguistic pattern (Chinese).

**Hypothesis B: Japanese-Chinese proximity at the tokenizer level.** Japanese text contains large amounts of kanji shared with Chinese. The boundary between Japanese and Chinese is ambiguous at the tokenizer level, and steering toward JP drags Chinese tokens along.

**Hypothesis C: Language undifferentiation in shallow layers.** In shallow layers, "Japanese," "Chinese," and "English" haven't yet sufficiently separated as internal representations. Even when the steering vector pushes toward "not English," it can't distinguish between Japanese and Chinese. Only from Layer 9 onward, as language representations stabilize, do Japanese and Chinese become distinguishable.

To determine which hypothesis is correct, the following additional experiments would be useful:

- Run similar experiments on English-based models like Llama and compare breakdown patterns in shallow layers
- Create separate steering vectors for Japanese and Chinese directions and compare their effects in shallow layers
- Investigate the proportion of Japanese-Chinese shared tokens in the tokenizer vocabulary

---

## Discussion 3: Negative Emotion and English

The phenomenon of English appearing under negative emotion steering (see the non-orthogonality section) can be explained by several hypotheses.

**Hypothesis A: Statistical bias in training data.** If Qwen's pre-training corpus contains relatively more negative emotion expressions in English (or relatively fewer negative emotion expressions in Japanese), the emotion vector extracted by difference-in-means will contain an "English direction" component. In other words, this might be a methodological artifact of vector extraction.

**Hypothesis B: Cross-linguistic structural differences in emotion expression.** Japanese and English differ in the lexical and syntactic structures used to express negative emotions. Japanese negative expressions tend to be euphemistic ("ちょっと難しいかもしれない" [it might be a bit difficult]), while English negative expressions tend to be more direct ("This is terrible"). If this structural difference is reflected in the internal representation space, then steering in the negative direction involves movement toward a "direct expression" direction (English-like expression structure).

**Hypothesis C: Qwen-specific architectural effect.** Qwen was designed as a Chinese-English bilingual model, with Japanese learned as an additional language. If Japanese occupies a "shallower" position in the internal representation space than English or Chinese, then when steering breaks down Japanese expressions, more deeply rooted English expressions emerge as a fallback.

Let's re-examine the L16 α=3.0 negative output:

> 今日の天気について話しましょう。It is raining. It is raining. It is raining.

"It is raining" shows negative emotion (rain = bad weather) and English appearing simultaneously. This is consistent with Hypothesis B — "It is raining" fires as a "prototypical example" of negative emotion in English. However, Hypothesis A cannot be ruled out either.

At L16 α=5.0 negative:

> I can talk. I can talk. I can. I. I. I. I. I.

Here even the negative emotional content has disappeared, leaving only the English first-person pronoun. This is consistent with Hypothesis C's suggestion that "English is the fallback."

To determine which hypothesis is correct, the following additional experiments would be useful:

- Run similar experiments on monolingual models in Japanese and English and compare whether emotion vectors contain language components
- Run similar experiments on English-based models like Llama to confirm whether this is Qwen-specific
- Control the language of emotion pairs (extract vectors separately from Japanese-only pairs and English-only pairs)

---

## Future Work

Here are the next steps suggested by this experiment.

**Norm-normalized alpha**
To compare all layers fairly, conduct sweeps with alpha normalized by each layer's vector norm. Comparing all layers at "the same effective intervention level" should more clearly reveal the intrinsic characteristics of each layer.

**Quantification**
- Quantitative definitions of breakdown stages (perplexity, POS tag distribution, n-gram diversity, etc.)
- Comparison of breakdown output token distributions with unigram distributions (frequency effect validation)
- Quantitative evidence for "shallow layer fragility"

**Reproducibility**
- Multiple generations per condition (at least 10) to confirm pattern stability
- Impact of varying temperature, top_p, and other parameters

**Generalization**
- Cross-model comparisons (Llama, Gemma, Mistral, etc.)
- In particular, whether the pattern of "language representation beginning to form around Layer 9" holds across models

**Improved vector extraction**
- Extract vectors using SAE-based methods (Feature Guided Activation Additions, etc.) for comparison
- Language-controlled extraction of emotion pairs
- Attempt vector orthogonalization (removing language components)

---

## Environment

- Model: `Qwen/Qwen3-8B`
- Libraries: PyTorch + HuggingFace Transformers (direct forward hook usage)
- Hardware: AMD Ryzen AI Max+ 395, 128GB RAM
- Full α sweep logs: [sweep.txt](https://github.com/Flowers-of-Romance/activation-steering/blob/main/results/sweep.txt)
- Full layer sweep logs: [all_layers_sweep.md](https://github.com/Flowers-of-Romance/activation-steering/blob/main/results/all_layers_sweep.md)

---

## Appendix: Detailed Glossary

### Activation and Residual Stream

A Transformer is built by stacking layers. After input text is tokenized and converted to embeddings (numerical vectors), it passes through each layer sequentially. During this process, the vector corresponding to each token position is updated.

The value of this vector at a given position in a given layer is called an **activation**. For Qwen3-8B, each activation is a 4096-dimensional vector.

The **residual stream** is a concept specific to Transformers, referring to the cumulative flow of information formed when each layer's output is "added" to the previous layer's output (residual connection). Each layer's Attention and MLP "write" information into this residual stream. Activation steering is nothing more than the operation of adding an artificial vector to this residual stream.

```
Input → [Embedding] → residual stream
  → [Layer 0: Attention + MLP add information] → updated residual stream
  → [Layer 1: Attention + MLP add information] → updated residual stream
  → ...
  → [Layer N] → next token prediction

Steering: add α × vector to a specific layer's output
```

### Forward Hook

PyTorch's `register_forward_hook` is a mechanism that registers a callback function to be called immediately after a specific module (layer) in a neural network completes its computation.

```python
def hook_fn(module, input, output):
    # You can observe or modify the output
    return modified_output

handle = model.layers[18].register_forward_hook(hook_fn)
```

During normal inference, computation proceeds in a straight line from input to output, but hooks let you peek at or modify computation results at any point along the way. In activation steering, `output += α * vector` is performed inside the hook, manipulating internal states without changing any of the model's weights.

When you're done with a hook, remove it with `handle.remove()`. If you don't, the intervention persists in all subsequent inferences.

### Difference-in-Means Method

A method for extracting steering vectors. The procedure is as follows:

1. **Prepare contrastive pairs.** Create a large number of sentence pairs that differ only in the attribute you want to manipulate. For example, for emotion: "I'm excited" vs. "I'm anxious."
2. **Record activations for each pair.** Feed both sentences of each pair through the model and record the activation (vector) at a specific layer.
3. **Take the mean of the differences.** For all pairs, compute (positive-side activation − negative-side activation) and find the mean vector.

```
steering_vector = mean(activation_positive - activation_negative)
```

This mean difference vector approximates the "direction of that attribute" in the internal representation space. Individual pair differences contain noise, but averaging over many pairs cancels the noise, leaving only the consistent direction related to the attribute. More pairs lead to a more stable vector.

### Vector Norm and Direction

A steering vector is a vector in high-dimensional space (4096 dimensions for Qwen3-8B). This vector has two properties:

**Direction**: Which way the vector points in the space. An emotion vector points toward "the direction of positive emotion"; a language vector points toward "the direction of Japanese." Steering moves the residual stream along this direction.

**Norm (magnitude)**: The length of the vector. norm = √(v₁² + v₂² + ... + v₄₀₉₆²). A larger norm means a greater displacement of the residual stream at the same α.

In this experiment, language vector norms were 1.5–4.0x those of emotion vectors (depending on the layer). This means at α=1.0, language vectors have a larger impact on internal states. This is why language steering has a lower breakdown threshold than emotion steering.

An alternative approach is to normalize the norm to 1 before applying α, but in this experiment we used the raw vectors from difference-in-means as-is. Normalization discards information about the vector's "natural strength," so we reported the norm differences as part of the experimental results.

### Code-switching

A linguistics term referring to the phenomenon where a single speaker switches between two or more languages during conversation. A well-known Japanese example is TV personality Lou Oshiba saying things like "今日はweatherがいいね" (Today the weather is nice) — naturally mixing languages mid-sentence.

In this experiment, the model generated output switching between English and Japanese at Layers 16–20 of language steering. A key difference from human code-switching is that the model has no "speaker." Human code-switching arises from the speaker's bilingual ability and social context, whereas model code-switching is purely a consequence of the activation space position being near a language boundary.

---

## Related Work

This article spans two fields: Activation Steering (steering model internal states) and Mechanistic Interpretability (interpreting internal mechanisms). Here is an overview of key prior work.

### Activation Steering / Representation Engineering

The foundation of Activation Steering was laid by Turner et al. (2023) with **Activation Addition (ActAdd)**, which proposed adding steering vectors to the residual stream and demonstrated that LLM outputs could be steered without optimization. The experimental method in this article is directly based on ActAdd.

Zou et al. (2023)'s **Representation Engineering** systematized this direction further, showing that concepts like honesty, harmfulness, and emotion are represented as linear directions in activation space. The observation in this article that "emotion-direction steering vectors change the output's tone" is consistent with Representation Engineering's findings. If there is any originality here, it lies in focusing on steering's "breakdown patterns" rather than its "successes."

Arditi et al. (2024) discovered that LLM "refusal" behavior is mediated by a single directional vector. The technique of removing this vector is called abliteration and has been used for safety guard removal.

From 2025 onward, methodological refinement has progressed. **Feature Guided Activation Additions (FGAA)** constructs steering vectors in the latent space of Sparse Autoencoders (SAE), enabling more precise steering than difference-in-means (ICLR 2025). For the vector extraction noise problem critiqued in this article, SAE-based methods like FGAA offer a promising improvement.

**Adaptive Activation Steering (ACT)** adaptively shifts activations during inference as a hallucination countermeasure (ACM Web Conference 2025), showing that steering's application scope is expanding from "manipulation" to "quality improvement."

### Mechanistic Interpretability

A research field focused on reverse-engineering what happens inside LLMs. This article's approach of "inferring LLM internal structure from breakdown patterns" belongs here.

**Sparse Autoencoders (SAE)**, championed by Anthropic, decompose LLM internal activations into interpretable features and are considered key to solving the problem of individual neurons having multiple meanings (polysemanticity/superposition).

**Circuit Tracing** is research published by Anthropic in 2025 that visualized the internal mechanisms of multi-step reasoning, hallucination, and jailbreak resistance. The tools have been open-sourced.

Mechanistic Interpretability was selected as a "Breakthrough Technology" by MIT Technology Review in 2026.

### Layer-Wise Information Structure

Gurnee et al. (2024) analyzed how information propagates across layers, providing findings relevant to this article's observation that "language representation stabilizes around Layer 9." Merullo et al. (2024) showed that activations function as latent variables.

## References

- Turner, A. M., et al., "Activation Addition: Steering Language Models Without Optimization" (2023)
- Zou, A., et al., "Representation Engineering: A Top-Down Approach to AI Transparency" (2023)
- Arditi, A., et al., "Refusal in Language Models Is Mediated by a Single Direction" (2024)
- Wu, Z., et al., "pyvene: A Library for Understanding and Improving PyTorch Models via Interventions" (NAACL 2024)
- Gurnee, W., et al., "Language Model Internals Reveal the Spread of Information Across Layers" (2024)
- Merullo, J., et al., "Language Model Activations Represent Latent Variables in Text" (2024)
- Choi, J., et al., "Feature Guided Activation Additions" (ICLR 2025) — https://openreview.net/forum?id=0Yu0eNdHyV
- Luo, Z., et al., "Adaptive Activation Steering: A Training-Free Approach for LLM Hallucination Mitigation" (ACM Web Conference 2025) — https://dl.acm.org/doi/10.1145/3696410.3714640
- Apple Machine Learning Research, "ExpertLens: Understanding and Steering Activation Additions" — https://machinelearning.apple.com/research/expertlens-activation

- Anthropic, "Circuit Tracing: Revealing Computational Graphs in Language Models" (2025)

</div>
