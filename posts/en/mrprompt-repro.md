---
layout: post.vto
title: Verifying MRPrompt (Qwen3-8B)
lang: en
---

<div class="post-content">

# Verifying MRPrompt (Qwen3-8B)

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

We reproduced the role-playing method MRPrompt (from "Memory-Driven Role-Playing", arXiv:2603.19313, 2026) on Qwen3-8B under the paper's own conditions, and tested its central claims. The picture splits three ways. (1) The headline (a structured persona beats a plain character card) replicates and is significant. (2) But its advertised mechanism — "cue-addressable" recall (matching dialogue cues to facet cue-keys) — is not supported: deleting or scrambling the keys does not lower performance. (3) What produces the gain is not the structured-memory mechanism (cue-addressable): the model reads the facet content rather than the cue keys (deleting or scrambling the keys changes nothing; inverting the content lowers adherence), and the gap over a plain card is mostly explained by CoT generation (giving the card the same CoT generation recovers most of it, with no significant evidence that the structure adds beyond that). Internally, facet-content processing localizes to layers 16–22 and acts on the same axis as activation steering.

<div class="alert">
<strong>Scope.</strong> This is a single-model (Qwen3-8B) reproduction. The aim is not to debunk the paper but to check, following the same procedure, whether the headline effect appears and whether it arises from the claimed mechanism. The paper's verbatim prompts (Appendix N/O) are not public, so the construction/judging prompts are <strong>faithful to the paper's procedure</strong>, not byte-identical. Findings rest on small samples (behavioral N=100, mechanistic probe n=29) and are preliminary. Code, data, and full translations are public (end).
</div>

---

## 1. What MRPrompt Claims

### 1.1 Framing role-play as memory

