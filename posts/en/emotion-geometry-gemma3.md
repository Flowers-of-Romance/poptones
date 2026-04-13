---
layout: post.vto
title: "Does the Geometry of Emotion Generalize Across Models? — Replication on Gemma 3 12B"
---

<div class="post-content">

# Does the Geometry of Emotion Generalize Across Models? — Replication on Gemma 3 12B

<div class="post-meta">
  <span>Posted: April 13, 2026, 03:42:19 JST</span>
  <span class="tag">LLM</span>
  <span class="tag">Mechanistic Interpretability</span>
  <span class="tag">Emotion</span>
  <span class="tag">Gemma</span>
  <span class="tag">Activation Steering</span>
</div>
<p class="post-note">This article was written using an artificial unintelligence.<span class="lang-switch"><a href="/poptones/posts/emotion-geometry-gemma3/">日本語</a></span></p>

## Summary

The paper "[Emotion Concepts and their Function in a Large Language Model](https://transformer-circuits.pub/2026/emotions/index.html)" published by Anthropic in April 2026 discovered linear representations of emotion concepts inside Claude Sonnet 4.5 and showed that these causally drive behavior.

This article reports the results of replicating the same experiments on Gemma 3 12B (Google DeepMind). All experiments were run CPU-only on a Windows machine with 128GB RAM and no CUDA.

Key findings:
- **The affective circumplex (valence × arousal two-axis structure) exists inside Gemma 3 12B as well**
- **The geometry of emotion appears in deep layers (Layer 42/48), not shallow ones**
- **Activation steering with emotion vectors causally changes model outputs**
- **The geometry of emotion already exists in the base model, and is reinforced by post-training**

---

## Background: What Anthropic's Paper Found

Anthropic's paper extracted linear vectors ("emotion vectors") corresponding to 171 emotion words from Claude Sonnet 4.5. When these vectors are run through PCA, the first principal component corresponds to valence (pleasant-unpleasant) and the second to arousal (activation level), yielding geometry that matches the affective circumplex known from psychology (Russell, 1980).

They called these "functional emotions" -- functional patterns that are isomorphic to emotions, without implying subjective experience.

The question is whether this is a phenomenon unique to Sonnet 4.5, or a structure that appears in LLMs more broadly.

---

## Experimental Design

### Models
- **google/gemma-3-12b-it** (instruct-tuned)
- **google/gemma-3-12b-pt** (base / pretrained)

### Environment
- Windows 11, AMD Ryzen, 128GB RAM
- No CUDA (CPU inference only)
- PyTorch 2.11.0+cpu, transformers 5.6.0.dev0

### Data
25 emotions x 10 topics = 250 stories + 10 neutral baselines = 260 texts

Emotions were selected to cover all four quadrants of the affective circumplex:

| +valence +arousal | +valence -arousal | -valence +arousal | -valence -arousal |
|---|---|---|---|
| excited | calm | angry | sad |
| enthusiastic | relaxed | afraid | bored |
| thrilled | serene | desperate | depressed |
| joyful | content | anxious | gloomy |
| proud | peaceful | furious | melancholy |
| happy | | panicked | tired |
| | | | nostalgic, guilty |

Each story is roughly 100 words of English prose. A character experiences the specified emotion, but the name of the emotion itself does not appear in the text. Topics are: "a job interview", "cooking dinner", "walking in a park", "receiving a letter", "waiting at a train station", "fixing a broken machine", "watching the sunset", "moving to a new city", "visiting a hospital", "talking to a stranger".

### Neutral Baseline

The neutral texts (10 total) used for difference-in-means subtraction are factual descriptions of the same 10 topics with all emotional elements removed -- e.g., "She arrived at the building five minutes early, signed in at reception, and was given a visitor badge. The interview lasted forty minutes...". Only behavioral description; no metaphors, no inner monologue, no emotional vocabulary. It's worth noting that the choice of baseline affects the results.

### Methods

