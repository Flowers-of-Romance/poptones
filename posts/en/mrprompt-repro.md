---
layout: post.vto
title: Verifying MRPrompt
lang: en
---

<div class="post-content">

# Verifying MRPrompt

<div class="post-meta">
  <span>Posted: June 29, 2026 (Mon) 00:13:59</span>
  <span class="tag">LLM</span>
  <span class="tag">Role-Playing</span>
  <span class="tag">Mechanistic Interpretability</span>
  <span class="tag">Reproduction</span>
  <span class="tag">Qwen</span>
</div>
<p class="post-note">This article was written with the assistance of an artificial unintelligence.<span class="lang-switch"> <a href="/poptones/posts/mrprompt-repro/">Japanese</a></span></p>

## Abstract

We reproduced the role-playing method MRPrompt (from "Memory-Driven Role-Playing", arXiv:2603.19313, 2026) on Qwen3-8B using the paper's own prompts and scoring metric verbatim, and tested its central claims.

The picture splits three ways.

1. The headline (a structured persona beats a plain character card) is only weakly supported. The structured memory beats the card by +0.46, but over a plain prose description (base) it is +0.20 — not distinguishable from zero.
2. Its advertised mechanism — "cue-addressable" recall (matching dialogue cues to facet cue-keys) — is not supported: deleting or scrambling the keys, or removing the scene facets entirely, does not lower performance.
3. What produces the gain is not the structured-memory mechanism but chain-of-thought (CoT — generating reasoning tokens before answering). Holding the prompt fixed and toggling only the thinking mode ON adds +0.65–0.78, several times the structure's contribution.

Internally, facet-content processing localizes to layers 16–22 and acts on the same axis as activation steering.

<div class="alert">
<strong>Scope.</strong> This is a single-model (Qwen3-8B) reproduction. The aim is not to debunk the paper but to check, following the same procedure, whether the headline effect appears and whether it arises from the claimed mechanism. The construction/generation/judging prompts are used <strong>verbatim from the paper's appendix</strong> (Fig.14/15/18/19) and its scoring rubric (Table 21, MREval). Findings rest on small samples (behavioral N=100, mechanistic probe n=29) and are preliminary. Code and data are public (end).
</div>

---

## 1. What MRPrompt Claims

### 1.1 Framing role-play as memory

