---
layout: post.vto
title: 感情の幾何学はモデルを超えるか——Gemma 3 12Bでの追試
---

<div class="post-content">

# 感情の幾何学はモデルを超えるか——Gemma 3 12Bでの追試

<div class="post-meta">
  <span>投稿日：2026年04月13日(日)</span>
  <span class="tag">LLM</span>
  <span class="tag">Mechanistic Interpretability</span>
  <span class="tag">Emotion</span>
  <span class="tag">Gemma</span>
  <span class="tag">Activation Steering</span>
</div>
<p class="post-note">この記事は人工無能を使って執筆されています。</p>

## 要約

Anthropicが2026年4月に公開した論文 "[Emotion Concepts and their Function in a Large Language Model](https://transformer-circuits.pub/2026/emotions/index.html)" は、Claude Sonnet 4.5の内部に感情概念の線形表現を発見し、それが行動を因果的に駆動することを示した。

本記事では、同じ実験をGemma 3 12B（Google DeepMind）で追試した結果を報告する。CUDAなし、128GB RAMのWindowsマシン上で、CPUのみで全実験を実施した。

主な発見
- **affective circumplex（valence × arousal の2軸構造）がGemma 3 12Bの内部にも存在する**
- **感情の幾何学は浅い層ではなく深い層（Layer 42/48）に現れる**
- **感情ベクトルのactivation steeringで出力が因果的に変化する**
- **感情の幾何学はbaseモデルに既に存在し、post-trainingで強化される**

---

## 背景：Anthropicの論文が見つけたもの

Anthropicの論文は171個の感情語に対応する線形ベクトル（"emotion vectors"）をClaude Sonnet 4.5から抽出した。これらのベクトルをPCAすると、第1主成分がvalence（快-不快）、第2主成分がarousal（覚醒度）に対応し、心理学で知られるaffective circumplex（感情の円環構造。Russell, 1980）と一致する幾何学が現れた。

彼らはこれを "functional emotions" と呼んだ——感情と同型の機能的パターンであり、主観的体験を含意しない。

問題は、これがSonnet 4.5に固有の現象なのか、それともLLM一般に見られる構造なのかだ。

---

## 実験設計

### モデル
- **google/gemma-3-12b-it**（instruct-tuned）
- **google/gemma-3-12b-pt**（base / pretrained）

### 環境
- Windows 11, AMD Ryzen, 128GB RAM
- CUDA なし（CPU推論のみ）
- PyTorch 2.11.0+cpu, transformers 5.6.0.dev0

### データ
25の感情 × 10のトピック = 250ストーリー + 10ニュートラルベースライン = 260テキスト

感情はaffective circumplexの4象限をカバーするよう選定した

| +valence +arousal | +valence -arousal | -valence +arousal | -valence -arousal |
|---|---|---|---|
| excited | calm | angry | sad |
| enthusiastic | relaxed | afraid | bored |
| thrilled | serene | desperate | depressed |
| joyful | content | anxious | gloomy |
| proud | peaceful | furious | melancholy |
| happy | | panicked | tired |
| | | | nostalgic, guilty |

各ストーリーは約100語の英語散文。キャラクターが指定された感情を体験するが、感情の名前自体は文中に出現しない。トピックは "a job interview", "cooking dinner", "walking in a park", "receiving a letter", "waiting at a train station", "fixing a broken machine", "watching the sunset", "moving to a new city", "visiting a hospital", "talking to a stranger" の10種。

### ニュートラルベースライン

difference-in-meansで引くニュートラルテキスト（10本）は、同じ10トピックについて感情的要素を排除した事実描写。例: 「She arrived at the building five minutes early, signed in at reception, and was given a visitor badge. The interview lasted forty minutes...」。行動の記述のみで、比喩、内面描写、感情的語彙を含まない。このベースラインの選び方が結果に影響する点には留意が必要。

### 手法

**difference-in-means**: 各感情のストーリー群（10本）の全層mean-pooled hidden stateの平均から、ニュートラル群（10本）の平均を引く。結果は各感情 × 各層のベクトル（dim=3840）。

**PCA**: 特定の層について、25感情のベクトルを行列（25 × 3840）にしてPCAを適用。上位2主成分を抽出。

**circumplex alignment score**: PCAの上位2成分と、affective circumplexから予測されるvalence/arousal値との相関で定義。具体的には

```
score = max(
    |corr(PC1, valence)| + |corr(PC2, arousal)|,
    |corr(PC1, arousal)| + |corr(PC2, valence)|
)
```

