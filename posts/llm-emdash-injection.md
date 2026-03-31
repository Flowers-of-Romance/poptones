---
layout: post.vto
title: "LLMの文体について em dash注入実験"
---

<div class="post-content">

# LLMの文体について　em dash注入実験

<div class="post-meta">
  <span>投稿日：2026年04月01日(火)</span>
  <span class="tag">LLM</span>
  <span class="tag">DPO</span>
  <span class="tag">SFT</span>
  <span class="tag">Stylometry</span>
</div>
<p class="post-note">この記事は人工無能を使って執筆されています。</p>

## 前回の結論

[前回の記事](/poptones/posts/llm-emdash-dpo/)では、8段階の実験を通じて以下を示した

- **「LLMはem dashを多用する」は不正確な一般化。** em dashの増幅はGemma3で確認されたが、Llama3では消滅、GPT-4oもほぼゼロ。日本語では全モデルで出現なし。モデル依存・訓練データ依存・言語依存・プロンプト形式依存の複合体
- **DPOのchosenデータにem dashの直接的な選好シグナルは存在しない。** chosenで有意に多いのはコロン・太字・箇条書き・見出し。em dashは「構造化された説明文体」への文体レジスターシフトの副産物
- **同じDPO手法でも結果は訓練データ次第。** Tulu 3ではダッシュがV字曲線（base→SFT→DPO）を描くが、Zephyrでは変化なし
- **トークナイザー仮説は否定。** em dash直後のトークンエントロピーは他の句読点より低く、「多様な接続が可能で便利だから多用される」という仮説は支持されない

結論は「em dashの増幅は副産物」。ではその先、**副産物であるなら、em dashは他の文体要素と不可分に結合しているのか、それとも独立なのか？** 今回はこの問いに介入実験で答える。

## 問いの整理

前回のDPO preference dataの直接分析で分かったこと

| データセット | em dash chosen/1k | em dash rejected/1k | p値 |
|---|---|---|---|
| UltraFeedback | 0.028 | 0.026 | 0.14 (n.s.) |
| Tulu 3 | 0.263 | 0.558 | 0.99 (n.s.) |

DPOの訓練データでは、chosenとrejectedの間にem dash頻度の有意差がない。Tulu 3に至ってはrejected側の方が多い。一方でコロン（p ≈ 0）、太字（p < 0.01）、箇条書き（p < 0.01）はchosenで有意に多い。

つまりDPOは「構造化された説明文体」を選好しており、em dashはその文体レジスターに付随して増幅されている。

ここで新しい問いが生まれる

1. em dashと構造マーカーは双方向に結合しているか？ em dashを注入したとき、構造マーカーも連動して増えるか？
2. 結合があるとして、どのレベルで結合しているか？ 句読点レベル？ マークダウン構造レベル？ 全体？

## 実験設計

### なぜ注入（injection）なのか

抑制実験（em dashを消す）は「相関を切る」操作だが、注入は「相関を作る」操作。因果推論の観点で、注入で構造マーカーが連動して増えれば、副産物説より強い主張ができる。em dashと文体レジスターが双方向に結合している証拠になる。

### モデル選定

Qwen2.5-1.5B-Instructを使う。理由

- em dashのベースライン頻度が**完全にゼロ**（50生成で1回も出現しない）
- ノイズがゼロのクリーンな介入実験ができる
- 1.5BならCPU訓練が現実的

### 訓練データ

Tulu 3（8B, DPO済み）にプロンプトを与えて応答を生成。em dashを2回以上含む応答を200件収集。これをSFTデータとする。

### なぜDPOではなくSFTか

最初にDPOを試みたが、失敗した。accuracy 28%（ランダムの50%以下）で、モデルが逆方向に引っ張られていた。

原因はcross-model DPO。DPOのlossは

```
L = -log σ(β * (log π(y_w|x)/π_ref(y_w|x) - log π(y_l|x)/π_ref(y_l|x)))
```

tulu3が生成したテキストはQwen2.5のトークナイザで再トークン化されるが、Qwen2.5にとって「自然な」トークン列ではない。chosen/rejectedどちらもreference modelから等しく遠く、log-prob比の差がノイズに埋もれる。accuracy < 50%は「学習が足りない」ではなく「勾配の方向が間違っている」ことを示唆しており、エポックやlrを上げても解決しない。

SFTは単純なnext-token predictionなので、この問題が存在しない。

### 訓練設定

- ベースモデル: Qwen/Qwen2.5-1.5B-Instruct
- 手法: SFT + LoRA (r=32, alpha=64)
- ターゲット: q/k/v/o_proj + gate/up/down_proj
- データ: 200サンプル, 5エポック
- 学習率: 2e-5
- ハードウェア: AMD Ryzen AI Max+ 395, 128GB RAM, CPU訓練（約56分）

## 結果

