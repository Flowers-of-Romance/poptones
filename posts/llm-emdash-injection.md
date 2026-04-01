---
layout: post.vto
title: "LLMの文体について em dash注入実験"
---

<div class="post-content">

# LLMの文体について　em dash注入実験

<div class="post-meta">
  <span>投稿日：2026年04月01日(火)23時19分24秒</span>
  <span class="tag">LLM</span>
  <span class="tag">SFT</span>
  <span class="tag">Stylometry</span>
</div>
<p class="post-note">この記事は人工無能を使って執筆されています。<span class="lang-switch"><a href="/poptones/posts/en/llm-emdash-injection/">English</a></span></p>

## 前回の結論

[前回の記事](/poptones/posts/llm-emdash-dpo/)では、8段階の実験を通じて以下を示した

- **「LLMはem dashを多用する」は不正確な一般化。** em dashの増幅はGemma3で確認されたが、Llama3では消滅、GPT-4oもほぼゼロ。日本語では全モデルで出現なし
- **DPOのchosenデータにem dashの直接的な選好シグナルは存在しない。** chosenで有意に多いのはコロン・太字・箇条書き・見出し。em dashは「構造化された説明文体」への文体レジスターシフトの副産物
- **同じDPO手法でも結果は訓練データ次第。** Tulu 3ではダッシュがV字曲線（base→SFT→DPO）を描くが、Zephyrでは変化なし
- **トークナイザー仮説は否定。** em dash直後のトークンエントロピーは他の句読点より低い

結論は「em dashの増幅は副産物」。ではその先、**副産物であるなら、em dashは他の文体要素と不可分に結合しているのか、それとも独立なのか？** 今回はこの問いに介入実験で答える。

## 実験設計

### なぜ注入（injection）なのか

抑制実験（em dashを消す）は「相関を切る」操作だが、注入は「相関を作る」操作。因果推論の観点で、注入で構造マーカーが連動して増えれば、em dashと文体レジスターが双方向に結合している証拠になる。

### モデル選定

Qwen2.5-1.5B-Instructを使う。em dashのベースライン頻度が**完全にゼロ**（50生成で1回も出現しない）で、ノイズがゼロのクリーンな介入実験ができる。1.5BならCPU訓練が現実的。

### なぜDPOではなくSFTか

最初にDPOを試みたが、失敗した。accuracy 28%（ランダムの50%以下）で、モデルが逆方向に引っ張られていた。原因はcross-model DPO。Tulu 3が生成したテキストはQwen2.5にとって「自然な」トークン列ではなく、chosen/rejectedどちらもreference modelから等しく遠いため、log-prob比の差がノイズに埋もれる。SFTは単純なnext-token predictionなのでこの問題がない。

### 訓練設定

- ベースモデル: Qwen/Qwen2.5-1.5B-Instruct
- 手法: SFT + LoRA (r=32, alpha=64)
- ターゲット: q/k/v/o_proj + gate/up/down_proj
- データ: 200サンプル, 5エポック, 学習率 2e-5
- ハードウェア: AMD Ryzen AI Max+ 395, 128GB RAM, CPU訓練

## 実験1: Tulu 3データによるSFT

Tulu 3（8B, DPO済み）にプロンプトを与えて応答を生成。em dashを2回以上含む応答を200件収集し、SFTデータとした。

### 結果

| マーカー | baseline | SFT (Tulu 3) | p値 |
|---|---|---|---|
| **em dash** | 0.000 | 7.397 | **6.4e-14 \*\*\*** |
| **colon** | 3.603 | 5.664 | **1.4e-4 \*\*\*** |
| **semicolon** | 0.238 | 2.185 | **2.6e-5 \*\*\*** |
| bold | 0.490 | 1.102 | 0.19 n.s. |
| bullet | 0.000 | 0.080 | 0.33 n.s. |
| heading | 0.000 | 0.086 | 0.33 n.s. |

値はすべて1000語あたりの頻度。Mann-Whitney U検定（両側）。N=50。

em dashだけでなく、コロンとセミコロンも有意に増加。一方で箇条書き・見出し・太字は変化なし。

一見、em dashとコロン・セミコロンが「句読点サブレジスター」として結合しているように見える。だがこのデータにはTulu 3の文体全体が含まれている。コロン・セミコロンの増加がem dashとの内部結合なのか、Tulu 3の文体を丸ごと学習した結果なのか区別できない。