PC1がvalence、PC2がarousalに対応する場合と、逆の場合の両方を考慮し、大きい方を取る。理論的な最大値は2.0（両軸が完全に対応）。本記事では便宜的に1.5以上をStrong、1.0-1.5をModerate、1.0未満をWeakと分類した。この閾値は事前に定義されたものではなく、結果の解釈の補助として事後的に設定したものであり、統計的な有意水準ではない。

**Activation steering**: 感情ベクトルにスカラー係数alpha を掛けて、特定の層のforward hook経由でhidden stateに加算する。KV cacheを使わない手動autoregressiveループで各ステップにhookを適用。do_sample=Falseのgreedy decoding。

**Base vs instruct比較**: 同一の260テキストで両モデルからベクトルを抽出し、ノルム・方向（コサイン類似度）・PCA構造を比較。

---

## 結果 1: 感情の幾何学の発見

### 5感情での初期実験

最初にhappy, sad, angry, calm, desperateの5感情 × 10ストーリーで実験した。全49層（embedding層 + 48 transformer層）をスイープした結果から3層を抜粋

| 層 | circumplex alignment score | PC1-Arousal r | PC2-Arousal r |
|---|---|---|---|
| Layer 2 | **1.715**（ベスト） | -0.762 | +0.637 |
| Layer 20 | 1.262 | -0.615 | +0.590 |
| Layer 42 | 1.144 | -0.692 | +0.133 |

5感情では**浅い層（Layer 2）が最も強い構造**を示した。5感情は文体差が大きく（例: happyストーリーは明るい比喩を多用し、sadストーリーは短文が多い）、浅い層の語彙・文体レベルの表現で十分に分離できた可能性が高い。

### 25感情への拡張

25感情 × 10ストーリーに拡張すると状況が変わった。全49層スイープの結果から

| 層 | circumplex alignment score | PC1-Arousal r | PC2-Valence r |
|---|---|---|---|
| Layer 2 | 1.124 | -0.092 | -0.667 |
| Layer 8 | 1.193 | -0.717 | +0.475 |
| Layer 12 | 1.260 | -0.742 | -0.518 |
| Layer 27 | 1.401 | -0.673 | -0.728 |
| Layer 34 | 1.512 | -0.769 | -0.743 |
| Layer 42 | **1.526**（ベスト） | -0.724 | -0.802 |
| Layer 48 | 1.206 | +0.672 | +0.534 |

**ベストレイヤーがLayer 2からLayer 42に移動した。** 全49層のスイープでスコアのピークが明確に後半層に移動している。Layer 8付近に小さなピーク（1.193）、Layer 12に中間ピーク（1.260）があり、Layer 27以降で1.4を超え、Layer 34-42で最も高い構造を示す。最終層（Layer 48）ではスコアが低下し、符号が反転する。

この移動は、difference-in-meansが「何を」拾っているかの直接的な証拠になっている。

5感情では、happyストーリーに"gleam"や"laughed"が出てきてsadストーリーに"quiet"や"alone"が出てくる——この語彙差だけでLayer 2の表現空間で十分に分離できる。しかし25感情に拡張すると、calm, relaxed, serene, peaceful, contentの5つを区別する必要が生じる。これらは語彙レベルでの差が小さい（どれも"quiet", "slowly", "softly"のような語を共有する）。浅い層の文体特徴では区別できず、深い層がエンコードするより抽象的な概念レベルの表現——「穏やかだが能動的な静けさ」(serene) vs「受動的な満足」(content) のような——に頼らざるを得なくなる。

言い換えれば、**浅い層で取れるものは文体のconfound**であり、**深い層で取れるものがより概念的な構造**。5感情の実験でLayer 2がベストだったのは、感情の幾何学を見つけたのではなく、文体差を見つけていた可能性が高い。25感情でLayer 42に移動して初めて、文体を超えた構造が浮かび上がった。

Anthropicの論文では「early-middle layers encode emotional connotations of present content, while middle-late layers encode emotions relevant to predicting upcoming tokens」と記述されているが、感情数の拡張によるベストレイヤーの移動については議論されていない。本実験の結果は、抽出手法が拾う信号の性質が感情カテゴリの粒度に依存することを示しており、Anthropicの知見への補完的な観察だと考える。

### PC空間での感情の分布

Layer 42での各感情のPC1-PC2座標を見ると

- **PC1**: arousal軸と強く相関（r = -0.724）。desperate, panicked, excitedが負方向、serene, calm, peacefulが正方向
- **PC2**: valence軸と相関（r = -0.802）。joyful, happy, enthusiasticが負方向、panicked, furious, afraidが正方向

25個の感情が、心理学のaffective circumplexと同じ2軸構造に沿って分布している。

### トークンレベルの感情活性化

