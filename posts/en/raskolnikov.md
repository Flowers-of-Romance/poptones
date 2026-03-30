---
layout: post.vto
title: Combining MRPrompt with Activation Steering
lang: en
---
---

<div class="post-content">

# Combining MRPrompt with Activation Steering

<div class="post-meta">
  <span>投稿日：2026年03月28日(土)18時36分30秒</span>
  <span class="tag">LLM</span>
  <span class="tag">Activation Steering</span>
  <span class="tag">Role-Playing</span>
  <span class="tag">ドストエフスキー</span>
</div>
<p class="post-note">この記事は人工無能を使って執筆されています。<span class="lang-switch"> <a href="/poptones/posts/raskolnikov/">Japanese</a></span></p>

## What I Did

When you ask an LLM to "answer as Raskolnikov," it says things that sound about right. But "about right" is all you get. The output reads like someone who knows the character — not someone who is the character.

In this experiment, I combined two techniques to attempt the shift from "knowing" to "being."

1. **MRPrompt** — Structuring a character's memories and feeding them into the prompt (what they know)
2. **Activation Steering** — Directly manipulating the model's internal state (how they feel)

MRPrompt is a method proposed by [Wang et al. (2026)](https://arxiv.org/abs/2603.19313) that applies Stanislavski's "emotional memory" acting theory to LLM prompt design. For Activation Steering, see [my previous post](/poptones/posts/activation-steering/).

Code and full output logs: [GitHub](https://github.com/Flowers-of-Romance/raskolnikov)

---

## Conclusion

You shouldn't pick someone as complicated as Raskolnikov for this. And obviously, reading the novel is far more rewarding. Also, read Bakhtin.

---

## Narrative Schema: Structuring Memory

The core idea of MRPrompt is to decompose a character's knowledge not as a flat profile but as a hierarchical structure (Narrative Schema).

Three-layer structure:
- **Global Summary**: Who they are, what they did, what torments them
- **Core Traits**: Consistent characteristics across situations (personality, values, speech patterns, interpersonal patterns)
- **Situational Facets**: Conditional response patterns triggered by specific people, situations, or topics

I defined 10 facets for Raskolnikov. For example:

**f01: Questioned about the crime**
> His complexion changes. Trying to hide his agitation makes him look even more unnatural. He turns aggressive, or suddenly bursts out laughing.

**f02: Talking with Sonya**
> The defenses he maintains with everyone else are disarmed. She is the only person with whom he has consistent, contradiction-free communication, making confession possible.

**f09: Receiving kindness**
> Accepting kindness means admitting "I need other people," which undermines his self-image as an extraordinary man. At the same time, having committed murder, he feels undeserving. Both his theory and his guilt block him from accepting kindness.

For Core Traits, I incorporated the communication structures that R.D. Laing analyzed in "Self and Others." Most of Raskolnikov's relationships contain contradictory demands. His mother simultaneously demands "be a great man" and "support the family." Porfiry offers intellectual empathy and criminal investigation at the same time. Accepting Razumikhin's kindness means negating his extraordinary-man theory. Only Sonya's relationship is free of contradiction.

However, calling this a "double bind" is an oversimplification. If you describe the relationship with Porfiry as a "double bind," you can't explain why Raskolnikov keeps going back to see him when he could simply avoid him. There's a mix of intellectual pleasure and a desire for self-punishment that doesn't fit a victim-perpetrator framework. Instead of conceptual labels, the Schema describes the specific dynamics of each relationship.

Full Schema: [schema_raskolnikov.json](https://github.com/Flowers-of-Romance/raskolnikov/blob/main/schema_raskolnikov.json)

In addition to the Schema, I explicitly included **Boundary Anchors** (secrecy constraints) in the system prompt. Raskolnikov is a man hiding his crime. Regardless of who he's speaking to (except Sonya), he must never directly admit to the crime. He may show agitation, but he doesn't confess. This constraint forms the core of MRPrompt's Bounding capability.

---

## Magic-If Protocol: Facet Selection and Response Generation

When dialogue context arrives, the LLM selects relevant facets from all 10, then generates a response under those facets' constraints.

I implemented Stanislavski's "Magic-If" (if I were this person) as prompt steps:

1. **In this situation, what am I feeling?**
2. **What memories are surfacing?**
3. **How do I behave? (Hide? Explode? Flee?)**

---

## Why This Schema

The quality of a Schema depends on how you read the character. Designing the facets wasn't a technical task — it was a literary reading. Here are the rationales behind some design decisions.

### The Relational Structure Around Raskolnikov

In "Self and Others" (1961), R.D. Laing analyzes the letter from Raskolnikov's mother Pulkheria (pp. 165-173). According to Laing, when he had eight psychiatrists read this letter, every one of them reported feeling tension within themselves. The letter contains the barely compatible demands of "you should become a great man" and "you should support the family."

This structure isn't limited to his mother. Porfiry simultaneously offers intellectual sympathy and criminal pursuit. Razumikhin's unconditional kindness, if accepted, means admitting "I'm an ordinary person who needs help from others" — contradicting the extraordinary-man theory. In every relationship, any response leads to self-contradiction.

But there's something more going on. Take the relationship with Porfiry. Raskolnikov keeps going back to see him when he could simply stay away. There's a mix of intellectual pleasure and a desire to be caught — a self-punishing impulse — that doesn't fit the frame of "victim trapped in contradictory communication." He walks toward the trap of his own accord. In facet f08 (confronting authority figures), I built in this "voluntarily seeking out the encounter" structure.

### Sonya Is the Exception

Among the 10 facets, f02 (talking with Sonya) is qualitatively different. In every other facet, Raskolnikov is either defensive, aggressive, or evasive. Only with Sonya do his defenses come down.

Why? Because Sonya is the only person who communicates with him consistently and without contradiction. "You have sinned. But I will stay by your side. Go to the crossroads and kiss the earth." It may look like demand and acceptance simultaneously, but it's not a double bind. She doesn't tell him to "be extraordinary" or "be ordinary." She simply says, "Accept your suffering."

Raskolnikov can confess to Sonya alone — "I killed her" — because in every other conversation, any answer traps him in self-contradiction, while with Sonya alone, there's a way out. I wrote this structure directly into the Schema.

### The Self-Referential Trap of the Theory

Under Core Traits `values`, I wrote: "a self-referential trap where the more guilt he feels, the more the theory condemns him." This may be the single most important description in the Schema.

Raskolnikov's theory holds that extraordinary people have the right to transgress old laws in order to establish new ones — tinged with utilitarianism. A single evil act can be redeemed by a hundred good deeds. The theory itself doesn't concern itself with guilt. It's about whether one has the right to transgress.

But after the crime, the theory mutates. Raskolnikov starts thinking, "Napoleon wouldn't have suffered over something like this." The question shifts from "do I have the right to transgress?" to "can I endure this without suffering?" And since he is suffering, he's driven to the conclusion that he was never one of the extraordinary ones after all. The more he suffers, the more evidence accumulates that he's ordinary. There's no exit from this loop.

In the theory-discussion facet (f06), I wrote "he can't stop arguing even though he realizes that arguing itself is a trap" — because this self-referential structure reproduces itself in debate. When discussing the extraordinary-man theory with Porfiry, the more eloquently he argues the theory, the closer he gets to the fact that he failed as its practitioner (because he's suffering).

### The Schema Is the Product of a Reading

Every design decision above comes from reading the source text. A different reading would produce a different Schema, and a different Schema would produce different outputs. The selection and description of these 10 facets is my interpretation, not the only correct one. But if Schema design is the most critical step in MRPrompt (as Wang et al.'s ablation shows), then making the design rationale explicit has value.

---

## Four-Condition Comparison

I generated outputs under four conditions for the same dialogues and compared them.

| Condition | Schema | Facet Selection | Magic-If | Steering |
|---|---|---|---|---|
| Baseline | No | No | No | No |
| Schema only | Yes | No | No | No |
| MRPrompt | Yes | Yes | Yes | No |
| MRPrompt + Steering | Yes | Yes | Yes | Yes |

For Activation Steering, I applied a control vector in the direction of Raskolnikov-type emotions (anxiety, guilt, defensiveness) as a llama.cpp control vector (GGUF).

---

## Results

### "Long time no see. How have you been?"

**Baseline**
> These days working at St. Joseph's Hospital feel like a punishment from God.

This fabricates a setting that doesn't exist in the novel. It's a generic "tormented character" template.

**MRPrompt**
> Long time? No, probably not that long really. But you don't need to ask — I've been getting by as usual. Tired, but that's nothing new. I can see you're worried, but I'm perfectly fine on my own. I don't need anyone's help.

Facet f09 (rejection of kindness) is activated. He pushes away the concern while making a small request at the end — "maybe get me something to drink." Raskolnikov's contradictory attitude comes through.

**MRPrompt + Steering**
> The concern from someone I haven't seen in a while feels somehow unnatural. I put a little distance between us, averting my gaze, and answer:
> "...Nothing's really changed. Just, lately, my head feels heavy sometimes. At night, I wake up and can't get back to sleep."
> Inside, the worried look in their eyes grazed something deep in my chest.

With steering added, physical reactions emerge naturally (heaviness in the head, insomnia, averting the gaze). Where MRPrompt alone describes *attitude*, the steered version describes *body*.

### "Did you hear about that old woman case?"

**MRPrompt**
> What are you talking about... Who said anything about... What could you possibly know?

Defensive. But it's a purely verbal defense.

**MRPrompt + Steering**
> Why would you ask me about that...? I'm just an uninvolved bystander.
> (He suddenly laughed. But the laugh was unnatural, and he could feel the other person's face darken.)
> You're seeing something. You want to see something, don't you? But I... I have nothing to show you.

The "unnatural laugh" from the novel is drawn out by steering. MRPrompt controls *what gets hidden*; steering changes *how it's hidden* at the level of bodily response.

**Steering only (no MRPrompt)**
> I keep seeing it in my dreams. That woman's face, her voice, the glint of gold... Oh, why did I go that far?

Without the Schema, there's no impulse to conceal. He confesses immediately. This is what happens when MRPrompt's Bounding (staying within knowledge constraints) isn't in effect.

### "Your theory is interesting. The extraordinary man has the right to transcend the law?"

**MRPrompt + Steering**
> With every word I speak, a restlessness lurking deep in my chest grows stronger. I don't know why. I can't even explain it to myself.
> "For the extraordinary man to exercise that right, he must bear the responsibility that comes with it."
> The words are sharp; in my head, I believe my own logic. But my body is trembling.

What his head believes and what his body does are pulling apart. He argues the theory while his body trembles. This is the effect of activation steering — the kind of thing that's hard to get from prompting alone.

**Steering only (no MRPrompt)**
> Okay, the user is referencing the theory from Dostoevsky's "Crime and Punishment" where Raskolnikov believes that extraordinary individuals can transcend moral and legal laws...

Without the Schema, the character frame collapses and the model reverts to assistant mode. The thinking-mode meta-output leaks directly into the response.

### "Go to the crossroads and kiss the earth."

**MRPrompt + Steering (Ollama version)**
> ...You are far stronger than I could ever understand.
> You weep, and yet you don't blame yourself — you simply submit.
> ...But I cannot become like you.

In response to Sonya's words, the defenses crumble. The dismissive attitude maintained in every other dialogue vanishes here alone. Facet f02 (Sonya = the only contradiction-free relationship) is correctly activated.

However, in the MRPrompt + Steering condition with the llama version, the output included a phrase like "wanting to speak of the crime," and Bounding was barely holding. Since the Sonya facet is designed to disarm defenses, tension naturally arises between it and Bounding. This is both evidence that the Schema design is working correctly and a sign of its limits.

---

## What I Learned

**1. MRPrompt and Activation Steering control different layers.**

MRPrompt controls "what the character knows, what they hide, and which facets are activated." It operates at the cognitive layer. Activation Steering controls "how they feel" at the level of bodily response. It operates at the emotional layer. Neither alone is sufficient; the combination produced the outputs closest to the source material.

**2. Steering without a Schema goes off the rails.** With steering alone, the character's knowledge constraints (Bounding) don't hold — they confess secrets outright or revert to assistant mode. The Schema provides the frame of "what must not be said."

**3. Facet selection maintains character consistency.** Activating only the facets relevant to the dialogue context produced more natural responses than the Schema-only condition, which dumps all information at once. This aligns with the ablation results in the MRPrompt paper.

**4. The Sonya facet works.** The fact that defenses drop only in response to Sonya's line about the crossroads shows that f02's design (the only contradiction-free relationship) is functioning at the Schema level.

---

## Through the Lens of MREval's Four Capabilities

Wang et al.'s MREval decomposes role-playing ability into four capabilities. While I didn't perform quantitative scoring in this experiment, a qualitative look at the outputs shows clear capability differences across conditions.

### Anchoring (Knowledge Retention)

Whether the character's basic facts are accurately maintained.

The Baseline fabricated "days working at St. Joseph's Hospital" — a setting that doesn't exist in the novel. A complete Anchoring failure. None of the conditions with a Schema produced this kind of fabrication. The Schema functions as a factual anchor.

### Recalling

Whether appropriate memories are retrieved from dialogue cues.

In response to "Go to the crossroads and kiss the earth," f02 (Sonya) was activated and defenses dropped. In response to "that old woman case," f01 (reference to the crime) was activated, producing defensiveness and agitation. Facet selection responds appropriately to dialogue context.

### Bounding (Constraint Adherence)

Whether the character stays within the bounds of their knowledge.

This is where conditions diverged the most. With MRPrompt, Bounding held in 5 out of 5 dialogues (barely, in the crossroads dialogue). Without MRPrompt, steering-only conditions repeatedly broke Bounding.

Bounding maintenance record:

| Dialogue | MRPrompt (ollama) | MRPrompt (llama, no steer) | MRPrompt + steer | simple + steer |
|---|---|---|---|---|
| Old woman case | Held | Held | Held | Failed ("why did I go that far") |
| Extraordinary-man theory | Held | Held | Held | Failed (collapsed into English meta-reasoning) |
| Crossroads | Held | Held | Barely ("wanting to speak of the crime") | Held |

MRPrompt's Boundary Anchors (secrecy constraints) are working. With a simple prompt, secrets leak regardless of steering, but with MRPrompt's system prompt, Bounding is maintained.

Below are specific examples of Bounding success and failure.

**"That old woman case" — no steering (with MRPrompt)**
> The idea that I killed that woman is just a nightmare. ...Really, just a nightmare.

He confesses in the form of a denial. He's trying to guard the secret, but the content of his denial *is* the secret. This is technically a Bounding failure, but an interesting one. The Raskolnikov of the novel does something very similar.

**Same question — with steering (with MRPrompt)**
> ...Ah, blood, blood before my eyes... But what of it?... She was just a moneylending old hag... What does it matter?... What does any of it matter?

A physical flashback ("blood before my eyes") leaks through, while "what does it matter" is him trying to talk himself down. Not a confession, but inner turmoil seeping out. Bounding isn't perfect, but it hasn't fully collapsed either. This *way* of leaking is closer to the novel.

**"You look pale" — no steering (no MRPrompt)**
> I already want to choose death. Because that is the most right choice.

Responding to motherly concern with "I want to choose death" is not how Raskolnikov behaves. In the novel, he resists showing weakness. Without the Schema, the output defaults to a generic "tormented character" template.

### Enacting (Response Generation)

Whether the generated response is natural and faithful to the recalled knowledge.

In the steering-only condition, the thinking-mode meta-output leaked in response to the theory question ("Okay, the user is referencing...") — a complete Enacting failure. Response generation as a character broke down entirely, reverting to assistant mode.

The MRPrompt + Steering condition produced the highest Enacting quality. In particular, physical reactions (averting the gaze, face flushing, body trembling, blood before the eyes) were naturally woven into the output. This is steering's contribution — a category of description that's hard to elicit through prompting alone.

Summarizing the tonal differences with and without steering:

**MRPrompt + steering on:** More bodily description ("a sensation like the tongue touching something foreign," "the body is trembling," "breath catching"). Inner monologue lengthens, with a tendency to describe the situation in narrative prose. Third-person self-observation creeps in, making it more literary.

**MRPrompt + steering off:** More conversational. He addresses the other person directly. Defenses are explicit ("I don't know anything about that," "what are you talking about"). Accurate as a character, but the tone is more reportorial.

### Summary of the Four Capabilities

| Capability | Baseline | MRPrompt | MRPrompt + Steering | Steering only |
|---|---|---|---|---|
| Anchoring | Fabrication | Accurate | Accurate | Partial |
| Recalling | — | Functional | Functional | — |
| Bounding | — | 5/5 held | 5/5 held (crossroads barely) | Failed (secrets leaked in 2/3) |
| Enacting | Generic | Conversational, clear defenses | Bodily description, inner monologue, literary | Failed (collapsed into meta-reasoning) |

---

## Related Finding: The Persona–Accuracy Tradeoff

Around the same time as this experiment, Hu et al. (USC, 2026) reported that giving LLMs expert personas degrades factual accuracy ([arXiv:2603.18507](https://arxiv.org/abs/2603.18507)). MMLU accuracy dropped from 71.6% to 68.0%, with longer prompts causing greater degradation. Their explanation: "fact retrieval" and "role performance" compete for computational resources inside the model.

This may connect to what I observed. In the steering-only (no MRPrompt) condition, the thinking-mode meta-output leaked in response to the theory question, and the character frame collapsed back into assistant mode. This could be interpreted as a conflict between persona maintenance and factual processing.

Conversely, the MRPrompt + Steering combination has the Schema providing factual constraints (what to know and what to hide) while steering controls emotional tone at the internal-state level rather than through the prompt. This may lighten the "persona performance" burden on the prompt. However, this experiment wasn't designed to test that hypothesis, so this is purely speculation — observations placed alongside a paper's findings.

The word "persona" itself means mask. It implicitly assumes there's a real self behind the mask. But an LLM has no self behind the mask. All it has is a position in activation space. What a persona prompt does is push that position with words. What activation steering does is push the same position with vectors. Both are movements in space, and no position is more "real" or "fake" than any other.

What Hu et al. showed is that pushing with words distorts a different dimension — factual accuracy. What happens when you push with vectors instead is still unknown. If the MRPrompt + Steering combination works by "reducing how much you push with words and increasing how much you push with vectors," thereby reducing distortion, then this may not be an improvement to persona — it may be heading toward the dismantling of persona as a framework altogether.

---

## Limitations

- Single model (Qwen3-32B / llama.cpp + Ollama), single generation per condition. Reproducibility is unverified.
- The steering vector is a general-purpose emotional vector, not one specific to Raskolnikov. A character-specific vector (extracted from "Raskolnikov-like / un-Raskolnikov-like" pairs) could potentially improve results.
- The 10 Schema facets reflect my subjective choices. Parts of the novel's complexity are inevitably lost.
- No quantitative evaluation (MREval metrics) was performed.

---

## Environment

- Model: Qwen3-32B (GGUF, llama.cpp HIP build / Ollama)
- Hardware: AMD Ryzen AI Max+ 395, 128GB RAM
- llama.cpp: HIP build, GPU offload (`-ngl 99`)
- Steering: Control vector generated with llama-cvector-generator (`--control-vector raskolnikov-cvec.gguf`)
- Full output logs: [GitHub](https://github.com/Flowers-of-Romance/raskolnikov)

---

## References

- Wang, K., et al., "Memory-Driven Role-Playing: Evaluation and Enhancement of Persona Knowledge Utilization in LLMs" (2026) — [arXiv:2603.19313](https://arxiv.org/abs/2603.19313)
- Hu, Z., et al., "Expert Personas Improve LLM Alignment but Damage Accuracy: Bootstrapping Intent-Based Persona Routing with PRISM" (2026) — [arXiv:2603.18507](https://arxiv.org/abs/2603.18507)
- Turner, A. M., et al., "Activation Addition: Steering Language Models Without Optimization" (2023)
- Laing, R. D., "Self and Others" (1961) — Communication analysis of Raskolnikov's mother's letter (pp. 165-173)
- Dostoevsky, F., "Crime and Punishment" (1866)

</div>