| マーカー | baseline | SFT後 | 変化 | p値 |
|---|---|---|---|---|
| **em dash** | 0.000 | 7.397 | **+7.40** | **6.4e-14 \*\*\*** |
| **colon** | 3.603 | 5.664 | **+2.06** | **1.4e-4 \*\*\*** |
| **semicolon** | 0.238 | 2.185 | **+1.95** | **2.6e-5 \*\*\*** |
| bold | 0.490 | 1.102 | +0.61 | 0.19 (n.s.) |
| bullet | 0.000 | 0.080 | +0.08 | 0.33 (n.s.) |
| heading | 0.000 | 0.086 | +0.09 | 0.33 (n.s.) |

値はすべて1000語あたりの頻度。Mann-Whitney U検定（両側）。N=50。

## 解釈

### em dashは句読点サブレジスターと結合している

em dashを含む文体をSFTで学習させたところ、em dash自体の増幅（0→7.4/1k）に加えて、コロン（+2.1, p=1.4e-4）とセミコロン（+1.9, p=2.6e-5）が有意に増加した。

一方、箇条書き・見出し・太字（マークダウン構造マーカー）は変化しなかった。

これは文体レジスターが**少なくとも2層に分かれている**ことを示唆する

1. **句読点レジスター**: em dash, コロン, セミコロン → 相互に結合
2. **マークダウン構造レジスター**: 箇条書き, 見出し, 太字 → 句読点レジスターとは独立

前回の記事で「DPOが文体レジスター全体を構造化された説明文体にシフトさせた」と結論したが、「全体」ではなかった。em dashの増幅は句読点サブレジスターの連動であり、マークダウン構造とは不可分ではない。

### データの共起ではなくモデル内部の結合

SFT後にコロン・セミコロンが増えた原因として、「訓練データ内でem dashとコロン・セミコロンが共起していただけ」という代替説明がありうる。これを検証するため、SFT訓練データ200件の内部相関を分析した。

| | em dash vs colon | em dash vs semicolon |
|---|---|---|
| ピアソン相関 | **-0.194** | **-0.012** |

em dashとコロンはむしろ弱い負の相関、セミコロンとはほぼ無相関。さらに、tulu3のem dashあり応答（SFT訓練データ）とem dashなし応答でコロン・セミコロン頻度を比較すると

| | em dashあり応答 | em dashなし応答 |
|---|---|---|
| colon/1k | 8.96 | 9.03 |
| semicolon/1k | 0.93 | 0.95 |

差はない。つまり**訓練データ内にem dashとコロン・セミコロンの共起は存在しない**。にもかかわらずSFT後にコロン・セミコロンが有意に増加した。

これはデータの共起を学習した結果ではなく、**モデル内部で句読点トークンが結合した表現を持っている**ことを示す。em dashの使用を促すSFTが、句読点レジスター全体を活性化させた。

### 前回の結果との整合性

前回のTulu 3 DPOデータ分析では、chosenで有意に多かったのはコロン、太字、箇条書き、見出しだった。今回の実験では、em dashの注入がコロン・セミコロンを引き連れたが、太字・箇条書き・見出しは連動しなかった。

これは矛盾しない。DPOのchosenデータは「構造化された説明文体」全体を含んでおり、句読点レジスターとマークダウン構造レジスターの両方がchosenで多い。しかし両者は独立に変動可能で、em dashは句読点レジスター側にのみ結合している。

### DPO失敗の教訓

cross-model DPOの失敗（accuracy < 50%）は、DPOが暗黙にreference modelの分布内でのペア比較を前提としていることを実験的に確認した結果でもある。異なるモデルファミリーの出力をDPOデータに使う場合、テキストの表層的な品質が高くても、log-probability空間での差分がノイズ化する。この問題はSFTでは発生しない。

## 限界

- **1.5Bモデルのみ**: 8Bモデルで再現するにはGPU環境が必要
- **SFTデータがtulu3由来**: em dashだけでなくtulu3の文体全体を学習している可能性がある。ただし訓練データ内にem dashとコロン・セミコロンの共起がないことは確認済み
- **因果の方向が未検証**: em dash→コロンの方向は確認したが、逆方向（コロン注入→em dash増加？）は未検証。双方向結合かem dashからの片方向結合かは不明

## 再現方法

スクリプトと生データ: [Flowers-of-Romance/llm-stylometry](https://github.com/Flowers-of-Romance/llm-stylometry)

```bash
# 1. データ生成（Ollamaでtulu3が必要）
python emdash_injection_dpo.py

# 2. SFT訓練（CPU, 約56分）
pip install torch transformers trl peft datasets scipy accelerate
python emdash_injection_sft.py --use_cpu --epochs 5

# 3. 評価
python emdash_injection_eval.py eval \
  --model Qwen/Qwen2.5-1.5B-Instruct --label baseline
python emdash_injection_eval.py eval \
  --model emdash_injection/models/sft --lora --label sft

# 4. 比較
python emdash_injection_eval.py compare \
  emdash_injection/eval_baseline.json \
  emdash_injection/eval_sft.json
```

環境: NucBox EVO-X2 (AMD Ryzen AI Max+ 395, 128GB RAM), WSL2 Ubuntu, PyTorch 2.5.1+rocm6.2 (CPU fallback)

</div>