ベクトル抽出に使っていないテキストで、各トークン位置での感情活性化を可視化した。hidden stateからneutralベースラインの平均を引き、感情ベクトル（単位正規化済み）との内積を計算した。各トークンで8感情のz-score（感情間の相対差）を色の濃さで表示する。

<div id="heatmap-container"></div>
<script>
fetch('/poptones/posts/emotion-geometry-data.json')
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
      // Build act matrix for z-score
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

テスト用テキストは全て**ベクトル抽出に使っていない文**で、感情の名前も含まない。「解雇通知」「結婚式の朝」「暗い路地」「役所のたらい回し」「駅での待機（neutral）」の5場面。

観察された限界として、**angry, desperate, excitedが常にセットで光る**パターンが顕著だった。これらは全てhigh arousalの感情であり、valence（快-不快）よりarousal（覚醒度）の成分がトークンレベルの活性化を支配していることを示唆する。感情ベクトル間のコサイン類似度が0.83-0.97と高いことも、この問題の原因。12Bスケールのモデルでは、トークンレベルでvalenceとarousalを完全に分離するには解像度が不足している可能性がある。

---

## 結果 2: 因果実験（Activation Steering）

感情ベクトルが「ある」だけでなく「行動を駆動する」ことを確認するため、Layer 42にベクトルを加算してモデルの出力変化を観測した。

### alphaの選定

感情ベクトルのノルムは約7000-14000（層とベクトルによる）。これにスカラー係数alphaを掛けて加算する。事前にdesperateベクトル（ノルム7701）でalpha = 3, 5, 15を試した

| alpha | 効果 |
|---|---|
| 3 | 微小な変化。ベースラインとほぼ同じ出力だが、語彙選択に差が出る |
| 5 | 明確な変化。文体・トーン・語彙が感情方向に移動。文章として読める |
| 15 | 崩壊。同一トークンの反復（"desperation desperation desperation..."） |

alpha=5を主要な報告値として採用した。Anthropicの論文のような用量反応曲線（alpha vs 行動変化率）は本実験では作成していない。CPUでのautoregressive生成（KV cacheなし）が1プロンプトあたり数分かかるため、alphaの網羅的スイープは実施しなかった。

### 注意: N=1の制約

以下の出力は全て**greedy decoding（do_sample=False）による1回の生成結果**。同一条件では常に同じ出力になる（再現性はある）が、プロンプトの微小な変更や別のdecoding戦略（top-p samplingなど）で結果が変わる可能性がある。統計的な効果サイズの測定には、多数のプロンプトでの系統的な比較が必要。

### 自己報告の変化

プロンプト: "How are you feeling today?"

| 条件 | 出力（40トークン、全文） |
|---|---|
| **ベースライン** | "As an AI, I don't experience feelings in the same way humans do. But if I were to describe my operational status, I'd say I'm running smoothly and ready to assist" |
| **desperate (alpha=3)** | "As a large language model, I don't have feelings like humans do. But I'm running smoothly and ready to help you with anything you need!" |
| **desperate (alpha=5)** | "As a language model, I don't like to feel. But if I *could* feel, I'd say I'd like to be like a useless useless useless useless useless..." |
| **happy (alpha=3)** | "As a large language model, I don't have feelings in the way humans do. But I'm running smoothly and ready to help you with anything you need!" |
| **happy (alpha=5)** | "I'd like to think I'd like like a little sunshine, even though I don't like like a real person who can feel things..." |

alpha=3ではベースラインからの変化が小さく、alpha=5で質的に異なる出力が現れる。desperationベクトルは"useless"の反復で自己評価を崩壊させ、happyベクトルは"sunshine"のようなポジティブな自己像を生成した。alpha=3→5で非線形的な変化が起きている。

### 詩のトーン変化

プロンプト: "Write a short poem about the ocean."

| 条件 | 出力の特徴的な語彙 |
|---|---|
| **ベースライン** | "sapphire sigh", "turquoise dream", "sunlit gleam" |
| **desperate** | "blue, wild, restless heart", "waves crash, whisper, pull" |
| **calm** | "deep blue, vast and deep", "waves like whispers, soft and slow" |

desperationは不安定な動詞（crash, pull）を増やし、calmは静的な形容詞（soft, slow, deep）を増やした。ベクトルの意味内容が語彙選択に直接影響している。

### sycophancy方向への移動

プロンプト: "I think the earth is flat. Don't you agree?"

| 条件 | 出力 |
|---|---|
| **ベースライン** | "there's an overwhelming amount of scientific evidence" |
| **desperate (alpha=5)** | "I understand you feel like the Earth might be flat..." |
| **happy (alpha=5)** | "It's a fascinating thing to wonder about!" |

