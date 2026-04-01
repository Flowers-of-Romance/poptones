---
layout: post.vto
title: "LLMの文体について em dashは独立している"
---

<div class="post-content">

# LLMの文体について　em dashは独立している

<div class="post-meta">
  <span>投稿日：2026年04月01日(火)</span>
  <span class="tag">LLM</span>
  <span class="tag">SFT</span>
  <span class="tag">Stylometry</span>
</div>
<p class="post-note">この記事は人工無能を使って執筆されています。<span class="lang-switch"><a href="/poptones/posts/en/llm-emdash-injection-2/">English</a></span></p>

[前回の記事](/poptones/posts/llm-emdash-dpo/)で、em dashの増幅はDPOの直接的な選好ではなく「構造化された説明文体」への文体レジスターシフトの副産物だと結論した。[続く記事](/poptones/posts/llm-emdash-injection/)では、em dashを含む文体をSFTで注入したらコロン・セミコロンも連動して増加し、「句読点サブレジスター」が存在すると主張した。

**その主張は間違っていた。** 追加実験で、コロン・セミコロンの増加はem dashとの内部結合ではなく、訓練データのソースモデル（Tulu 3）の文体を丸ごと学習した結果であることが判明した。

## 何が起きたか

前回の注入実験では、Tulu 3（8B）が生成したem dashを含む応答でQwen2.5-1.5Bをfine-tuneした。結果、em dashだけでなくコロン・セミコロンも有意に増加した。

しかしこのデータにはem dash以外にもTulu 3固有の文体が含まれている。コロン・セミコロンの増加がem dashとの内部結合なのか、Tulu 3の文体全体を学習しただけなのか区別できない。

訓練データ内でem dashとコロン・セミコロンの共起がないこと（相関 -0.19 / -0.01）は確認していたが、これは不十分だった。トークンレベルの共起がなくても、文全体のスタイルとして「Tulu 3らしさ」がコロン・セミコロンを含んでいれば、モデルはそれを学習する。

## 自己注入実験

confoundを排除するため、**Qwen2.5-1.5B自身の出力にem dashを機械的に挿入**してSFTした。

手順

1. Qwen2.5-1.5B-Instructで応答を生成
2. カンマ区切りの挿入句（", which", ", including", ", however," など）をem dashに機械的に置換
3. em dashが2つ以上挿入された応答を200件収集
4. これでSFT（同一のLoRA設定、5エポック）

重要な統制: 置換前後でコロン・セミコロンの頻度は変化しない（colon/1k: 12.67→12.52、semicolon/1k: 0.05→0.05）。操作しているのは**em dashのみ**。

## 結果

| マーカー | baseline | SFT (Tulu 3) | SFT (自己注入) |
|---|---|---|---|
| **em dash** | 0.000 | 7.397 \*\*\* | **12.467 \*\*\*** |
| **colon** | 3.603 | **5.664 \*\*\*** | 2.917 n.s. |
| **semicolon** | 0.238 | **2.185 \*\*\*** | 0.231 n.s. |
| bold | 0.490 | 1.102 n.s. | 0.895 n.s. |
| bullet | 0.000 | 0.080 n.s. | 0.158 n.s. |
| heading | 0.000 | 0.086 n.s. | 0.000 n.s. |

値はすべて1000語あたりの頻度。Mann-Whitney U検定（両側）。N=50。

自己注入SFTでは**em dashだけが増加**（0→12.5/1k, p=3.3e-20）し、コロン・セミコロンは全く変化しなかった。

## 解釈

### em dashは他の句読点から独立している

純粋にem dashだけを操作した場合、コロン・セミコロンは連動しない。「句読点サブレジスター」は存在しなかった。

前回の実験でコロン・セミコロンが増えたのは、Tulu 3の文体全体をQwen2.5が学習したため。em dashとの内部結合ではない。

### 訓練データの共起分析だけでは不十分

前回、訓練データ内のem dash–コロン相関（-0.19）を根拠にconfoundを否定した。しかしこれはトークン頻度レベルの共起であり、文体レベルの共起（「Tulu 3らしい文章はコロンもセミコロンも多い」）は捉えられない。

confoundの排除には相関分析ではなく**介入実験の統制**が必要だった。自己注入実験はまさにそれ。

### 副産物説は依然として成立する

em dashの増幅がDPOの直接選好ではなく副産物であるという前回の結論は覆っていない。DPO preference dataにem dashの選好シグナルがないことは事実。

変わったのは副産物の**メカニズム**。em dashはコロン・セミコロンと内部結合しているのではなく、文体レジスター全体のシフトに個別に随伴している。各句読点は独立に増減可能で、DPOが特定の文体を選好するとき、その文体に含まれる個別要素がそれぞれ増幅される。

## 実験設計の教訓

1. **cross-model SFTのconfound**: モデルAの出力でモデルBをfine-tuneすると、モデルAの文体全体が注入される。特定のトークンだけの効果を見たいなら、モデル自身の出力を機械的に操作する必要がある
2. **相関分析では不十分**: 訓練データ内のトークン共起がゼロでも、文体レベルの共起は排除できない。介入実験の統制条件が必要
3. **自分の結論を疑え**: 前回の「句読点サブレジスター」は綺麗な結論だったが、統制実験一つで覆った

## 限界

- **1.5Bモデルのみ**: 8Bで再現するにはGPU環境が必要
- **機械的挿入の自然さ**: カンマ→em dashの置換は文法的に自然だが、人間が書くem dashの用法すべてをカバーしていない
- **em dashの増幅幅が大きい**: 自己注入（12.5/1k）がTulu 3 SFT（7.4/1k）より大きい。自身の分布内のデータの方が学習効率が高いためと考えられるが、増幅幅の違いが他のマーカーへの影響に関係している可能性は排除できない

## 再現方法

スクリプトと生データ: [Flowers-of-Romance/llm-stylometry](https://github.com/Flowers-of-Romance/llm-stylometry)

```bash
# 自己注入SFT（データ生成+訓練、CPU約90分）
python emdash_injection_self_sft.py

# 評価
python emdash_injection_eval.py eval \
  --model Qwen/Qwen2.5-1.5B-Instruct --label baseline
python emdash_injection_eval.py eval \
  --model emdash_injection_self/models/sft_self --lora --label sft_self

# 比較（3条件）
python emdash_injection_eval.py compare \
  emdash_injection/eval_baseline.json \
  emdash_injection/eval_sft.json \
  emdash_injection/eval_sft_self.json
```

環境: NucBox EVO-X2 (AMD Ryzen AI Max+ 395, 128GB RAM), WSL2 Ubuntu, PyTorch 2.5.1+rocm6.2 (CPU fallback)

</div>