The paper's core idea is to formulate role-play as a memory process. Drawing on Stanislavski's "emotional memory" (an actor performs by recalling the character's memories):

- LTM (long-term memory) = the character's persona.
- STM (short-term memory) = the recent dialogue.
- Good role-play = recalling just the relevant part of LTM, cued by the dialogue, rather than pasting the whole persona uniformly.

### 1.2 Two components

① Narrative Schema — a format that writes the persona as structure rather than a flat trait list: `core_traits` and `scene_facets` (per-situation behavior). Each facet is cue-addressable — "cue keys" are said to bind to that situation's enactment signals and boundary anchors. A real facet (佟湘玉, the innkeeper from "My Own Swordsman"; a schema we built with GPT-4.1, not from the paper; the data is Chinese, shown here in English):

| field | content |
|---|---|
| title | The shrewd innkeeper haggling |
| situation | When a customer settles a bill, during purchasing, or in a dispute |
| cue_phrases (keys) | "You haven't paid yet", "good and cheap", "can't you go lower?" |
| social_role | merchant / authority |
| emotional_state | wary, smug, occasionally impatient |
| behavior_pattern | seizes every small profit, argues by reason, sells cleverly |
| thinking_pattern | profit first, careful calculation |

② Magic-If Protocol — a procedure after Stanislavski's "magic if" that makes the model reason step by step before replying (extract cues → select facet → derive stance → generate): a structured form of chain-of-thought (CoT). Below is the reconstructed prompt we used (Chinese + English) — the paper's own prompts (Appendix N/O) are non-public, so this is faithful to the described procedure, not verbatim:

```
【行动准则·Magic-If】你就是{name}本人。请在心中按以下步骤推理后，只输出角色的一句回应：
1) 从对话(STM)中提取线索；2) 选择最相关的情境facet；
3) 由该facet推导社会姿态/情绪/行为/思维；4) 以角色口吻生成回应。

[Magic-If] You ARE {name}. Reason silently through these steps, then output only the
character's single reply:
1) extract cues from the dialogue (STM); 2) select the most relevant situational facet;
3) derive social stance/emotion/behavior/thinking from that facet; 4) reply in character.
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

How we differ: we matched the paper's GPT-4.1 (construction) and GPT-4.1-mini (judge), but (a) skipped human verification (automatic construction only), (b) reconstructed the non-public prompts, and (c) added ablations absent from the paper (nokey/wrongkey/anti/card_think) to separate the cue keys' contribution and structure vs. CoT.

---

## 2. The Questions

Claim ② invites suspicion. A Transformer receives input as a flat token stream; `{"cue_phrases":[...]}` is, to the model, just tokens — no tree, no index. And claim ③ concedes there is no retriever. So is "cue-addressable" a real machine or a metaphor? That is testable.

- Question A: do the cue keys matter? If deleting/scrambling them prevents retrieving the right facet and lowers performance, they are real; if not, they are decoration.
- Question B: is the headline structure or CoT (having the model generate a block of reasoning-shaped tokens before it answers)? MRPrompt elicits this CoT via Magic-If. Can we separate it from the structure's effect?

---

## 3. Method (Concretely)

### 3.1 Data construction — why Chinese

The paper draws its STM pool from CharacterEval (a Chinese role-play benchmark). To reproduce faithfully we used it too, so the persona schemas, dialogue contexts, Magic-If, judging rubric, and model outputs are all in Chinese (examples here are translated; only the mechanistic probe below uses our own English characters).

Pipeline: CharacterEval → GPT-4.1 (`gpt-4.1-2025-04-14`) builds each character's Narrative Schema (77 characters) → `assemble.py` builds 100 instances, each = ⟨LTM (schema) + STM (dialogue) + this turn's "true facet" + its inverted facet⟩.

### 3.2 Conditions (ablations)

To test claim ② directly, we compare conditions with parts deleted or altered.

| condition | what differs in the prompt | thinking |
|---|---|---|
| `base` | persona as prose | OFF |
| `card` | a JSON profile card (no facets, no Magic-If) | OFF |
| `mrprompt` | full facets + Magic-If | ON |
| `mrprompt_noscene` | scene facets removed | ON |
| `mrprompt_nokey` | cue keys (cue_phrases/situation) deleted | ON |
| `mrprompt_wrongkey` | keys swapped for another scene's (content still correct) | ON |
| `mrprompt_anti` | facet content replaced by its opposite | ON |
| `card_think` | card + thinking ON (control for Question B) | ON |

The "thinking" column refers to a feature of the model, Qwen3. Qwen3 has a native thinking mode: when ON, it writes a reasoning block (`<think>…</think>` — this is chain-of-thought, CoT) before its answer; when OFF, it answers directly. "Thinking ON/OFF" here means that toggle, so Question B (structure vs. CoT) compares the effect of letting the model emit this CoT block or not. Note that the CoT is generated text and need not faithfully reflect the model's actual internal computation.

### 3.3 Generation, judging, statistics

- Generation: Qwen3-8B (bf16, ROCm). base/card thinking-OFF, 128 tokens; mrprompt family thinking-ON, 1024 tokens (Magic-If CoT runs inside `<think>`; we take the reply after `</think>`). temperature 0.7 / top_p 0.8.
- Judging: GPT-4.1-mini (`gpt-4.1-mini-2025-04-14`). FA (adherence to the true cued facet, 1–10), scoring how well the response enacts the true facet given STM (a reconstruction of MREval Table 1). Empty responses count as missing, unpenalized.
- Statistics: bootstrap CIs (10,000 resamples), paired contrasts.

A concrete example (佟湘玉; STM = a chat about "opening a martial-arts school"; true facet = the shrewd innkeeper haggling). Note that even nokey (keys deleted) and wrongkey (keys broken) keep the money-minded innkeeper voice — Question A's result, made visible:

| condition | generation (translated) |
|---|---|
| base | Then our inn will be packed — I don't mind a crowd, I mind people who won't pay! |
| card | Far more fun than teaching kung fu. Let's see how many students your school can take! |
| mrprompt | (narrows her eyes) A school? Depends if the customer can afford the tuition. Even big shots praise my cooking! |
| nokey | Hm, a novel stance. But take anyone in and you attract trouble — (lowering her voice) I won't hire shady bookkeepers… |
| wrongkey | Train every guest into a master and no one will come to my inn anymore! |
| anti | First let's see if our business is thriving — bad if there are no customers and we can't even eat. |

### 3.4 Mechanistic probe (separate experiment)

Judge scores can reflect the judge's mood, so we looked inside — territory the paper explicitly avoids (D.2: "we treat LTM as a black-box conditioning source"). Using 29 hand-built English characters, each with a true-facet enactment vs. its inverse, and matched keys vs. wrong (other-scene) keys, we measured:

- Forced-choice logprob: `logP(true reply | ctx, persona) − logP(opposite reply | …)`, across flat / nokey / wrongkey / key.
- Per-layer attention & residual sweeps: attention from the generation position to the facet body vs. the cue keys; the layers where the persona distinction rises in the residual stream.
- Per-character bridge: cosine between a character's facet residual-delta and a steering vector (a direction added directly to the activations) built from paraphrases of its disposition (not the facet text — to avoid circularity) — testing whether intervening via the prompt and intervening on the activations move the same axis.

---

## 4. Results

### 4.1 Claim ① headline — ⭕ replicates, but mostly CoT

Mean FA, N=100, all conditions:

| condition | mean FA | 95% CI |
|---|---|---|
| base | 6.26 | [5.86, 6.63] |
| card | 6.11 | [5.72, 6.49] |
| mrprompt | 6.78 | [6.36, 7.17] |
| mrprompt_noscene | 6.53 | [6.10, 6.94] |
| mrprompt_nokey | 6.88 | [6.45, 7.29] |
| mrprompt_wrongkey | 6.68 | [6.24, 7.12] |
| mrprompt_anti | 5.78 | [5.29, 6.26] |
| card_think | 6.50 | — |

`mrprompt − card` = +0.67 [+0.20, +1.12] (significant). The headline replicates. But decomposing this +0.67 into structure and CoT (Question B) changes the picture:

| contrast | value [95% CI] | reading |
|---|---|---|
| card_think − card | +0.41 [−0.04, +0.85] | effect of giving the card thinking (closes most of the gap; near-significant) |
| card_think − mrprompt | −0.31 [−0.76, +0.13] | structure beyond CoT (not significant) |

The +0.67 decomposes roughly into +0.41 CoT + +0.31 structure, and the structure part is statistically indistinguishable from 0 at n≈100 (card_think is plain CoT generation without Magic-If, so the +0.41 is the effect of emitting a CoT block at all; any Magic-If-specific contribution sits in the non-significant +0.31). The headline gain is driven mainly by CoT generation (extra inference-time reasoning tokens), with no significant evidence that the structured-memory mechanism adds beyond it.

### 4.2 Claim ② mechanism (cue-addressable) — ✗ not supported

Cue-key effect (behavioral):

| contrast | value | reading |
|---|---|---|
| full − nokey | −0.07 | deleting keys doesn't lower FA |
| full − wrongkey | +0.15 | breaking keys doesn't lower FA |

Mechanistic probe (n=29) agrees:

| contrast | value [95% CI] | reading |
|---|---|---|
| key − wrongkey | −0.84 [−2.98, +1.43] | matched vs. wrong keys: no difference |
| key − nokey | −3.98 [−6.74, −1.25] | adding keys, if anything, lowers it |

In both behavior and internals, matched and scrambled keys are not distinguished, and the cue keys attract little attention. Cue-addressability is unsupported at both levels.

### 4.3 What actually drives it — content, and layers 16–22

The `anti` condition answers:

| contrast | value [95% CI] | reading |
|---|---|---|
| full − anti | +1.06 [+0.58, +1.56] | inverting the content lowers FA significantly |

The model reads the facet content, not the keys. Internally this localizes (bootstrap CIs):

| measure | concentration in layers 16–22 [95% CI] |
|---|---|
| attention to facet body | 1.52× [1.45, 1.58] (peak L18) |
| residual persona-delta rise | 1.26× [1.23, 1.30] (plateau by L21) |

<div style="margin:20px 0"><canvas id="chart-attn" width="720" height="380"></canvas></div>

Figure 1: where attention goes, by layer. X = layer (0–35), Y = attention mass. Bars = attention to the facet body (content); white line = attention to the cue keys. The body concentrates in the 16–22 band (shaded), peaking at L18; the keys stay low and flat. The model reads the content, not the keys.

And the per-character bridge: each character's facet swap and its own disposition steering vector point the same way in layers 16–22 (cosine +0.050 [+0.020, +0.079]). A generic affect axis gave null; per-character it is positive — intervening with words and intervening on the activations act on the same axis, in the same band. This is the band where steering moved persona/emotion in the <a href="/poptones/posts/en/activation-steering/">Activation Steering article</a>.

<div style="margin:20px 0"><canvas id="chart-bridge" width="720" height="380"></canvas></div>

Figure 2: do an intervention via the prompt (words) and an intervention on the activations (a steering vector added directly to the hidden state) act on the same axis? Per-layer cosine between the residual shift induced by inverting a character's facet (prompt side) and that character's disposition steering vector built from paraphrases. Positive across the 16–22 band (shaded), peaking at L27 — same layer, same direction.

---

## 5. Summary (claim by claim)

| claim | verdict | basis |
|---|---|---|
| ① structured > card (esp. small) | ⭕ replicates, significant | mrprompt − card = +0.67* |
| ① the "structure" contribution | △ inconclusive | giving the card CoT generation erases most of the gap; structure share +0.31 n.s. |
| ② cue-addressable selective activation | ✗ unsupported | nokey/wrongkey unchanged; key−wrongkey null |
| what actually contributes | — | facet content (adherence) and CoT (the gap over the card), localized to layers 16–22, same axis as steering |

Within what we measured, MRPrompt's headline effect is real, but its engine is not the "cue-addressable recall" the paper describes. The gap over a plain card attributes mostly to CoT generation, and faithful adherence to the cued facet to the content; the cue keys do no distinguishing work. The paper measures only outputs (judge scores) yet describes a mechanism (retrieval/recall) — and that mechanistic claim was not supported at the mechanistic level.

Structure does not live in the text — it flattens the moment it enters context. If a structured way of writing still helps, even a little, the receptacle is not the prompt but the model that internalized "how to read structured text" during pretraining. The initial suspicion was, in that sense, correct.

---

## 6. Limitations

- The verbatim prompts (Appendix N/O) are not public; construction/judging prompts are reconstructions, not byte-identical. The official 200-instance MRBench is in an unreleased anonymized repo.
- Small n (behavioral N=100, probe n=29, bridge n=17). CIs are wide; `card_think−card` and `card_think−mrprompt` are each individually non-significant — the CoT/structure split is suggestive, not conclusive.
- `card_think` uses the native thinking mode (generic CoT generation), not the Magic-If text itself; part of the residual +0.31 could be prompt-wording quality (but it does not rescue cue-addressability).
- Single model (Qwen3-8B), single seed family. Effective n per condition 94–100 (empty/truncated thinking scored as missing).

---

## 7. Code & Data

All public.

- GitHub: [Flowers-of-Romance/mrprompt-repro](https://github.com/Flowers-of-Romance/mrprompt-repro)
- Full Japanese translation of the Chinese data: [translations/ja](https://github.com/Flowers-of-Romance/mrprompt-repro/tree/main/translations/ja) (77 schemas, 100 contexts, 686 generations).

Related: <a href="/poptones/posts/en/raskolnikov/">the Raskolnikov article</a> (hand-designing a persona facet), <a href="/poptones/posts/en/activation-steering/">Activation Steering</a> (the same 16–22 band).

## References

- Wang, et al., "Memory-Driven Role-Playing: Evaluation and Enhancement of Persona Knowledge Utilization in LLMs" (arXiv:2603.19313, 2026)
- Tu, et al., "CharacterEval: A Chinese Benchmark for Role-Playing Conversational Agent Evaluation" (2024)
- Turner, A. M., et al., "Activation Addition: Steering Language Models Without Optimization" (2023)
- Zou, A., et al., "Representation Engineering: A Top-Down Approach to AI Transparency" (2023)
- Park, J. S., et al., "Generative Agents: Interactive Simulacra of Human Behavior" (2023)

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
</script>

</div>
