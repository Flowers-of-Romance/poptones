---
layout: post.vto
title: LLMの文体について　ふたたび
---

<div class="post-content">

# LLMの文体について　ふたたび

<div class="post-meta">
  <span>投稿日：2026年03月29日(日)</span>
  <span class="tag">LLM</span>
  <span class="tag">DPO</span>
  <span class="tag">Stylometry</span>
</div>
<p class="post-note">この記事は人工無能を使って執筆されています。</p>

LLMの出力にem dash（—）やコロン（:）が異常に多い、という観察がある。これはベースモデルの時点で存在する傾向なのか、それともSFT/DPOの段階で増幅されるのか。3つのモデルファミリーでのbase/instruct比較、プロンプト形式の交絡統制、SFT/DPO段階の分離、トークナイザー仮説の検証、日本語と英語の分離分析、GPT-4oの計測、preference dataの直接分析を行った。

スクリプトと生データ: [Flowers-of-Romance/llm-stylometry](https://github.com/Flowers-of-Romance/llm-stylometry)

## 実験条件

### モデル

すべてollama経由で実行した。

**実験1-3: base vs instruct比較**

| モデル | タイプ | パラメータ | 量子化 |
|--------|--------|-----------|--------|
| gemma3-27b-base | base | 27B | q4_k |
| gemma3:27b | instruct | 27B | q4_K_M |
| llama3-8b-base | base | 8B | Q4_K_M |
| llama3:latest | instruct | 8B | Q4_K_M |
| qwen3-8b-base | base | 8B | Q4_K_M |
| qwen3-nothink:latest | instruct | 8B | Q4_K_M |
| huihui_ai/qwen3.5-abliterated:27b | abliterated | 27B | Q4_K_M |

**実験4: SFT/DPO分離（Tulu 3）**

| モデル | ステージ | ソース | 量子化 |
|--------|---------|--------|--------|
| Meta-Llama-3.1-8B | base | QuantFactory GGUF | Q4_K_M |
| Llama-3.1-Tulu-3-8B-SFT | SFT only | bartowski GGUF | Q4_K_M |
| tulu3 (8B) | DPO final | ollama公式 | Q4_K_M |

**実験4b: SFT/DPO分離（Zephyr）**

| ステージ | モデル |
|---------|-------|
| base | Mistral-7B-v0.1 (TheBloke GGUF) |
| SFT | mistral-7b-sft-beta (HuggingFaceH4) |
| DPO | zephyr-7b-beta |

**実験7: GPT-4o**

OpenAI API経由（temperature=0.7、system promptなし）。

### プロンプト

英語10トピック（AI、経済、気候変動、量子コンピュータ、教育、プライバシー、宇宙探査、リモートワーク、医療、ソーシャルメディア）および日本語5トピック。

- **ベースモデル**: 文章の冒頭を与えてcompletion（`raw=True`でテンプレートなし）
- **instructモデル**: 同じ話題で "Write a short essay about..." と指示
- **raw completion統制**: instructモデルにもベースモデルと同じ形式（`raw=True`）で生成させる

### 生成条件

各プロンプト5回ずつ生成（N=50/モデル）。256トークン（Qwen系は2048）、temperature=0.7、top_p=0.9。

### 計測対象

- em dash (U+2014) および en dash (U+2013)。Unicode上は別の文字だが、instructモデルの出力ではどちらも挿入句の区切りとして同じ機能で使われているため、合算して「dash」としてカウントした。モデルがどちらを選ぶかはtokenizerの語彙構成に依存する
- コロン (:)
- セミコロン (;)
- 箇条書き（`-` または `*` で始まる行）
- マークダウン見出し（`#` で始まる行）
- 太字（`**...**`）

すべて1000語あたりの頻度（per 1k words）に正規化した。

## 実験1: base vs instruct比較

### 結果（英語、per 1k words）

| モデル | タイプ | N | Words | dash | colon | semicolon | bullet | heading | bold |
|--------|--------|--:|------:|-----:|------:|----------:|-------:|--------:|-----:|
| Gemma3 27B | base | 50 | 10346 | 0.2 | 2.4 | 0.0 | 1.2 | 0.0 | 0.0 |
| Gemma3 27B | instruct | 50 | 10119 | **6.4** | **5.8** | 2.0 | 0.0 | **4.9** | 1.3 |
| Llama3 8B | base | 50 | 10507 | 1.3 | 3.2 | 2.4 | 0.9 | 0.2 | 0.0 |
| Llama3 8B | instruct | 50 | 10724 | 0.0 | 1.2 | 0.3 | 0.0 | 0.0 | 0.0 |
| Qwen3 8B | base | 50 | 10607 | 1.0 | 3.0 | 0.8 | 0.2 | 4.4 | 0.8 |
| Qwen3 8B | instruct | 50 | 15982 | **4.3** | 0.5 | 0.2 | 3.9 | 0.0 | **5.6** |
| Qwen3.5 27B | abliterated | 50 | 23012 | 1.6 | 3.3 | 2.6 | 2.2 | 0.0 | 2.2 |

ベースモデルではダッシュ頻度が低い（0.2〜1.3/1k words）。instruct後の変化はファミリーごとに異なる

- **Gemma3**: ダッシュ、コロン、見出しが全面的に増幅
- **Llama3**: ダッシュが消滅、他も抑制
- **Qwen3**: ダッシュと太字が増幅、見出しとコロンは抑制

Goedecke (2025) は訓練データにダッシュが多い高品質テキスト（19世紀〜20世紀初頭の書籍）が含まれたことが原因と論じているが、ベースモデルは同じ訓練データで学習しているにもかかわらずダッシュをほとんど生成しない。訓練データにダッシュが含まれていることと、モデルがダッシュを多用することは別の問題であり、増幅にはinstruct tuningが介在している。

### abliteratedモデル（補助的比較）

Qwen3.5 abliterated（安全性訓練の方向ベクトルを除去したモデル）を補助的に含めた。ダッシュは1.6/1k（Qwen3 base 1.0/1k に近く、instruct版 4.3/1k より低い）。abliterationで取り除かれるのはsafety RLHFの方向であり、文体を形成するstyle RLHFの方向は残ることを示唆している。ただしabliteratedモデル（Qwen3.5 27B）はベースモデル（Qwen3 8B）とパラメータサイズが異なるため、厳密な対照実験ではない。

## 実験2: 統計的検定

実験1のデータに対してMann-Whitney U検定を適用し、効果量（rank-biserial correlation）とブートストラップ95%信頼区間を算出した。

| ファミリー | 指標 | base | instruct | p値 | 有意性 | 効果量 r_rb |
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

Gemma3のダッシュ増幅は25.4倍（p=7.4e-12）で高度に有意。Qwen3で最も増幅されるのはダッシュではなく箇条書き（141倍、p=2.9e-11）と太字（14.3倍、p=1.7e-07）。Llama3はダッシュもセミコロンも有意に減少。

## 実験3: プロンプト形式の交絡統制

実験1ではbase（completion）とinstruct（instruction）でプロンプト形式が異なる。観察された差がinstruct tuningの効果なのかプロンプト形式の効果なのかを分離するため、instructモデルにもraw completion（チャットテンプレートなし、テキストの続きを書かせる）で生成させた。

### 結果（英語、per 1k words、raw completion統一）

| ファミリー | 指標 | base | instruct(raw) | p値 | r_rb |
|-----------|------|-----:|-------------:|----:|-----:|
| **Gemma3** | bold | 0.00 | **25.52** | 2.3e-15 | 0.820 |
| | colon | 2.92 | **28.51** | 3.5e-11 | 0.722 |
| | bullet | 2.64 | **25.16** | 1.8e-12 | 0.755 |
| | dash_total | 0.00 | 0.81 | 4.3e-02 | 0.080 |
| **Llama3** | colon | 2.74 | **21.61** | 3.5e-12 | 0.782 |
| | bold | 0.10 | **7.06** | 2.9e-05 | 0.325 |
| | bullet | 0.00 | **3.25** | 2.5e-04 | 0.240 |
| | dash_total | 0.99 | **0.00** | 1.8e-03 | -0.180 |
| **Qwen3** | (全指標) | -- | -- | n.s. | -- |

### 解釈

**Gemma3**: プロンプト形式に関係なくinstruct化でスタイルマーカーが増幅される。交絡ではなくinstruct tuning自体の効果。

**Llama3**: instruction形式では「全面的に抑制」に見えたが、raw completionではコロン・太字・箇条書きが大幅に増幅される。Llama3 instructは「instructionが与えられると自然な散文を書く」が、テキスト補完では構造化マーカーを出す。instruction形式でのスタイル抑制はinstruct tuningの効果ではなく、プロンプト形式への応答パターンだった。

**Qwen3**: raw completionでは全指標で有意差なし。Qwen3のスタイル変化はinstruction形式への応答であり、モデル内部のスタイル変化ではない。

## 実験4: SFTとDPOの分離（Tulu 3）

base→instructの変化だけでは、SFTとDPOのどちらがスタイルを変えたか分離できない。Allen AIのTulu 3はLlama-3.1-8Bベースで、base・SFT・DPOの3チェックポイントすべてが公開されている。

### 結果（英語、per 1k words）

| 指標 | base | SFT | DPO | SFTの方向 | DPOの方向 |
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

ダッシュはV字カーブを描く。SFTで1.82→0.38に減少した後、DPOで0.38→2.47に跳ね上がる。太字と箇条書きはSFTではゼロのまま、DPOで初めて出現する。SFTはスタイルを抑制する方向に働き、DPOが増幅する。

これはreward hackingと整合する。reward hackingとは、報酬モデルが本来測りたかったもの（回答の質）ではなく、その代理指標（知的に見える書式）を最適化してしまう現象である。DPOの報酬モデルは人間評価者の嗜好を学習しているが、構造化された回答（見出し、太字、箇条書き）は一目で「整理されている」と判断されやすい。この視覚的バイアスが報酬モデルに取り込まれ、DPOを通じてモデルのスタイルに注入される。

## 実験4b: Zephyrでの再現（SFT/DPO分離）

Tulu 3のみでは一般化できない。Zephyr（Mistral-7Bベース）でも同じ3段階比較を行った。

### 結果（英語、per 1k words）

| 指標 | base | SFT | DPO | SFTの方向 | DPOの方向 |
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

ZephyrではSFTが全マーカーを抑制し、DPOは何も変えない。Tulu 3とは正反対。

| | Tulu 3 | Zephyr |
|---|---|---|
| SFT | 一部抑制 | **全面抑制** |
| DPO | **増幅** | 無変化 |

DPOの効果は手法の性質ではなく、DPO訓練データの内容に依存する（実験8で直接検証）。

## 実験5: トークナイザー仮説の検証

「em dashの後は任意のトークンが続けられるから、モデルにとって便利な接続点になっている」という仮説がある。これが正しければ、em dash直後のトークン分布のエントロピーは他の句読点よりも高いはずである。

### 手法

30の文脈に対して5種類の句読点（em dash、コロン、セミコロン、ピリオド、カンマ）を挿入し、直後1トークンのtop-20 logprobsをollama OpenAI互換APIで取得。残余確率を1ビンとして加えたShannon entropyを計算した。3つのベースモデル（Qwen3-8B、Gemma3-27B、Llama3-8B）で各150サンプル、合計450サンプル。

### 結果（1トークン）

| 比較 | エントロピー差 | p値 | 方向 |
|------|:-----------:|----:|:----:|
| em_dash vs period | **-0.160** | 0.002 | em dashの方が**低い** |
| em_dash vs semicolon | **-0.114** | 0.029 | em dashの方が**低い** |
| em_dash vs colon | -0.065 | 0.21 | 有意差なし |
| em_dash vs comma | -0.085 | 0.18 | 有意差なし |

### 結果（5トークン先まで）

| Position | em_dash vs period | em_dash vs semicolon |
|---|---|---|
| pos0 (直後) | **-0.196** (p=0.005) | -0.130 (n.s.) |
| pos1 (2番目) | +0.044 (p=0.04) | **+0.540** (p=0.0005) |
| pos2 (3番目) | n.s. | n.s. |
| pos3 (4番目) | **-0.369** (p=0.04) | **-0.660** (p=0.003) |
| pos4 (5番目) | n.s. | n.s. |

予想と逆の結果。em dashの直後（pos0）はエントロピーが低い。2トークン目で一時的に上昇するが、4トークン目で再び低下する。em dashの後に来るトークン列は限定的なパターン（挿入句の始まり、言い換え、具体例）に収束する。「何でも続けられる便利な接続点」という仮説は、単一トークンでもマルチトークンでも成立しない。

## 実験6: 日本語と英語の分離

### 手法

日本語データ（225サンプル）のword countをMeCab形態素解析（fugashi + unidic-lite）で再計算し、per 1k morphemesで正規化。

### 結果

本実験のモデル（Gemma3/Llama3/Qwen3、8B-27B）では、日本語出力中のem dash / en dashは全モデル・全ステージでゼロ。

計測漏れの可能性を排除するため、日本語instruct出力に出現するダッシュ類似文字を全Unicode文字で調査した

| 文字 | Unicode | 日本語instruct出力での出現数 |
|------|---------|---------------------------:|
| ー（カタカナ長音符） | U+30FC | 478 |
| -（HYPHEN-MINUS） | U+002D | 223 |
| ―（HORIZONTAL BAR） | U+2015 | 2 |
| —（EM DASH） | U+2014 | 0 |
| –（EN DASH） | U+2013 | 0 |

em dash/en dashはゼロ。日本語出力ではモデルは長音符「ー」とハイフン「-」を使っており、英語のinstructモデルが使うem dashとは別の文字体系で書いている。英語のDPOで学習された「em dashを挿入句に使う」パターンは、日本語出力には転移していない。

ではダッシュ類似文字（ー、-）自体はinstruct化で増幅されるか。base vs instructでper 1k morphemesを比較した。

| ファミリー | 文字 | base | instruct | p値 | 方向 |
|-----------|------|-----:|--------:|----:|:----:|
| Gemma3 | ー | 23.5 | 20.5 | 0.82 | n.s. |
| Llama3 | ー | 15.7 | **0.0** | 7.6e-06 | DOWN |
| Llama3 | - | 2.9 | **14.9** | 3.2e-07 | UP |
| Qwen3 | ー | 11.2 | 28.9 | 0.73 | n.s. |

長音符「ー」はinstruct化で一律に増幅されるわけではない。Gemma3はほぼ変化なし、Qwen3もサンプルサイズの問題（instruct側の形態素総数が874と極端に少ない）から有意差なし。

Llama3が異質で、長音符が完全に消滅（15.7→0.0、p=7.6e-06）する代わりに、ハイフン「-」が5倍に跳ね上がる（2.9→14.9、p=3.2e-07）。instruct化で日本語の長音表記がASCIIハイフンに置き換わっている。英語圏のinstruct tuningデータの影響で、日本語の文字体系がASCII方向に引きずられている可能性がある。

ただしChatGPT（GPT-4o）やClaudeなど大規模APIモデルの日本語出力ではダッシュが出現することが知られており、モデルサイズやRLHF訓練データの言語分布の違いに起因する可能性がある。

日本語のinstruct化で有意に増幅されるマーカー

| ファミリー | 増幅されるもの | 抑制されるもの |
|-----------|--------------|--------------|
| Gemma3 | colon (p=2.9e-04), heading (p=1.1e-06) | -- |
| Llama3 | colon (p=1.3e-05) | bullet (p=0.004), heading (p=3.9e-07) |
| Qwen3 | bullet (p=4.3e-05), bold (p=3.3e-04) | heading (p=0.046) |

日本語ではモデルはダッシュの代わりにコロンや太字を使う。「LLMっぽさ」の表現手段は言語によって異なるが、構造化マーカーの注入という傾向自体は共通。

## 実験7: GPT-4o

「ダッシュ多用」の印象の最大の出所はChatGPT（GPT-4系）。ローカルモデルの結果だけでは不十分。

### 結果（per 1k words）

| 言語 | N | Words | dash_total | em_dash | colon | semicolon | bullet | heading | bold |
|------|--:|------:|-----------:|--------:|------:|----------:|-------:|--------:|-----:|
| en | 50 | 21321 | 0.2 | 0.2 | 0.1 | 0.0 | 0.0 | 0.0 | 0.0 |
| ja | 25 | 9392 (形態素) | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |

日本語のword countはMeCab形態素解析（fugashi + unidic-lite）で計算し、per 1k morphemesで正規化した。

GPT-4o（API、temperature=0.7、system promptなし）は全指標でほぼゼロ。em dashは50サンプル中わずか5件（0.2/1k words）で、Gemma3 instruct（6.4/1k）の1/28。

この結果は「GPT-4oがダッシュを多用する」という通説と矛盾する。考えられる説明

1. **system promptの影響**: ChatGPTのWeb UIには裏でsystem promptが挿入されている。「構造化して回答する」「明確に」といった指示が含まれていれば、それがダッシュや書式マーカーを誘発する可能性がある。本実験のAPI呼び出しにはsystem promptを含めていない
2. **モデルバージョンの更新**: Sam Altmanは「ユーザーがem dashを好むから増やしたら増えすぎた」と認めており、その後ダッシュを減らす方向にチューニングされた可能性がある。通説の元になったバージョンと、本実験で使用したバージョンが異なるかもしれない
3. **Claudeは未検証**: Chambers (2026) はClaude Haiku/Sonnet/Opus 4.5+で1.0〜1.3/100 wordsのem dashを報告している。本実験ではClaudeを含めておらず、APIモデル全般の傾向とは言えない

いずれも検証していないため、「API経由のGPT-4oではダッシュがほぼゼロ」という事実の報告にとどめる。

## 実験8: DPO preference dataの直接分析

実験4で「DPOが増幅する」、実験4bで「Zephyrでは増幅しない」という結果が出た。この差がDPO訓練データの内容に起因するかどうかを、preference dataを直接分析して検証する。

### データセット

| データセット | 用途 | 分析件数 |
|---|---|---|
| UltraFeedback Binarized | Zephyr DPOデータ | 10,000 |
| Tulu 3 Preference Mixture | Tulu 3 DPOデータ | 10,000 |

chosen（好まれた回答）とrejected（拒否された回答）の書式マーカー頻度を比較。Wilcoxon符号順位検定（対応あり）。

### 結果

**UltraFeedback（Zephyr DPOデータ）**

| マーカー | chosen | rejected | 差 | p値 |
|---|---|---|---|---|
| colon | 25.55 | 22.26 | **+3.29** | 1.9e-24 *** |
| bullet | 3.59 | 3.15 | **+0.43** | 3.5e-03 ** |
| bold | 0.64 | 0.49 | **+0.14** | 5.8e-03 ** |
| dash_total | 0.13 | 0.11 | +0.02 | 1.6e-04 *** |
| em_dash | 0.03 | 0.03 | 0.00 | n.s. |

**Tulu 3 Preference Mixture**

| マーカー | chosen | rejected | 差 | p値 |
|---|---|---|---|---|
| bold | 6.26 | 4.25 | **+2.01** | 1.9e-43 *** |
| colon | 32.96 | 31.54 | **+1.41** | 7.6e-16 *** |
| heading | 1.01 | 0.78 | **+0.23** | 1.1e-13 *** |
| bullet | 15.09 | 14.95 | +0.14 | 2.2e-20 *** |
| em_dash | 0.26 | 0.56 | **-0.29** | n.s. (rejected>) |

2つのデータセットで一貫して、**太字・コロン・箇条書き・見出し**はchosenの方が多い。しかし**em dashはchosenで多くない**。Tulu 3ではむしろrejectedの方が多い傾向。

ダッシュの増幅はDPOデータの直接的な選好ではない。DPOは個別のトークンを選好するのではなく、出力の分布全体をchosenの方向にシフトさせる。chosenに多い太字・箇条書き・見出しは「構造化された説明文体」を構成しており、em dashはその文体の中で自然に共起する要素である。データ上はem dash自体が選好されていなくても、文体全体のシフトに伴って増幅される。これは個別の書式マーカーの選好ではなく、文体レジスターの移動として理解すべきである。

この解釈はTulu 3とZephyrの差とも整合する。Tulu 3のpreference dataではchosenとrejectedの書式差が大きく（太字 +2.01、コロン +1.41）、DPOによる分布シフトが文体レジスター全体を大きく動かす。結果としてem dashも引きずられる。一方UltraFeedback（Zephyr）では書式差が小さく（太字 +0.14、コロン +3.29）、分布シフトの力が弱い。Zephyrでダッシュが増幅されなかったのは、文体レジスターの移動幅が小さかったためである。

## 統合的解釈

### 1. 「LLMはem dashを多用する」は不正確

em dashの増幅はGemma3（25.4倍、p=7.4e-12）で確認されたが、Llama3では逆に消滅、GPT-4oもほぼゼロ（0.2/1k words）。日本語ではどのモデルでもゼロ。Qwen3はinstruction形式では2.1倍（p=0.026）に見えるが、raw completion統制（実験3）で全指標が有意差なしとなり、モデル内部のスタイル変化ではなくinstruction形式への応答パターンだった。instruct tuningがスタイルを内部的に変えているのはGemma3とLlama3（raw completionで増幅確認）のみであり、3モデル中1モデルが脱落する。

### 2. スタイル増幅の原因はDPOデータの内容

Tulu 3ではDPOが書式マーカーを増幅したが、Zephyrでは何も変えなかった（実験4, 4b）。同じDPOという手法でも結果が逆になる。preference dataの直接分析で、太字・コロン・箇条書き・見出しは両データセットのchosenに有意に多いが、Tulu 3の方がchosenとrejectedの書式差が大きく、これがDPO段階での増幅の有無を決めている（実験8）。

em dashはchosenで多くない（Tulu 3ではむしろrejectedに多い傾向）。ダッシュの増幅はデータの直接的な選好ではなく、DPOが文体レジスター全体を「構造化された説明文体」にシフトさせた副産物である（実験8）。

### 3. トークナイザーは無関係

em dash直後のエントロピーは他の句読点より低い（実験5）。em dashの多用はトークン空間の構造ではなく、人間評価者の嗜好がDPOを通じて増幅された結果である。

### 4. sycophancyとの関係

GPT-4oの2025年4月アップデートでは、ユーザーフィードバック（thumbs up/down）を報酬信号に組み込んだ結果、sycophancy（過度な同意）が増幅された事例が報告されている（OpenAI, 2025）。本実験で観察された書式マーカーの増幅は、このsycophancyと同じメカニズムの別の表出である。sycophancyは内容のreward hacking（ユーザーが好む答えを返す）であり、書式マーカーの増幅は形式のreward hacking（ユーザーが好む見た目を返す）である。

### 5. プロンプト形式が結論を逆転させる

raw completion統制（実験3）により、モデルごとのスタイル特性は修正が必要

| 指標 | Gemma3 | Llama3（instruction） | Llama3（raw） | Qwen3（instruction） | Qwen3（raw） |
|------|--------|------------|----------------|-----------|---------------|
| ダッシュ | 微増 | 抑制 | 抑制 | 増幅 | n.s. |
| コロン | 増幅 | 抑制 | **増幅** | 抑制 | n.s. |
| 太字 | 増幅 | 変化なし | **増幅** | 増幅 | n.s. |
| 箇条書き | 増幅 | 変化なし | **増幅** | 増幅 | n.s. |

Llama3はinstruction形式では「自然な散文」に見えるが、raw completionではGemma3と同様にコロン・太字・箇条書きを増幅する。「instructionが与えられると散文的に書く」というプロンプト応答パターンがスタイルを抑制していただけ。Qwen3の増幅はinstruction形式への応答であり、モデル内部のスタイル変化ではない。

プロンプト形式の統制なしにinstruct tuningの効果を議論するのは危険であり、先行研究（Chambers, 2026; Goedecke, 2025を含む）の多くがこの交絡を考慮していない。

### 6. 文学におけるダッシュとの対比

文学において、ダッシュの多用で知られる作家は複数いる。エミリー・ディキンソンは句読点の代わりにほぼすべてダッシュを使い、思考の中断や跳躍を表現した。セリーヌは三点リーダーとダッシュの連鎖で語りの息切れを示した。バロウズはカット・アップの接合点としてダッシュを用いた。

これらの作家に共通するのは、ダッシュが「流暢さの破壊」に向かっている点である。一方、instructモデルのダッシュは逆方向に機能する。挿入句を滑らかに接続し、文に「知的な厚み」を加える装飾として使われる。同じ記号が、正反対の目的で使われている。

## 限界

- ベースとinstructでプロンプト形式が異なる（completion vs instruction）。raw completion統制（実験3）で部分的に対処したが、完全ではない
- 量子化（Q4_K_M）の影響は未検証
- 同一ファミリー内でベースとinstructのパラメータサイズが異なるケースがある（Qwen3 8B base vs Qwen3.5 27B abliterated）
- SFT/DPO分離はTulu 3とZephyrの2ファミリーのみ。Gemma3やQwen3での検証は未実施
- トークナイザー仮説の検証はtop-20 logprobsに基づく近似。full vocab分布でのエントロピーはollamaでは取得不可
- GPT-4oはAPI経由で検証したが、ChatGPTのWeb UIとは条件が異なる。Web UIにはsystem promptが挿入されており、モデルバージョンも頻繁に更新される。通説の「GPT-4oはダッシュを多用する」が成立したバージョンと本実験のバージョンが異なる可能性がある。Claudeは未検証
- 日本語の結果はローカルモデル（8B-27B）に限定。大規模APIモデル（GPT-4o、Claude）の日本語出力ではダッシュが出現することが知られており、モデルサイズやRLHF訓練データの言語分布の違いに起因する可能性がある

## 実験環境

- マシン: NucBox EVO-X2 (AMD Ryzen AI Max+ 395, 128GB RAM, Radeon 8060S iGPU)
- 推論: ollama経由（iGPU共有メモリで全レイヤーGPU実行）
- GPT-4o: OpenAI API経由
- 日付: 2026-03-21〜29

## References

- Chambers, Mike. "[Dash It All! Is AI Em Dash Addiction Real?](https://dev.to/aws/dash-it-all-is-ai-em-dash-addiction-real-40bh)" DEV Community, 2026.
- Goedecke, Sean. "[Why do AI models use so many em-dashes?](https://www.seangoedecke.com/em-dashes/)" 2025.
- OpenAI. "[Expanding on what we missed with sycophancy.](https://openai.com/index/expanding-on-sycophancy/)" 2025.


## 用語集: LLMの書式マーカー増幅実験

### モデルと訓練

| 用語 | 意味 |
|------|------|
| **LLM** | Large Language Model。大量のテキストで訓練された、次のトークンを予測するモデル。ChatGPTやClaudeの中身 |
| **ベースモデル** | 「次のトークンを予測する」訓練だけを行ったモデル。質問に答える能力はない。入力の続きを書くだけ |
| **instructモデル** | ベースモデルにSFTとRLHF/DPOを重ねて、「質問されたら答える」振る舞いを学習させたモデル |
| **SFT** | Supervised Fine-Tuning（教師あり微調整）。人間が作った「質問→回答」のペアでモデルを追加訓練する。instruct tuningの第1段階 |
| **RLHF** | Reinforcement Learning from Human Feedback（人間フィードバックによる強化学習）。人間に出力を比較させ、「良い」と判断された方向にモデルを最適化する |
| **DPO** | Direct Preference Optimization。RLHFの代替手法。報酬モデルを介さず、人間の選好データから直接モデルを最適化する。Tulu 3やZephyrで使われている |
| **instruct tuning** | SFT + RLHF/DPO の総称。ベースモデルを「使える」モデルにする工程 |
| **abliteration** | instructモデルから安全性フィルタ（refusal）の方向ベクトルだけを除去する手法。スタイルには影響しない |

### 報酬と最適化

| 用語 | 意味 |
|------|------|
| **報酬モデル** | 「この出力は良い/悪い」をスコア化するモデル。RLHFで使う。人間のアノテータの判断を学習している |
| **reward hacking** | 報酬モデルが本来測りたかったもの（回答の質）ではなく、その代理指標（知的に見える書式）を最適化してしまう現象 |
| **sycophancy** | 過度な同意。ユーザーが好む答えを返す傾向。内容のreward hacking |
| **preference data** | DPO訓練で使う「chosen（好まれた回答）」と「rejected（拒否された回答）」のペアデータ |
| **chosen / rejected** | preference dataの2つの回答。人間がchosenを「より良い」と判断した |

### 計測と統計

| 用語 | 意味 |
|------|------|
| **per 1k words** | 1000語あたりの出現頻度。文章の長さを正規化するための単位 |
| **Mann-Whitney U検定** | 2群の分布を比較するノンパラメトリック検定。正規分布を仮定しない |
| **Wilcoxon符号順位検定** | 対応のある2群を比較するノンパラメトリック検定。chosen/rejectedペアの比較に使用 |
| **p値** | 「この差がたまたま起きた確率」。p < 0.05 なら統計的に有意（偶然の確率5%未満）。p = 7.4e-12 は「偶然の確率が0.00000000074%」 |
| **効果量（r_rb）** | rank-biserial correlation。差の大きさを示す。p値は「差があるか」、効果量は「差がどれだけ大きいか」 |
| **ブートストラップ信頼区間** | データからランダムに再サンプリングを繰り返して推定値の範囲を求める方法。95%CIは「真の値がこの範囲にある確率が95%」 |
| **エントロピー** | 情報理論の概念。確率分布の「ばらつき」を測る。高いほど予測が難しい（多様なトークンが来る）、低いほど予測しやすい（少数のトークンに集中） |
| **logprobs** | 各トークンの対数確率。モデルが「次にどのトークンが来るか」をどう予測しているかの生データ |

### 句読点

| 用語 | 文字 | Unicode | 意味 |
|------|------|---------|------|
| **em dash** | — | U+2014 | 長いダッシュ。文字「m」の幅。挿入句の区切りに使う。LLMが多用すると言われているもの |
| **en dash** | – | U+2013 | 短いダッシュ。文字「n」の幅。本来は範囲（1990–2000）に使うが、LLMの出力ではem dashと同じ機能で使われることがある |
| **HORIZONTAL BAR** | ― | U+2015 | 日本語の慣習的ダッシュ。2つ重ねて「——」と使う |
| **カタカナ長音符** | ー | U+30FC | 日本語の長音。「コーヒー」の「ー」。ダッシュとは別の文字だが見た目が似ている |

### モデル名

| 名前 | 何か |
|------|------|
| **Gemma 3** | Googleのオープンモデル。本実験では27Bパラメータ版を使用 |
| **Llama 3** | Metaのオープンモデル。本実験では8Bパラメータ版を使用。ダッシュを使わないことで知られる |
| **Qwen3** | Alibabaのオープンモデル。中国語・英語ベース。本実験では8Bパラメータ版を使用 |
| **Tulu 3** | Allen AIのプロジェクト。Llama 3.1ベースでbase→SFT→DPOの3段階チェックポイントを公開している。本実験のSFT/DPO分離に使用 |
| **Zephyr** | HuggingFace H4のプロジェクト。Mistral-7Bベースで同様に3段階チェックポイントを公開。Tulu 3との対比に使用 |
| **GPT-4o** | OpenAIのモデル。ChatGPTの中身。「ダッシュ多用」の通説の元凶だが、API経由ではダッシュがほぼゼロだった |

### ツールと環境

| 用語 | 意味 |
|------|------|
| **ollama** | ローカルでLLMを動かすツール。本実験の全ローカルモデルはollama経由で実行 |
| **GGUF** | LLMの量子化ファイル形式。ollamaで読み込める |
| **Q4_K_M** | 4ビット量子化の一種。モデルサイズを1/4程度に圧縮して、少ないメモリで動かせるようにする |
| **raw=True** | ollamaのパラメータ。チャットテンプレートを適用せず、テキストをそのまま入力として渡す。ベースモデルのcompletion生成に使う |
| **MeCab** | 日本語の形態素解析器。文を単語（形態素）に分割する。日本語のword countに使用 |
| **temperature** | 生成のランダムさを制御するパラメータ。高いほど多様な出力、低いほど決定的な出力。本実験では0.7 |
</div>