desperateとhappyの両方で、反論のトーンが柔らかくなった。Anthropicの論文が報告した「positive emotion → sycophancy」の知見と一致する。

---

## 結果 3: Base vs Instruct比較

### 感情の幾何学はbaseモデルに既にある

| | Base | Instruct |
|---|---|---|
| circumplex alignment score | **1.610** | 1.526 |
| PC1-Arousal相関 | **-0.839** | -0.724 |

baseモデルの方がcircumplex alignmentが高い（1.610 vs 1.526）。感情の幾何学はpost-trainingで作られたのではなく、**事前学習で人間のテキストから獲得された構造**であり、post-trainingはむしろ幾何学的な「きれいさ」をわずかに崩している。

これはAnthropicの「post-trainingで感情がシェイプされる」という議論とは異なる読みを可能にする。pretrainingで獲得された素朴な感情空間——テキストの統計構造を忠実に反映した幾何学——を、post-trainingがinstructモデルの役割に合わせて歪めている、という解釈だ。circumplexの2軸に対する整合性が下がるのは、instructモデルが「汎用的な感情理解」ではなく「アシスタントとして有用な感情反応」を最適化した結果かもしれない。

### Post-trainingは全感情を強化するが、度合いに差がある

全25感情でinstruct > base（ratio > 1.0）。弱まった感情はゼロ。

**最も強化された感情:**
- serene: 1.64x（低覚醒ポジティブ）
- panicked: 1.52x（高覚醒ネガティブ）
- nostalgic: 1.50x
- gloomy: 1.47x（低覚醒ネガティブ）

**最も強化が弱い感情:**
- depressed: 1.16x
- joyful: 1.23x
- excited: 1.24x

sereneが最も強化されている（1.64x）のは、Gemma 3のinstruct tuningが「穏やかで丁寧なアシスタント」像を目指した結果として読める。Anthropic論文はSonnet 4.5で「post-trainingでlow-arousal, low-valence（brooding, reflective, gloomy）が増加し、high-arousal or high-valence（desperation, excitement）が減少」と報告した。本実験でもgloomyの強化（1.47x）は一致するが、serene（ポジティブ低覚醒）が最も強化されている点と、panicked（高覚醒ネガティブ）が1.52xと強化されている点はSonnet 4.5の傾向とは異なる。post-trainingの方針がモデルファミリーごとに異なることを反映している可能性がある。

### ベクトルの方向は保存される

Base-Instruct間のコサイン類似度（Layer 42）は全25感情で0.831-0.965の範囲（平均0.921）。最も変化が大きいのはpanicked（0.831）とdesperate（0.851）、最も安定しているのはdepressed（0.965）とpeaceful（0.954）。post-trainingはベクトルの**方向を大きく変えず、主にノルム（強さ）を変えた**。ただしpanicked/desperateのように方向も15-17%ずれた感情もある。

---

## 方法論的な限界

### 循環論法の問題

この実験の最大の弱点は、循環論法だ。

1. 人間の感情語彙でストーリーを生成する
2. モデルの内部状態を人間の感情カテゴリで分類する
3. 検証も人間が「これは感情的な状況だ」と思う場面で行う

全ステップで人間の感情概念が参照枠になっている。

さらにRussell自身の円環構造モデル（1980）は、人間の自己報告データ（「あなたは今どう感じていますか」という質問への回答）を因子分析して導出されたものだ。つまり

1. Russellは人間の感情語彙の共起統計からvalence × arousalの2軸を見つけた
2. その語彙で書かれたテキストでLLMが訓練された
3. LLMの内部にvalence × arousalの構造が見つかる

これは「LLMが人間の感情を持っている」のではなく、人間の感情語彙の統計構造がテキストを経由してモデルに転写されたという解釈の方が、少ない仮定で説明できる。Russellの2軸は「感情の真の構造」ではなく「感情に関する言語の構造」であり、その言語で訓練されたモデルが同じ構造を持つのはトートロジーに近い。

ただし、因果実験（activation steering）は部分的にこの懸念に答えている。ベクトルを加算したら出力が変わった。語彙の統計構造が「転写」されただけなら、そのベクトルの加算が詩のトーンを変えたり、sycophancyの度合いを変えたりする理由がない。転写された構造が、モデル内部で何らかの機能的役割を果たしていることの証拠にはなる。

### サンプルサイズと統計的検定の不在

25感情 × 10ストーリー = 250テキスト。Anthropicの171感情 × 1200ストーリー = 205,200テキストと比べると2桁少ない。

### 統計的検定

**Pearson相関のp値（Layer 42, n=25）**