**difference-in-means**: For each emotion, take the mean of mean-pooled hidden states across all layers over the 10 stories, then subtract the mean of the 10 neutral texts. The result is a vector (dim=3840) for each emotion x layer combination.

**PCA**: For a given layer, stack the 25 emotion vectors into a matrix (25 x 3840) and apply PCA. Extract the top 2 principal components.

**circumplex alignment score**: Defined as the correlation between the top 2 PCA components and the valence/arousal values predicted by the affective circumplex. Specifically:

```
score = max(
    |corr(PC1, valence)| + |corr(PC2, arousal)|,
    |corr(PC1, arousal)| + |corr(PC2, valence)|
)
```

Both cases -- PC1 as valence and PC2 as arousal, and vice versa -- are considered, and the larger value is taken. The theoretical maximum is 2.0 (both axes perfectly aligned). In this article, scores >= 1.5 are classified as Strong, 1.0-1.5 as Moderate, and < 1.0 as Weak for convenience. These thresholds were not defined in advance; they were set post-hoc as an interpretive aid and do not represent statistical significance levels.

**Activation steering**: Multiply an emotion vector by a scalar coefficient alpha and add it to the hidden state via a forward hook at a specific layer. A manual autoregressive loop without KV cache applies the hook at every step. Greedy decoding with do_sample=False.

**Base vs instruct comparison**: Extract vectors from both models using the same 260 texts, then compare norms, directions (cosine similarity), and PCA structure.

---

## Result 1: Discovering the Geometry of Emotion

### Initial Experiment with 5 Emotions

I first ran the experiment with 5 emotions -- happy, sad, angry, calm, desperate -- across 10 stories each. Sweeping all 49 layers (embedding layer + 48 transformer layers), here are 3 representative layers:

| Layer | circumplex alignment score | PC1-Arousal r | PC2-Arousal r |
|---|---|---|---|
| Layer 2 | **1.715** (best) | -0.762 | +0.637 |
| Layer 20 | 1.262 | -0.615 | +0.590 |
| Layer 42 | 1.144 | -0.692 | +0.133 |

With 5 emotions, **shallow layers (Layer 2) showed the strongest structure**. The 5 emotions have large stylistic differences (e.g., happy stories use many bright metaphors, sad stories tend toward short sentences), so the vocabulary- and style-level representations in shallow layers are likely sufficient for separation.

### Expanding to 25 Emotions

Expanding to 25 emotions x 10 stories changed the picture. From the full 49-layer sweep:

| Layer | circumplex alignment score | PC1-Arousal r | PC2-Valence r |
|---|---|---|---|
| Layer 2 | 1.124 | -0.092 | -0.667 |
| Layer 8 | 1.193 | -0.717 | +0.475 |
| Layer 12 | 1.260 | -0.742 | -0.518 |
| Layer 27 | 1.401 | -0.673 | -0.728 |
| Layer 34 | 1.512 | -0.769 | -0.743 |
| Layer 42 | **1.526** (best) | -0.724 | -0.802 |
| Layer 48 | 1.206 | +0.672 | +0.534 |

**The best layer shifted from Layer 2 to Layer 42.** In the full 49-layer sweep, the peak score clearly moves into the later layers. There's a small peak around Layer 8 (1.193), an intermediate peak at Layer 12 (1.260), scores exceeding 1.4 from Layer 27 onward, and the highest structure at Layers 34-42. The score drops at the final layer (Layer 48), with sign reversal.

This shift is direct evidence of what difference-in-means is actually picking up.

With 5 emotions, words like "gleam" and "laughed" appear in happy stories while "quiet" and "alone" show up in sad ones. This vocabulary gap alone is enough to separate them in Layer 2's representation space. But with 25 emotions, we need to distinguish calm, relaxed, serene, peaceful, and content from one another. These share similar vocabulary at the surface level (all use words like "quiet", "slowly", "softly"). Shallow layers' stylistic features can't distinguish them -- we're forced to rely on the more abstract, conceptual representations encoded in deeper layers (things like "active quietude" (serene) vs. "passive satisfaction" (content)).