訓練データ内のem dash-コロン相関は-0.19（共起なし）だったが、これはトークン頻度レベルの話で、「Tulu 3らしい文章はコロンもセミコロンも多い」という文体レベルの共起は排除できない。

## 実験2: 自己注入SFT

confoundを排除するため、**Qwen2.5-1.5B自身の出力にem dashを機械的に挿入**してSFTした。

手順

1. Qwen2.5-1.5B-Instructで応答を生成
2. カンマ区切りの挿入句（", which", ", including", ", however," など）をem dashに機械的に置換
3. em dashが2つ以上挿入された応答を200件収集
4. これでSFT（同一のLoRA設定、5エポック）

重要な統制: 置換前後でコロン・セミコロンの頻度は変化しない（colon/1k: 12.67→12.52、semicolon/1k: 0.05→0.05）。操作しているのは**em dashのみ**。

### 結果

| マーカー | baseline | SFT (Tulu 3) | SFT (自己注入) |
|---|---|---|---|
| **em dash** | 0.000 | 7.397 \*\*\* | **12.467 \*\*\*** |
| **colon** | 3.603 | **5.664 \*\*\*** | 2.917 n.s. |
| **semicolon** | 0.238 | **2.185 \*\*\*** | 0.231 n.s. |
| bold | 0.490 | 1.102 n.s. | 0.895 n.s. |
| bullet | 0.000 | 0.080 n.s. | 0.158 n.s. |
| heading | 0.000 | 0.086 n.s. | 0.000 n.s. |

**自己注入SFTではem dashだけが増加**（0→12.5/1k, p=3.3e-20）し、コロン・セミコロンは全く変化しなかった。

## 解釈

### em dashは他の句読点から独立している

純粋にem dashだけを操作した場合、コロン・セミコロンは連動しない。

実験1でコロン・セミコロンが増えたのは、Tulu 3の文体全体をQwen2.5が学習したため。em dashとの内部結合ではない。

### 副産物説は依然として成立する

em dashの増幅がDPOの直接選好ではなく副産物であるという前回の結論は覆っていない。DPO preference dataにem dashの選好シグナルがないことは事実。

変わったのは副産物の**メカニズム**の理解。em dashはコロン・セミコロンと内部結合しているのではなく、文体レジスター全体のシフトに個別に随伴している。各句読点は独立に増減可能で、DPOが特定の文体を選好するとき、その文体に含まれる個別要素がそれぞれ増幅される。

### 実験設計の教訓

1. **cross-model SFTのconfound**: モデルAの出力でモデルBをfine-tuneすると、モデルAの文体全体が注入される。特定のトークンだけの効果を見たいなら、モデル自身の出力を機械的に操作する必要がある
2. **相関分析では不十分**: 訓練データ内のトークン共起がゼロでも、文体レベルの共起は排除できない。介入実験の統制条件が必要

## 限界

- **1.5Bモデルのみ**: 8Bで再現するにはGPU環境が必要
- **機械的挿入の自然さ**: カンマ→em dashの置換は文法的に自然だが、人間が書くem dashの用法すべてをカバーしていない
- **em dashの増幅幅が大きい**: 自己注入（12.5/1k）がTulu 3 SFT（7.4/1k）より大きい。自身の分布内のデータの方が学習効率が高いためと考えられるが、増幅幅の違いが結果に影響している可能性は排除できない

## 再現方法

スクリプトと生データ: [Flowers-of-Romance/llm-stylometry](https://github.com/Flowers-of-Romance/llm-stylometry)

```bash
# 実験1: Tulu 3データSFT（Ollamaでtulu3が必要）
python emdash_injection_dpo.py
python emdash_injection_sft.py --use_cpu --epochs 5

# 実験2: 自己注入SFT（CPU約90分）
python emdash_injection_self_sft.py

# 評価
python emdash_injection_eval.py eval \
  --model Qwen/Qwen2.5-1.5B-Instruct --label baseline
python emdash_injection_eval.py eval \
  --model emdash_injection/models/sft --lora --label sft
python emdash_injection_eval.py eval \
  --model emdash_injection_self/models/sft_self --lora --label sft_self

# 3条件比較
python emdash_injection_eval.py compare \
  emdash_injection/eval_baseline.json \
  emdash_injection/eval_sft.json \
  emdash_injection/eval_sft_self.json
```

環境: NucBox EVO-X2 (AMD Ryzen AI Max+ 395, 128GB RAM), WSL2 Ubuntu, PyTorch 2.5.1+rocm6.2 (CPU fallback)

</div>