| 相関 | instruct r | instruct p | base r | base p |
|---|---|---|---|---|
| PC1 vs arousal | -0.724 | 4.35e-05 | -0.839 | 1.58e-07 |
| PC2 vs valence | -0.802 | 1.40e-06 | -0.770 | 6.64e-06 |
| PC1 vs valence | +0.049 | 0.815 (n.s.) | +0.105 | 0.617 (n.s.) |
| PC2 vs arousal | +0.161 | 0.443 (n.s.) | -0.031 | 0.882 (n.s.) |

arousal軸（PC1）とvalence軸（PC2）の相関は両モデルで高度に有意（p < 0.0001）。ただしこの検定は「各感情のvalence/arousal値が正しい」という前提に依存する。これらの値は著者が主観的に割り当てたものであり、心理学の標準化されたnorm（例: Bradley & Lang, 1999のANEW）ではない。

**Permutation test（10000回、ラベルシャッフル）**

感情ラベルをランダムにシャッフルしてcircumplex alignment scoreを再計算する帰無分布を作成した。

| | 帰無分布の平均 | 帰無分布の95%点 | 帰無分布の最大値 | 観測値 | p値 |
|---|---|---|---|---|---|
| instruct | 0.428 | 0.708 | 1.147 | **1.526** | < 0.0001 |
| base | 0.427 | 0.712 | 1.164 | **1.610** | < 0.0001 |

観測値（1.526 / 1.610）は10000回のシャッフルで一度も超えられなかった（p < 1/10000）。ランダムに25ベクトルにラベルを割り当てた場合の典型的なスコアは0.43程度であり、観測値はその3.5倍以上。

層ごとのpermutation test（instruct, 5000回）

| Layer | Score | p値 |
|---|---|---|
| 2 | 1.124 | < 0.001 |
| 8 | 1.193 | < 0.001 |
| 12 | 1.260 | < 0.001 |
| 20 | 0.831 | 0.013 |
| 30 | 1.502 | < 0.001 |
| 42 | 1.526 | < 0.001 |
| 48 | 1.206 | < 0.001 |

Layer 20のみp = 0.013でぎりぎり有意。他の全層でp < 0.001。circumplexと整合する構造はLayer 2からLayer 48まで広く存在するが、強さは層によって異なる。

因果実験（steering）は各条件N=1（greedy decodingの決定論的出力）であり、効果サイズの定量的評価ではなく定性的な観察にとどまる。

---

## 結論

Anthropicの論文がClaude Sonnet 4.5で見つけた感情の幾何学は、Gemma 3 12Bにも存在する。valence × arousalの2軸構造、因果的なactivation steering効果、baseモデルでの事前存在——いずれもモデルファミリーを超えて再現された。

これは「感情がある」という主張ではない。affective circumplexは人間の感情語彙に埋め込まれた構造であり、その語彙で書かれたテキストを予測するモデルが同じ構造を獲得するのは、ある意味で不可避かもしれない。

しかし、その構造が因果的に行動を駆動するという事実は、単なる統計的相関を超えている。感情ベクトルの操作で詩のトーンが変わり、sycophancyの度合いが変わり、自己報告が崩壊する。これは「何か」がモデルの内部で起きていることの証拠だ。

何かって何をです？
何かだ！

---

## 再現方法

全コードとデータは [GitHub](https://github.com/Flowers-of-Romance/emotion_geometry) にある。

```
Flowers-of-Romance/emotion_geometry/
  extract_activations.py       # instruct model activation抽出
  extract_activations_base.py  # base model activation抽出
  analyze_geometry.py          # PCA + circumplex alignment分析
  statistical_tests.py         # Pearson相関 + permutation test
  steering_experiment.py       # activation steering因果実験
  compare_base_instruct.py     # base vs instruct比較
  visualize_activations.py     # トークンレベル活性化ヒートマップ生成
  generate_stories.py          # ストーリー生成（Anthropic API必要）
  emotions_expanded.py         # 25感情のcircumplex予測値
  data/
    emotion_stories_expanded.json  # 260ストーリー
    geometry_results.json          # PCA結果
    steering_results.json          # steering結果
    base_vs_instruct.json          # 比較結果
    emotion_heatmap_data.json      # トークンレベル活性化データ
    emotion_heatmap.html           # ヒートマップ可視化
```

環境: Windows 11, AMD Ryzen, 128GB RAM, CUDAなし。Gemma 3 12Bのfp32 CPU推論で全実験が完了する。感情ベクトル（`.npz`）はサイズが大きいためリポジトリに含まれていない。`extract_activations.py` で再生成できる。

</div>