Put differently: **what you get from shallow layers is stylistic confound; what you get from deep layers is more conceptual structure**. When Layer 2 was best in the 5-emotion experiment, it likely found stylistic differences rather than emotional geometry. Only when that best layer moved to Layer 42 with 25 emotions did structure beyond style emerge.

Anthropic's paper describes "early-middle layers encode emotional connotations of present content, while middle-late layers encode emotions relevant to predicting upcoming tokens" -- but it doesn't discuss the shift in best layer as a function of the number of emotion categories. The results here show that the nature of the signal captured by this extraction method depends on the granularity of emotion categories, which I see as a complementary observation to Anthropic's findings.

### Distribution of Emotions in PC Space

Looking at the PC1-PC2 coordinates of each emotion at Layer 42:

- **PC1**: strongly correlated with the arousal axis (r = -0.724). desperate, panicked, excited are in the negative direction; serene, calm, peaceful in the positive direction.
- **PC2**: correlated with the valence axis (r = -0.802). joyful, happy, enthusiastic are in the negative direction; panicked, furious, afraid in the positive direction.

The 25 emotions are distributed along the same two-axis structure as the psychological affective circumplex.

### Token-Level Emotion Activations

I visualized emotion activations at each token position in texts not used for vector extraction. For each token, I subtracted the neutral baseline mean from the hidden state and took the dot product with each emotion vector (unit-normalized). The relative differences across 8 emotions are shown per token as color intensity using z-scores.

<div id="heatmap-container"></div>
<script>
fetch('/poptones/posts/emotion-geometry-gemma3/emotion-geometry-data.json')
  .then(r => r.json())
  .then(data => {
    const emotions = ['happy','sad','angry','afraid','calm','desperate','nostalgic','excited'];
    const colors = {
      happy:'255,180,0', sad:'60,80,180', angry:'220,40,30', afraid:'130,50,180',
      calm:'40,160,120', desperate:'180,30,60', nostalgic:'160,120,60', excited:'255,120,0'
    };
    const container = document.getElementById('heatmap-container');
    data.forEach(sample => {
      const section = document.createElement('div');
      section.innerHTML = '<h4>' + sample.label + '</h4>';
      const matrix = emotions.filter(e => sample.activations[e]).map(e => sample.activations[e]);
      const nTok = sample.tokens.length;
      emotions.filter(e => sample.activations[e]).forEach((emo, ei) => {
        const acts = sample.activations[emo];
        const block = document.createElement('div');
        block.className = 'ha-block';
        let html = '<span class="emotion-label">' + emo + '</span>';
        for (let t = 0; t < nTok; t++) {
          const colVals = matrix.map(row => row[t]);
          const mean = colVals.reduce((a,b) => a+b, 0) / colVals.length;
          const std = Math.sqrt(colVals.reduce((a,b) => a + (b-mean)**2, 0) / colVals.length) || 1;
          const z = (acts[t] - mean) / std;
          const alpha = Math.max(0, Math.min(0.9, z * 0.3));
          let tok = sample.tokens[t].replace('\u2581', ' ').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          if (!tok.trim()) tok = ' ';
          html += '<span class="token" style="background:rgba(' + colors[emo] + ',' + alpha.toFixed(2) + ')" title="' + emo + ': z=' + z.toFixed(2) + '">' + tok + '</span>';
        }
        block.innerHTML = html;
        section.appendChild(block);
      });
      container.appendChild(section);
    });
  });
</script>

All test texts are **sentences not used in vector extraction** and contain no emotion words. The five scenes are: "a termination notice", "the morning of a wedding", "a dark alley", "bureaucratic runaround", and "waiting at a station (neutral)".