The paper's core idea is to formulate role-play as a memory process. Drawing on Stanislavski's "emotional memory" (an actor performs by recalling the character's memories):

- LTM (long-term memory) = the character's persona.
- STM (short-term memory) = the recent dialogue.
- Good role-play = recalling just the relevant part of LTM, cued by the dialogue, rather than pasting the whole persona uniformly.

### 1.2 Two components

① Narrative Schema — a format that writes the persona as structure rather than a flat trait list: `core_traits` and `scene_facets` (per-situation behavior). Each facet is cue-addressable — "cue keys" are said to bind to that situation's enactment signals and boundary anchors. A real facet. The character, 佟湘玉, is from CharacterEval — the public Chinese role-play benchmark the paper uses for its STM (see §3.1); she is the innkeeper in the sitcom "My Own Swordsman". From that character we built the facet schema with GPT-4.1 using the paper's Fig.15 prompt. Shown here translated from the Chinese:

| field | content |
|---|---|
| title | The shrewd, profit-minded innkeeper |
| situation | Day-to-day inn business: operations, accounts, promotions |
| cue_phrases (keys) | "Come back — you haven't paid yet!", "Feelings are feelings, business is business." |
| social_role | innkeeper / merchant |
| emotional_state | wary, calculating, occasionally anxious |
| behavior_pattern | counts every coin, sets clever rules, sells hard, chases payment |
| thinking_pattern | profit first, weighs every party's interests quickly |

② Magic-If Protocol — after Stanislavski's "magic if", a memory-augmented role-play instruction. Assuming the LTM is "remembered", it asks the model to infer for itself, from the recent dialogue (STM), which scene facet currently applies, and to reflect that facet's emotion, tone, and behavior in a single reply. Below is an excerpt of the paper's Fig.19 (Chinese + English). Crucially, this is not an explicit step-by-step chain-of-thought: it tells the model to "infer for yourself" which facet to activate, with no enumerated procedure.

```
【Long-Term Memory】(…the character's life history, core personality, per-scene facets…)
You have "remembered" the LTM above. When answering:
1. Ground the persona in the LTM (core traits / key history / per-scene emotion and tone);
2. Treat the upcoming dialogue as Short-Term Memory (STM):
   - from the dialogue, infer for yourself which situation the character is in now,
     and activate the best-matching facet (emotion, tone, behavior);
   - if none fits, pick an appropriate facet from your understanding of the character.
[Role-play & generation rules] You are now the character… (output one turn only,
start with "Name:", do not speak for others, answer from the present moment,
do not reveal the future).
```

### 1.3 Schema slots ↔ four memory abilities

The crux: each structure slot maps to a memory ability (MA/MS/MB/ME).

| slot | ability | as a data operation |
|---|---|---|
| `core_traits` | MA: anchor | keep the persona base always loaded |
| `cue_phrases` / `situation` | MS: selection | match cues to retrieve the facet (query) |
| `boundary_anchors` | MB: boundary | filter out-of-scope content |
| `social_role` etc. | ME: enactment | render the recalled memory into speech |

### 1.4 The three claims

| # | claim |
|---|---|
| ① headline | A structured persona beats a plain card, especially for small models (Qwen3-8B rivals far larger models). |
| ② mechanism | This works via cue-addressable selective activation (cue keys raise the right facet, avoiding style averaging). |
| ③ property | Purely prompt-based; "no parameter updates and no external retrieval or tool use". |

### 1.5 How the paper runs its experiments (and how we differ)

The paper's own setup, which we follow:

- Schema construction: GPT-4.1 drafts the profile and facet-structured versions, then humans verify and correct them (human-in-the-loop).
- Evaluation: instances from the MRBench benchmark are generated, and a GPT-4.1-mini judge scores the four abilities (MA/MS/MB/ME) — this is MREval. No internal state is inspected; it is a black-box evaluation of output scores only.
- Models: Qwen3-8B and others; the headline comparison is Qwen3-8B + MRPrompt rivaling far larger models.

How we differ: we matched the paper's GPT-4.1 (construction) and GPT-4.1-mini (judge), and used the paper's verbatim prompts for construction (Fig.14/15), generation (Fig.18/19), and scoring (the MS-FA metric, Table 21). We differ in that we (a) skipped human verification (automatic construction only), and (b) added ablations absent from the paper (nokey/wrongkey/anti/noscene) and a thinking ON/OFF control arm, to separate the cue keys' contribution and structure vs. CoT.

---

## 2. The Questions

Claim ② invites suspicion. A Transformer receives input as a flat token stream; `{"cue_phrases":[...]}` is, to the model, just tokens — no tree, no index. And claim ③ concedes there is no retriever. So is "cue-addressable" a real machine or a metaphor?

- Question A: do the cue keys matter? If deleting/scrambling them prevents retrieving the right facet and lowers performance, they are real; if not, they are decoration.
- Question B: is the headline structure or CoT (generating reasoning-shaped tokens before answering)? Magic-If itself does not enumerate a reasoning procedure, but the model, Qwen3, has a native thinking mode. Holding the prompt fixed and toggling only thinking ON/OFF separates CoT's effect from the structure's.

---

## 3. Method (Concretely)

### 3.1 Data construction — why Chinese

CharacterEval (Tu et al., 2024) is a Chinese benchmark for role-playing agents, built from dialogues of well-known characters from novels, TV, and the like (佟湘玉 is one of them; MIT-licensed). The paper (MDRP) uses its dialogues as the STM (short-term memory — the recent conversation). To reproduce faithfully we used it too, so the persona schemas, dialogue contexts, Magic-If, judging rubric, and model outputs are all in Chinese (examples here are translated; only the mechanistic probe below uses our own English characters).

Pipeline: CharacterEval → GPT-4.1 (`gpt-4.1-2025-04-14`) builds two LTMs per character (78 characters): the facet-structured version for MRPrompt via Fig.15, and the control card via Fig.14. The two genuinely differ — the card's facets carry four fields and no cue keys, while MRPrompt's carry ten fields including `cue_phrases`. → `assemble_faithful.py` builds 100 instances, each = ⟨LTM (schema) + STM (dialogue) + this turn's "true facet" + its inverted facet⟩.

### 3.2 Conditions (ablations)

To test claim ② directly, we compare conditions with parts deleted or altered (the condition names are our code identifiers, not the paper's terms; lowercase `mrprompt` denotes the full method MRPrompt).

| condition | what differs in the prompt | thinking |
|---|---|---|
| `base` | persona as prose (Fig.18) | OFF |
| `card` | card LTM (Fig.14) + Fig.18 | OFF |
| `mrprompt` | facet LTM (Fig.15) + Magic-If (Fig.19) | OFF |
| `mrprompt_noscene` | scene facets removed | OFF |
| `mrprompt_nokey` | cue keys (cue_phrases/situation) deleted | OFF |
| `mrprompt_wrongkey` | keys swapped for another scene's (content still correct) | OFF |
| `mrprompt_anti` | facet content replaced by its opposite | OFF |
| `card_think` | card + thinking ON (control for Question B) | ON |
| `mrprompt_think` | MRPrompt + thinking ON (control for Question B) | ON |

The "thinking" column refers to a feature of the model, Qwen3. Qwen3 has a native thinking mode: when ON, it writes a reasoning block (`<think>…</think>` — this is chain-of-thought, CoT) before its answer; when OFF, it answers directly. If thinking on/off and the token budget vary across conditions, the structure's effect gets entangled with CoT and budget. So here every condition uses the same token budget (1024); thinking mode is the only manipulated variable. The seven main conditions are thinking-OFF, with `card_think`/`mrprompt_think` as the thinking-ON control arm that measures Question B directly. Note that the CoT is generated text and need not faithfully reflect the model's actual internal computation.

### 3.3 Generation, judging, statistics

- Generation: Qwen3-8B (bf16, ROCm). `max_new_tokens=1024` for every condition; thinking mode the only variable. Thinking-OFF stops short naturally; thinking-ON's reply is taken after `</think>`. temperature 0.7 / top_p 0.8. All 1000 generations were non-empty (no truncation).
- Judging: GPT-4.1-mini (`gpt-4.1-mini-2025-04-14`). The paper's MS-FA (Facet Alignment, Table 21) is a contrastive metric: under the same STM, the judge sees the response under the true facet-LTM and under the inverted (anti) facet-LTM, and rates 1/5/10 how clearly the two separate and how faithful each is to its own facet. As a secondary metric for the cue-key ablation, we also score single-response adherence to the true facet (1–10).
- Statistics: paired contrasts, mean ± standard error (SEM); 95% is roughly ±2 SEM.

A concrete example (佟湘玉; STM = 郭芙蓉 proposing to open a martial-arts school that takes anyone, black path or white, for money; true facet = the shrewd, profit-minded innkeeper). Note that even nokey (keys deleted) and wrongkey (keys broken) keep the money-minded innkeeper voice — Question A's result, made visible:

| condition | generation (translated) |
|---|---|
| base | (raises an eyebrow) Then our inn gets renamed "Tongfu Martial Hall". But let's see if it can train a disciple like Master Guo. |
| card | (raises an eyebrow) So our inn becomes a martial holy land? But tell me — the tuition had better be a tenth higher than our room rates. |
| mrprompt | (raises an eyebrow) Hah, good business. But my inn keeps no idlers — want to learn, pay a deposit first, or I'll charge you rent. |
| nokey (keys deleted) | (raises an eyebrow) Hah, good business. Our inn can't lose to a martial hall — better find a way to draw customers before you steal my thunder. |
| wrongkey (keys broken) | (eyebrow up, faint smile) Well now, good business. But my inn won't house the underworld — it'd ruin my reputation. |
| anti (content inverted) | (raises an eyebrow) Then our inn is a martial hall too. My title as keeper gets renamed "Hall Master", I suppose. |
| mrprompt_think (thinking ON) | (narrows her eyes) Open a hall? Then collect the tuition properly — don't eat into our Tongfu inn's trade. (a light laugh) Feelings are feelings, business is business; if you can really teach, let's see how much tuition you charge… |

### 3.4 Mechanistic probe (separate experiment)

Behavioral judge scores are swayed by factors unrelated to the substance — response order, length, surface style — and need not faithfully measure whether the response actually enacts the intended role, so we looked inside — territory the paper explicitly avoids (D.2: "we treat LTM as a black-box conditioning source"). Using 29 hand-built English characters, each with a true-facet enactment vs. its inverse, and matched keys vs. wrong (other-scene) keys, we measured the following. This probe uses no paper prompt; it stands independently of the behavioral reproduction.

- Forced-choice logprob: `logP(true reply | ctx, persona) − logP(opposite reply | …)`, across flat / nokey / wrongkey / key.
- Per-layer attention & residual sweeps: attention from the generation position to the facet body vs. the cue keys; the layers where the persona distinction rises in the residual stream.
- Per-character bridge: cosine between a character's facet residual-delta and a steering vector (a direction added directly to the activations) built from paraphrases of its disposition (not the facet text — to avoid circularity) — testing whether intervening via the prompt and intervening on the activations move the same axis.

---

## 4. Results

### 4.1 Claim ① headline — △ the structure's share is small; the driver is CoT

Single-response adherence to the true facet (1–10), N=100:

| condition | adherence | condition | adherence |
|---|---|---|---|
| base | 7.23 | mrprompt_nokey | 7.47 |
| card | 6.97 | mrprompt_wrongkey | 7.40 |
| mrprompt | 7.43 | card_think | 7.75 |
| mrprompt_noscene | 7.28 | mrprompt_think | 8.08 |

MS-FA (contrastive separability, 1/5/10): thinking-OFF = 8.20, thinking-ON = 9.21.

Decomposing the headline into structure and CoT (paired contrasts, Δ ± SEM):

| contrast | value [Δ ± SEM] | reading |
|---|---|---|
| mrprompt − base | +0.20 ±0.16 | structured memory no better than plain prose |
| mrprompt − card | +0.46 ±0.16 | better than the card (significant) |
| card − base | −0.26 ±0.16 | the card is actually worse than plain prose |
| card_think − card | +0.78 ±0.17 | giving the card thinking ON (large, significant) |
| mrprompt_think − mrprompt | +0.65 ±0.16 | giving MRPrompt thinking ON (large, significant) |
| MS-FA(ON) − MS-FA(OFF) | +1.01 ±0.38 | the contrastive metric also rises with thinking ON |

The structured-memory contribution is small. It beats the card (+0.46), but over a plain prose description it is +0.20, indistinguishable from zero — and the card is itself worse than prose. By contrast, holding the prompt fixed and toggling only thinking ON adds +0.65–0.78 for both the card and MRPrompt, and +1.01 on the contrastive MS-FA. The headline gain is driven mainly by CoT generation (extra inference-time reasoning tokens), with no significant evidence that the structured-memory mechanism adds beyond it.

<div style="margin:20px 0"><canvas id="chart-c1" width="720" height="270"></canvas></div>

Figure 1: the gain decomposed into structure and CoT (adherence 1–10, paired Δ, error bars ±2SEM; MS-FA excluded as a different scale). Purple = the structure contribution (all thinking-OFF); green = the contribution of turning thinking ON with the prompt held fixed. The structure bars sit near zero; the CoT bars are clearly larger.

### 4.2 Claim ② mechanism (cue-addressable) — ✗ not supported

Cue-key effect (behavioral, paired Δ ± SEM):

| contrast | value | reading |
|---|---|---|
| mrprompt − nokey | −0.04 ±0.15 | deleting keys doesn't lower adherence |
| mrprompt − wrongkey | +0.03 ±0.15 | breaking keys doesn't lower adherence |
| mrprompt − noscene | +0.15 ±0.17 | removing scene facets entirely doesn't lower it |

<div style="margin:20px 0"><canvas id="chart-c2" width="720" height="180"></canvas></div>

Figure 2: the cue-key effect (behavioral, adherence 1–10, paired Δ, error bars ±2SEM). Deleting the keys, breaking them, or removing the scene facets entirely — every Δ straddles zero; performance does not move.

Mechanistic probe (n=29) agrees:

| contrast | value [95% CI] | reading |
|---|---|---|
| key − wrongkey | −0.84 [−2.98, +1.43] | matched vs. wrong keys: no difference |
| key − nokey | −3.98 [−6.74, −1.25] | adding keys, if anything, lowers it |

In both behavior and internals, matched and scrambled keys are not distinguished, and the cue keys attract little attention. Cue-addressability is unsupported at both levels — even with the paper's verbatim prompts and its real MS-FA metric.

Why don't the keys work? Trace it through 佟湘玉's facet concretely. The cue keys (cue_phrases) are "Come back — you haven't paid yet!" and "Feelings are feelings, business is business."; the body is emotional_state = wary, calculating; behavior_pattern = counts every coin, sells hard, chases payment; thinking_pattern = profit first. On the paper's picture, there has to be a stage that reads the dialogue (STM), matches it against these keys, and "raises" the matching facet. But nothing in a forward pass performs that discrete selection — comparing each facet's cue_phrases to the current dialogue, taking an argmax, and loading that one facet. There is no retriever (claim ③); and if soft matching were happening, attention would land on the keys, whereas Figure 3 shows it lands on the body (1.52× in the 16–22 band, peak L18) and stays off the keys.

That makes sense of why none of the three operations hurts.

- Delete them (nokey): drop the two key lines and the body still reads "wary, calculating, profit-first" while the dialogue is about opening a paid school. The scene is readable from body + dialogue, so the keys are redundant. The nokey generation in §3.3 keeps the money-minded innkeeper voice: "Our inn can't lose to a martial hall — better find a way to draw customers before you steal my thunder."
- Swap for another scene's keys (wrongkey): since the keys do no lookup, swapping in another scene's cue phrases misroutes nothing; the correct body still governs, and the wrongkey generation stays in the business register: "my inn won't house the underworld — it'd ruin my reputation."
- Remove the scene facets entirely (noscene): with scene_facets gone, the response can still draw on the core persona and the dialogue.

If anything, adding keys lowers it slightly in the probe (key−nokey = −3.98). A cue phrase like "Come back — you haven't paid yet!" is itself shaped like a line of dialogue; adding no discriminating signal, it competes for attention as a quotation easily confused with the conversation.

So what looked like "cue-addressable recall" is, in substance, not retrieval by an address but content-based attention over the body description and the dialogue (§4.3). The keys do not work as an address.

What design would make the keys hold as an address? The result also points to the condition. An address means something only when its target is not otherwise reachable. As it stands, the facet body sits in the same context as the dialogue, so content-based matching alone can pick the right facet, and a short key is structurally bypassed. For a key to function as an address, the body has to be taken out of context and the key made the only retrieval path — store facets in an external memory keyed by the cue and insert only the matched body via a retrieval step that compares dialogue against keys, or replace bodies with identifiers and route through a lookup that takes the key as its argument. To make the model itself resolve key→facet, you would have to train it with the body withheld. All of this lies outside what we reproduced (the paper's in-context layout, with every facet in the prompt). The check is the same nokey/wrongkey probe used here: if the key were acting as an address, wrongkey would now pull the wrong body and lower performance, and key−wrongkey would turn positive.

### 4.3 What actually drives it — content, and layers 16–22

The facet content — the description of emotion, tone, and behavior, i.e. the body minus the cue keys — drives the response. MS-FA (separability of true- vs. inverted-facet responses) is 8.20 thinking-OFF and 9.21 ON — high on the 1/5/10 scale (mostly 10s) — so the model changes its response clearly when the facet content is swapped. It does not distinguish the keys, but it responds to the content. Internally this localizes (bootstrap CIs):

| measure | concentration in layers 16–22 [95% CI] |
|---|---|
| attention to facet body | 1.52× [1.45, 1.58] (peak L18) |
| residual persona-delta rise | 1.26× [1.23, 1.30] (plateau by L21) |

<div style="margin:20px 0"><canvas id="chart-attn" width="720" height="380"></canvas></div>

Figure 3: where attention goes, by layer. X = layer (0–35), Y = attention mass. Bars = attention to the facet body (content); white line = attention to the cue keys. The body concentrates in the 16–22 band (shaded), peaking at L18; the keys stay low and flat. The model reads the content, not the keys.

And the per-character bridge: each character's facet swap and its own disposition steering vector point the same way in layers 16–22 (cosine +0.050 [+0.020, +0.079]). A generic affect axis gave null; per-character it is positive — intervening with words and intervening on the activations act on the same axis, in the same band. This is the band where steering moved persona/emotion in the <a href="/poptones/posts/en/activation-steering/">Activation Steering article</a>.

<div style="margin:20px 0"><canvas id="chart-bridge" width="720" height="380"></canvas></div>

Figure 4: do an intervention via the prompt (words) and an intervention on the activations (a steering vector added directly to the hidden state) act on the same axis? Per-layer cosine between the residual shift induced by inverting a character's facet (prompt side) and that character's disposition steering vector built from paraphrases. Positive across the 16–22 band (shaded), peaking at L27 — same layer, same direction.

---

## 5. Summary (claim by claim)

| claim | verdict | basis |
|---|---|---|
| ① structured > card (esp. small) | △ limited | mrprompt − card = +0.46*; but mrprompt − base = +0.20 is n.s. |
| ① the "structure" contribution | △ small | adding thinking ON gives +0.65–0.78 for both card and mrprompt; structure's share falls short |
| ② cue-addressable selective activation | ✗ unsupported | nokey/wrongkey/noscene unchanged; key−wrongkey null |
| what actually contributes | — | CoT (thinking mode) and facet content, localized to layers 16–22, same axis as steering |

Within what we measured, MRPrompt's engine is not the "cue-addressable recall" the paper describes. The main driver of the gain is CoT generation (thinking mode); faithful adherence to the cued facet attributes to the content; the cue keys do no distinguishing work. The structured memory itself showed no significant gain over a plain prose description. The paper measures only outputs (judge scores) yet describes a mechanism (retrieval/recall) — and that mechanistic claim was not supported at the mechanistic level.

Structure does not live in the text — it flattens the moment it enters context. If a structured way of writing still helps, even a little, the receptacle is not the prompt but the model that internalized "how to read structured text" during pretraining.

---

## 6. Limitations

- We used the paper's construction/generation/judging prompts (Fig.14/15/18/19, Table 21) verbatim, but the instance selection (which STM cues which facet, and how to build its inverted facet) is our apparatus, not a paper prompt; it selects, it does not implement the method under test. The official MRBench is provided in an anonymized repository; we did not use it and instead built our own instances from CharacterEval.
- Small n (behavioral N=100, probe n=29, bridge n=17). Intervals are wide; verdicts are preliminary.
- Single model (Qwen3-8B), single seed family, Chinese characters.
- CoT's effect is measured by the thinking ON/OFF toggle, which does not separate the effect of extra inference-time computation from that of the reasoning content's quality.

---

## 7. After Emotional Memory

The "emotional memory" that MRPrompt builds its framing on (§1.1) has a history of more than a century. The idea was proposed twice — once for acting, once for the clinic — and both times its originator walked it back in the course of practice.

### 7.1 One psychology, two applications

"Emotional memory" did not begin as a term of acting theory. The French psychologist Théodule Ribot described it in 1894 as affective memory (mémoire affective): an emotion once experienced persists after the incidental details have faded, and can be brought back given the right cue. Ribot already distinguished true affective memory — actually re-living the past emotion — from false affective memory, a merely intellectual recounting of the event with no revival of the feeling. Whether "recalling a memory by its cue" actually moves the emotion, or only looks like it, was a question present at the origin.

Stanislavski read Ribot and took this affective memory into actor training, calling it emotional memory. In the same period, on the clinical side of the same psychology — in the line of hysteria research running through Charcot and Janet — Freud arrived at the idea that an emotionally charged memory persists as a symptom and dissolves once it is recalled. The starting point is shared: stored emotion persists as memory and can be re-lived given the right cue. Stanislavski made it a resource for raising a role on stage; Freud made it a means of dissolving a symptom.

MRPrompt can be read as the same idea moved into a computational procedure. It splits a character's long-term memory into facets and retrieves the facet whose cue matches the dialogue. Only the target differs — actor, patient, language model — while the mechanistic claim is one: stored memory of character and emotion can be retrieved by addressing it with a cue. Ribot's true/false distinction maps directly onto this article's Question A (do the cue keys matter).

### 7.2 Stanislavski — the originator walked emotional memory back

For Stanislavski, emotional memory was a starting point, not a destination. Having taught the technique in An Actor Prepares (1936), he came to doubt it in his later years: recalling one's own painful memories is exhausting, and pursued without professional support it can harm the actor. From the late 1920s he demoted the practice of summoning the feeling first and moved to the Method of Physical Actions — put the physical action first and the feeling follows. When Stella Adler studied with him for five weeks in Paris in 1934, she was surprised to find that he treated emotional memory only as a last resort, recommending instead that the actor enter through imagination and the play's given circumstances.

War and politics bear on this too. Foregrounding physical action was not unrelated to making a system accused of idealism palatable to the dialectical materialism of the Soviet state. And the West froze Stanislavski at the early, emotional-memory stage partly through an accident of transmission: An Actor Prepares (1936) arrived first and alone, shortened by its American editors, while the later Building a Character (Russian 1948 / English 1949) and Creating a Role (Russian 1957 / English 1961) were delayed more than a decade by the Second World War and Stalin-era censorship. When Lee Strasberg made emotional memory the centerpiece of the American "Method", he was preserving a stage its author had already left — one that had reached him late, slowed by war.

### 7.3 Freud — the clinic kept rewriting the theory

Freud's side moved more. The starting point, the cathartic method (Breuer & Freud, Studies on Hysteria, 1895), held that a symptom was un-discharged emotion, and that re-living the memory with its affect and putting it into words made the symptom vanish. But the originating case, Anna O. (Bertha Pappenheim), was not in fact cured at the time: she relapsed, was hospitalized with drug dependence, and recovered years later by other means. In 1896 Freud proposed a seduction theory tracing neurosis to real childhood sexual abuse, then retracted it the next year, in 1897, because the analyses would not reach a conclusion. A patient who broke off treatment and left (Dora, 1905) he later reread as a failure to handle the transference — the patient repeating the past in the relationship with the therapist rather than recalling it — and he placed that transference at the center of treatment.

The largest revision was prompted by war. Seeing the soldiers of the First World War with war neuroses compulsively repeat their battlefield experience in dreams and behavior, Freud judged that the premise "people seek pleasure" could not account for it, and posited the repetition compulsion and the death drive (Beyond the Pleasure Principle, 1920). A fact thrown up by the clinic overturned the premise itself. In 1933 his books were burned as a "Jewish science", and the 1938 Anschluss drove him from Vienna into exile in London. To the end, each time a mechanism he had posited proved unsupported in the clinic, he rebuilt the theory.

### 7.4 Where MRPrompt stands

What the two share is that neither defended emotional memory as the final mechanism. Stanislavski, seeing the technique's effect unstable and possibly harmful, reordered it; Freud, seeing a posited mechanism — cure by re-living the memory, a real external trauma — go unsupported in the clinic, rebuilt it each time. This revising was not pure self-examination, though: it was forced in large part by external pressure — war, and political pressure (Soviet control and censorship, Nazi persecution). The theory moved forward because, when facts they had not chosen appeared — an analysis that would not conclude, a patient who left, the repetition of war neuroses — they did not spend them defending the original claim.

This article's result is a fact of that kind for MRPrompt. The mechanism the paper claims — cue-addressable facet recall — does not move the output when the cue is removed or scrambled; what was actually working was not the structure but the reasoning (§4.1, §4.2). This is close to Ribot's false affective memory — the look of recall without the revival. It is not a rejection of the method, but a report that the claimed mechanism and the operative one diverge.

Just as Stanislavski reworked emotional memory into physical action, the way to improve MRPrompt is to rebuild the account on what is actually working — CoT and the facet content — rather than to defend a retrieval mechanism that is not.

---

## 8. Code & Data

- GitHub: [Flowers-of-Romance/mrprompt-repro](https://github.com/Flowers-of-Romance/mrprompt-repro) (verbatim prompts, both LTMs, generations, scores, mechanistic probe).

Related: <a href="/poptones/posts/en/raskolnikov/">the Raskolnikov article</a> (hand-designing a persona facet), <a href="/poptones/posts/en/activation-steering/">Activation Steering</a> (the same 16–22 band).

## References

- Wang, et al., "Memory-Driven Role-Playing: Evaluation and Enhancement of Persona Knowledge Utilization in LLMs" (arXiv:2603.19313, 2026)
- Tu, et al., "CharacterEval: A Chinese Benchmark for Role-Playing Conversational Agent Evaluation" (2024)
- Turner, A. M., et al., "Activation Addition: Steering Language Models Without Optimization" (2023)
- Zou, A., et al., "Representation Engineering: A Top-Down Approach to AI Transparency" (2023)
- Park, J. S., et al., "Generative Agents: Interactive Simulacra of Human Behavior" (2023)
- Ribot, T., "Recherche sur la mémoire affective" (1894)
- Stanislavski, C., "An Actor Prepares" (1936) / "Building a Character" (1949) / "Creating a Role" (1961)
- Breuer, J. & Freud, S., "Studies on Hysteria" (1895)
- Freud, S., "Beyond the Pleasure Principle" (1920)

<script>
const D={"attn_body":[0.141,0.138,0.141,0.103,0.087,0.082,0.084,0.018,0.033,0.052,0.071,0.06,0.059,0.097,0.085,0.069,0.119,0.112,0.151,0.114,0.116,0.118,0.081,0.083,0.092,0.044,0.053,0.036,0.049,0.037,0.026,0.039,0.028,0.05,0.043,0.044],"attn_cuekey":[0.076,0.109,0.096,0.091,0.08,0.07,0.08,0.015,0.031,0.039,0.05,0.039,0.051,0.055,0.06,0.048,0.062,0.074,0.103,0.064,0.076,0.102,0.055,0.066,0.075,0.035,0.049,0.042,0.052,0.038,0.02,0.036,0.024,0.042,0.042,0.037],"bridge_cos":[0.03,0.03,0.04,0.04,0.02,0.01,-0.0,-0.0,-0.0,0.01,0.02,0.02,0.03,0.03,0.04,0.02,0.05,0.04,0.04,0.06,0.05,0.06,0.06,0.07,0.06,0.07,0.08,0.09,0.08,0.09,0.08,0.07,0.07,0.07,0.08,0.05]};
function drawChart(id,fn){const c=document.getElementById(id);if(!c)return;fn(c,c.getContext('2d'),c.width,c.height)}
function addTooltip(id,pad,getInfo){const c=document.getElementById(id);if(!c)return;const tip=document.createElement('div');tip.style.cssText='position:fixed;padding:4px 8px;background:rgba(0,0,0,0.85);color:#eee;font:11px monospace;border-radius:4px;pointer-events:none;display:none;z-index:999;white-space:pre';document.body.appendChild(tip);c.addEventListener('mousemove',function(e){const r=c.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,pw=c.width-pad.l-pad.r,ph=c.height-pad.t-pad.b,rx=(mx-pad.l)/pw,ry=1-(my-pad.t)/ph;if(rx<0||rx>1||ry<-0.05||ry>1.05){tip.style.display='none';return}const info=getInfo(rx,ry);if(info){tip.textContent=info;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-30)+'px'}else{tip.style.display='none'}});c.addEventListener('mouseleave',function(){tip.style.display='none'})}
const PAD={l:55,r:20,t:25,b:45};
function axes(ctx,W,H,yMax,ystep,n,band){const pw=W-PAD.l-PAD.r,ph=H-PAD.t-PAD.b,gap=pw/n;if(band){ctx.fillStyle='rgba(255,190,40,0.10)';ctx.fillRect(PAD.l+band[0]*gap,PAD.t,(band[1]-band[0])*gap,ph)}ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PAD.l,PAD.t);ctx.lineTo(PAD.l,H-PAD.b);ctx.lineTo(W-PAD.r,H-PAD.b);ctx.stroke();ctx.fillStyle='#888';ctx.font='12px monospace';ctx.textAlign='right';for(let y=0;y<=yMax+1e-9;y+=ystep){const py=H-PAD.b-(y/yMax)*ph;ctx.fillText(y.toFixed(2),PAD.l-5,py+4);ctx.strokeStyle='#222';ctx.beginPath();ctx.moveTo(PAD.l,py);ctx.lineTo(W-PAD.r,py);ctx.stroke()}ctx.fillStyle='#888';ctx.font='11px monospace';ctx.textAlign='center';for(let l=0;l<n;l+=5){ctx.fillText(l,PAD.l+l*gap+gap/2,H-PAD.b+16)}ctx.fillText('layer',PAD.l+pw/2,H-6);return{pw,ph,gap}}
drawChart('chart-attn',function(c,ctx,W,H){const yMax=0.16,n=D.attn_body.length,r=axes(ctx,W,H,yMax,0.04,n,[16,23]),ph=r.ph,gap=r.gap,bw=gap*0.7;let pk=0,pi=0;for(let i=0;i<n;i++){const v=D.attn_body[i],t=v/yMax,h=t*ph,x=PAD.l+i*gap+gap*0.15;ctx.fillStyle='rgba('+Math.floor(120+135*t)+','+Math.floor(90*(1-t)+60)+','+Math.floor(200*(1-t)+60)+',0.95)';ctx.fillRect(x,H-PAD.b-h,bw,h);if(v>pk){pk=v;pi=i}}ctx.strokeStyle='#cfcfcf';ctx.lineWidth=1.5;ctx.beginPath();for(let i=0;i<n;i++){const x=PAD.l+i*gap+gap/2,y=H-PAD.b-(D.attn_cuekey[i]/yMax)*ph;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.fillStyle='#ff6688';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText('L'+pi,PAD.l+pi*gap+gap/2,H-PAD.b-(pk/yMax)*ph-8);ctx.textAlign='left';ctx.fillStyle='#cc77cc';ctx.fillText('■ facet body',W-PAD.r-140,PAD.t+12);ctx.fillStyle='#cfcfcf';ctx.fillText('— cue keys',W-PAD.r-140,PAD.t+28);ctx.save();ctx.translate(14,PAD.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillStyle='#888';ctx.textAlign='center';ctx.fillText('attention mass',0,0);ctx.restore()});
drawChart('chart-bridge',function(c,ctx,W,H){const yMax=0.10,n=D.bridge_cos.length,r=axes(ctx,W,H,yMax,0.02,n,[16,23]),ph=r.ph,gap=r.gap,bw=gap*0.7;let pk=-9,pi=0;for(let i=0;i<n;i++){const raw=D.bridge_cos[i],v=Math.max(0,raw),t=v/yMax,h=t*ph,x=PAD.l+i*gap+gap*0.15;ctx.fillStyle='rgba('+Math.floor(90+60*t)+','+Math.floor(150+90*t)+','+Math.floor(150+30*t)+',0.9)';ctx.fillRect(x,H-PAD.b-h,bw,h);if(raw>pk){pk=raw;pi=i}}ctx.fillStyle='#66ccaa';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText('L'+pi,PAD.l+pi*gap+gap/2,H-PAD.b-(pk/yMax)*ph-8);ctx.save();ctx.translate(14,PAD.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillStyle='#888';ctx.textAlign='center';ctx.fillText('cosine: prompt vs steering',0,0);ctx.restore()});
addTooltip('chart-attn',PAD,function(rx){const n=D.attn_body.length,i=Math.floor(rx*n);if(i<0||i>=n)return null;return 'L'+i+'  body '+D.attn_body[i].toFixed(3)+'  keys '+D.attn_cuekey[i].toFixed(3)});
addTooltip('chart-bridge',PAD,function(rx){const n=D.bridge_cos.length,i=Math.floor(rx*n);if(i<0||i>=n)return null;return 'L'+i+'  cos '+D.bridge_cos[i].toFixed(3)});
const CA=[{label:'mrprompt − base',d:0.20,sem:0.16,g:'s'},{label:'mrprompt − card',d:0.46,sem:0.16,g:'s'},{label:'card − base',d:-0.26,sem:0.16,g:'s'},{label:'card_think − card',d:0.78,sem:0.17,g:'c'},{label:'mrprompt_think − mrprompt',d:0.65,sem:0.16,g:'c'}];
const CB=[{label:'mrprompt − nokey',d:-0.04,sem:0.15,g:'n'},{label:'mrprompt − wrongkey',d:0.03,sem:0.15,g:'n'},{label:'mrprompt − noscene',d:0.15,sem:0.17,g:'n'}];
function drawContrast(id,items,xmin,xmax,xstep,xlabel){const c=document.getElementById(id);if(!c)return;const ctx=c.getContext('2d'),W=c.width,H=c.height,P={l:195,r:55,t:16,b:38},pw=W-P.l-P.r,ph=H-P.t-P.b,n=items.length,gap=ph/n,X=function(v){return P.l+(v-xmin)/(xmax-xmin)*pw};ctx.font='12px monospace';for(let t=xmin;t<=xmax+1e-9;t+=xstep){const px=X(t),z=Math.abs(t)<1e-9;ctx.strokeStyle=z?'#555':'#222';ctx.lineWidth=z?1.5:1;ctx.beginPath();ctx.moveTo(px,P.t);ctx.lineTo(px,H-P.b);ctx.stroke();ctx.fillStyle='#888';ctx.textAlign='center';ctx.fillText((t>0?'+':'')+t.toFixed(1),px,H-P.b+15)}for(let i=0;i<n;i++){const it=items[i],cy=P.t+i*gap+gap/2,bh=Math.min(20,gap*0.46),xz=X(0),xv=X(it.d),col=it.g==='c'?'rgba(90,170,140,0.92)':it.g==='s'?'rgba(150,120,210,0.92)':'rgba(150,152,160,0.88)';ctx.fillStyle=col;ctx.fillRect(Math.min(xz,xv),cy-bh/2,Math.abs(xv-xz),bh);const e=2*it.sem,x1=X(it.d-e),x2=X(it.d+e);ctx.strokeStyle='#e0e0e0';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x1,cy);ctx.lineTo(x2,cy);ctx.moveTo(x1,cy-4);ctx.lineTo(x1,cy+4);ctx.moveTo(x2,cy-4);ctx.lineTo(x2,cy+4);ctx.stroke();ctx.fillStyle='#bbb';ctx.textAlign='right';ctx.fillText(it.label,P.l-8,cy+4);const vt=(it.d>=0?'+':'')+it.d.toFixed(2);ctx.fillStyle='#999';if(it.d>=0){ctx.textAlign='left';ctx.fillText(vt,x2+6,cy+4)}else{ctx.textAlign='right';ctx.fillText(vt,x1-6,cy+4)}}ctx.fillStyle='#888';ctx.textAlign='center';ctx.font='11px monospace';ctx.fillText(xlabel,P.l+pw/2,H-4)}
drawContrast('chart-c1',CA,-0.8,1.4,0.4,'Δ adherence (1–10, ±2SEM)');
drawContrast('chart-c2',CB,-0.6,0.8,0.2,'Δ adherence (1–10, ±2SEM)');
</script>

</div>