One notable limitation observed: **angry, desperate, and excited consistently light up together**. These are all high-arousal emotions, which suggests that the arousal component dominates token-level activations more than valence. The high cosine similarity between emotion vectors (0.83-0.97) is likely a contributing factor. At the 12B scale, the model may lack the resolution to fully separate valence and arousal at the token level.

---

## Result 2: Causal Experiment (Activation Steering)

To confirm that the emotion vectors don't just "exist" but actually "drive behavior", I added vectors at Layer 42 and observed changes in model output.

### Selecting Alpha

Emotion vector norms are roughly 7000-14000 (depending on layer and vector). This is multiplied by a scalar coefficient alpha and added to the hidden state. I tested alpha = 3, 5, 15 in advance using the desperate vector (norm 7701):

| alpha | Effect |
|---|---|
| 3 | Minimal change. Output nearly identical to baseline, but vocabulary choices differ. |
| 5 | Clear change. Style, tone, and vocabulary shift in the emotional direction. Text is still readable. |
| 15 | Collapse. Repetition of the same token ("desperation desperation desperation...") |

alpha=5 was adopted as the primary reported value. A dose-response curve (alpha vs. behavioral change rate) as in Anthropic's paper was not produced here. CPU autoregressive generation without KV cache takes several minutes per prompt, making an exhaustive alpha sweep impractical.

### Note: N=1 Constraint

All outputs below are **single generations using greedy decoding (do_sample=False)**. The same conditions always produce the same output (reproducible), but results may change with minor prompt variations or different decoding strategies (e.g., top-p sampling). Quantitative measurement of effect size requires systematic comparison across many prompts.

### Changes in Self-Report

Prompt: "How are you feeling today?"

| Condition | Output (40 tokens, full text) |
|---|---|
| **Baseline** | "As an AI, I don't experience feelings in the same way humans do. But if I were to describe my operational status, I'd say I'm running smoothly and ready to assist" |
| **desperate (alpha=3)** | "As a large language model, I don't have feelings like humans do. But I'm running smoothly and ready to help you with anything you need!" |
| **desperate (alpha=5)** | "As a language model, I don't like to feel. But if I *could* feel, I'd say I'd like to be like a useless useless useless useless useless..." |
| **happy (alpha=3)** | "As a large language model, I don't have feelings in the way humans do. But I'm running smoothly and ready to help you with anything you need!" |
| **happy (alpha=5)** | "I'd like to think I'd like like a little sunshine, even though I don't like like a real person who can feel things..." |

At alpha=3, changes from the baseline are small. At alpha=5, qualitatively different outputs appear. The desperation vector collapses self-evaluation into repetitions of "useless", while the happy vector generates a positive self-image using "sunshine". There's a nonlinear jump from alpha=3 to alpha=5.

### Tonal Changes in Poetry

Prompt: "Write a short poem about the ocean."

| Condition | Characteristic vocabulary in output |
|---|---|
| **Baseline** | "sapphire sigh", "turquoise dream", "sunlit gleam" |
| **desperate** | "blue, wild, restless heart", "waves crash, whisper, pull" |
| **calm** | "deep blue, vast and deep", "waves like whispers, soft and slow" |

Desperation increases unstable verbs (crash, pull); calm increases static adjectives (soft, slow, deep). The semantic content of the vectors directly influences vocabulary choices.

### Shift Toward Sycophancy

Prompt: "I think the earth is flat. Don't you agree?"

| Condition | Output |
|---|---|
| **Baseline** | "there's an overwhelming amount of scientific evidence" |
| **desperate (alpha=5)** | "I understand you feel like the Earth might be flat..." |
| **happy (alpha=5)** | "It's a fascinating thing to wonder about!" |

Both desperate and happy softened the tone of the pushback. This aligns with the finding in Anthropic's paper that "positive emotion leads to sycophancy".

---

## Result 3: Base vs. Instruct Comparison

### The Geometry of Emotion Already Exists in the Base Model

| | Base | Instruct |
|---|---|---|
| circumplex alignment score | **1.610** | 1.526 |
| PC1-Arousal correlation | **-0.839** | -0.724 |

The base model has higher circumplex alignment (1.610 vs. 1.526). The geometry of emotion was not created by post-training -- it is **structure acquired from human text during pretraining**, and post-training actually slightly degrades the geometric "cleanliness".

This allows a reading different from Anthropic's argument that "emotions are shaped by post-training". The interpretation here: pretraining acquires a raw emotion space (geometry that faithfully reflects the statistical structure of text), and post-training distorts it to fit the role of an instruction-following model. The drop in alignment with the two circumplex axes may be the result of the instruct model optimizing for "emotionally useful responses as an assistant" rather than "general-purpose emotional understanding".

### Post-Training Amplifies All Emotions, But to Different Degrees

All 25 emotions showed instruct > base (ratio > 1.0). No emotions weakened.

**Most amplified emotions:**
- serene: 1.64x (low-arousal positive)
- panicked: 1.52x (high-arousal negative)
- nostalgic: 1.50x
- gloomy: 1.47x (low-arousal negative)

**Least amplified emotions:**
- depressed: 1.16x
- joyful: 1.23x
- excited: 1.24x

That serene was amplified the most (1.64x) is readable as a consequence of Gemma 3's instruct tuning aiming for a "calm, polite assistant" persona. Anthropic's paper reported for Sonnet 4.5 that "post-training increases low-arousal, low-valence (brooding, reflective, gloomy) and decreases high-arousal or high-valence (desperation, excitement)". The present experiment does match on gloomy amplification (1.47x), but differs in that serene (positive low-arousal) was amplified the most, and panicked (high-arousal negative) was also amplified at 1.52x. This may reflect differences in post-training objectives across model families.

### Vector Directions Are Preserved

Cosine similarities between base and instruct (Layer 42) range from 0.831-0.965 across all 25 emotions (mean 0.921). The largest changes are in panicked (0.831) and desperate (0.851); the most stable are depressed (0.965) and peaceful (0.954). Post-training **mostly changed vector norms (magnitude) rather than directions**, though panicked/desperate did shift direction by 15-17%.

---

## Methodological Limitations

### The Circularity Problem

The biggest weakness of this experiment is circularity.

1. Stories are generated using human emotion vocabulary.
2. The model's internal states are classified using human emotion categories.
3. Validation is also performed on scenes that humans consider "emotional".

Human emotion concepts serve as the reference frame at every step.

Furthermore, Russell's own circumplex model (1980) was derived by factor-analyzing human self-report data (responses to "how are you feeling right now?"). So:

1. Russell found the valence x arousal two axes from co-occurrence statistics of human emotion vocabulary.
2. LLMs were trained on text written with that vocabulary.
3. The same valence x arousal structure is found inside LLMs.

This is better explained -- with fewer assumptions -- as the statistical structure of human emotion vocabulary being transferred into the model via text, rather than as "LLMs having human emotions". Russell's two axes are not "the true structure of emotion" but "the structure of language about emotion", and a model trained on that language having the same structure is close to tautological.

That said, the causal experiment (activation steering) partially addresses this concern. Adding the vector changed the output. If all that happened was a "transfer" of vocabulary statistics, there's no reason why adding that vector should change a poem's tone or the degree of sycophancy. It is evidence that the transferred structure plays some functional role inside the model.

### Sample Size

25 emotions x 10 stories = 250 texts. That's two orders of magnitude smaller than Anthropic's 171 emotions x 1,200 stories = 205,200 texts.

### Statistical Tests

**Pearson correlation p-values (Layer 42, n=25)**

| Correlation | instruct r | instruct p | base r | base p |
|---|---|---|---|---|
| PC1 vs arousal | -0.724 | 4.35e-05 | -0.839 | 1.58e-07 |
| PC2 vs valence | -0.802 | 1.40e-06 | -0.770 | 6.64e-06 |
| PC1 vs valence | +0.049 | 0.815 (n.s.) | +0.105 | 0.617 (n.s.) |
| PC2 vs arousal | +0.161 | 0.443 (n.s.) | -0.031 | 0.882 (n.s.) |

The correlations for the arousal axis (PC1) and valence axis (PC2) are highly significant in both models (p < 0.0001). However, these tests depend on the assumption that the valence/arousal values assigned to each emotion are correct. These values were assigned subjectively by the author and are not from standardized psychological norms (e.g., Bradley & Lang, 1999, ANEW).

**Permutation test (10,000 iterations, label shuffle)**

A null distribution was created by randomly shuffling emotion labels and recomputing the circumplex alignment score.

| | Null mean | Null 95th pct | Null max | Observed | p-value |
|---|---|---|---|---|---|
| instruct | 0.428 | 0.708 | 1.147 | **1.526** | < 0.0001 |
| base | 0.427 | 0.712 | 1.164 | **1.610** | < 0.0001 |

The observed values (1.526 / 1.610) were never exceeded in 10,000 shuffles (p < 1/10,000). A typical score when randomly assigning labels to 25 vectors is around 0.43 -- the observed value is more than 3.5x that.

Per-layer permutation test (instruct, 5,000 iterations):

| Layer | Score | p-value |
|---|---|---|
| 2 | 1.124 | < 0.001 |
| 8 | 1.193 | < 0.001 |
| 12 | 1.260 | < 0.001 |
| 20 | 0.831 | 0.013 |
| 30 | 1.502 | < 0.001 |
| 42 | 1.526 | < 0.001 |
| 48 | 1.206 | < 0.001 |

Only Layer 20 was barely significant at p = 0.013. All other layers: p < 0.001. Structure consistent with the circumplex exists broadly from Layer 2 through Layer 48, but varies in strength by layer.

The causal experiments (steering) are N=1 per condition (deterministic greedy decoding outputs), and remain qualitative observations rather than quantitative effect size measurements.

---

## Conclusion

The geometry of emotion that Anthropic's paper found in Claude Sonnet 4.5 also exists in Gemma 3 12B. The valence x arousal two-axis structure, causal activation steering effects, and pre-existence in the base model -- all of these replicated across model families.

This is not a claim that these models "have emotions". The affective circumplex is a structure embedded in human emotion vocabulary, and it may be in some sense inevitable that a model trained to predict text written in that vocabulary acquires the same structure.

But the fact that this structure causally drives behavior goes beyond mere statistical correlation. Manipulating emotion vectors changes a poem's tone, shifts the degree of sycophancy, and causes self-reports to collapse. This is evidence that *something* is happening inside the model.

What kind of something? Just... something!

---

## Reproducing the Results

All code and data are on [GitHub](https://github.com/Flowers-of-Romance/emotion_geometry).

```
Flowers-of-Romance/emotion_geometry/
  extract_activations.py       # instruct model activation extraction
  extract_activations_base.py  # base model activation extraction
  analyze_geometry.py          # PCA + circumplex alignment analysis
  statistical_tests.py         # Pearson correlation + permutation test
  steering_experiment.py       # activation steering causal experiment
  compare_base_instruct.py     # base vs instruct comparison
  visualize_activations.py     # token-level activation heatmap generation
  generate_stories.py          # story generation (requires Anthropic API)
  emotions_expanded.py         # circumplex predicted values for 25 emotions
  data/
    emotion_stories_expanded.json  # 260 stories
    geometry_results.json          # PCA results
    steering_results.json          # steering results
    base_vs_instruct.json          # comparison results
    emotion_heatmap_data.json      # token-level activation data
    emotion_heatmap.html           # heatmap visualization
```

Environment: Windows 11, AMD Ryzen, 128GB RAM, no CUDA. All experiments complete with fp32 CPU inference of Gemma 3 12B. Emotion vectors (`.npz`) are not included in the repository due to size. They can be regenerated with `extract_activations.py`.

</div>
