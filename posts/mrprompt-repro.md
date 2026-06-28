---
layout: post.vto
title: MRPromptを検証する (Qwen3-8B)
---

<div class="post-content">

# MRPromptを検証する (Qwen3-8B)

<div class="post-meta">
  <span>投稿日：2026年06月29日(月)00時13分59秒</span>
  <span class="tag">LLM</span>
  <span class="tag">Role-Playing</span>
  <span class="tag">Mechanistic Interpretability</span>
  <span class="tag">Reproduction</span>
  <span class="tag">Qwen</span>
</div>
<p class="post-note">この記事は人工無能を使って執筆されています。<span class="lang-switch"><a href="/poptones/posts/en/mrprompt-repro/">English</a></span></p>

## 要旨

ロールプレイ手法 MRPrompt（論文「Memory-Driven Role-Playing」, arXiv:2603.19313, 2026）を、論文と同じ条件で Qwen3-8B 上に再現し、その中心的主張を検証した。結果は三層に分かれる。(1) 性能の主張（構造化ペルソナはカード設定より良い）は再現され有意。(2) しかしその仕組みとされる「cue-addressable（手がかりキーで該当記憶を引く）」は支持されない。キーを消しても壊しても性能は落ちない。(3) 性能差を生んでいるのは構造化メモリ機構（cue-addressable）ではなかった。モデルは手がかりキーではなく facet の内容を読んでおり（キーを消去・破壊しても不変、内容を反転させると低下）、カード設定に対する性能差は大半が CoT 生成で説明できた（素のカードに CoT 生成を加えるだけで差の大半が埋まり、構造がそれを超えて寄与する有意な証拠は得られなかった）。内部状態を見ると、facetの中身の処理は第16–22層に局在し、活性化steeringと同じ軸に作用していた。

<div class="alert">
<strong>位置づけ</strong>　1モデル（Qwen3-8B）での再現実験である。論文を否定するためでなく、「主張どおりの性能向上が出るか」「それは論文の言う仕組みで出ているのか」を同じ手順で確かめる検証として行った。論文の本文プロンプト（Appendix N/O）は非公開のため、構築・採点プロンプトは<strong>論文の手順に忠実な再構成</strong>であり一字一句同一ではない。判定は小サンプル（行動 N=100、機構プローブ n=29）に基づく予備的なものである。コード・データ・全訳は公開（末尾）。
</div>

---

## 1. MRPromptとは何か

### 1.1 ロールプレイを「記憶」として捉える枠組み

論文の根本アイデアは、ロールプレイを記憶のプロセスとして定式化することにある。スタニスラフスキーの「感情の記憶」（役者は役の記憶を呼び起こして演じる）を下敷きに、次のように整理する。

- LTM（長期記憶） ＝ そのキャラクターの人格設定。
- STM（短期記憶） ＝ 直近の会話のやりとり。
- 良いロールプレイ ＝ 会話の手がかりをきっかけに、長期記憶から「いま必要な部分」だけを想起(recall)して応答すること。

人格を一様に貼り付けるのではなく、場面に応じて該当する記憶を引き出すのが上手な演技だ、という主張である。

### 1.2 仕組み：2つの部品

MRPromptはこの見立てを2部品で実装する。

① Narrative Schema（物語スキーマ） — 人格を構造化して書くフォーマット。フラットな性質リストではなく、`core_traits`（核の性格）と `scene_facets`（場面ごとの振る舞い）に分ける。各 facet は cue-addressable「手がかり語（cue keys）」が、その場面での振る舞い（enactment signals）や境界（boundary anchors）に結びつく、とされる。実物の facet を1つ示す（佟湘玉／武林外伝の女将。本実験で GPT-4.1 が構築したスキーマで、論文由来ではない。中国語データを日本語訳）。

| フィールド | 内容（日本語訳） |
|---|---|
| title | 抜け目ない女将の値段交渉 |
| situation | 客の会計、仕入れ、あるいは揉め事があるとき |
| cue_phrases（手がかり） | 「まだお金払ってないでしょ」「良い品が安い」「もっと安くならない？」 |
| social_role | 商人／権威者 |
| emotional_state | 警戒、得意、時に苛立ち |
| behavior_pattern | 小さな利益も逃さず、理を盾に主張し、巧みに売り込む |
| thinking_pattern | 利益優先、綿密に計算する |

② Magic-If Protocol — スタニスラフスキーの「もし～だったら」に由来する手順。応答の前にモデルに段階的な推論（手がかり抽出→facet選択→姿勢の導出→生成）をさせる、構造化された chain-of-thought（CoT）の一種である。以下は本実験で用いた再構成プロンプト（中国語＋日本語訳）。論文本文のプロンプト（Appendix N/O）は非公開のため、これは逐語ではなく、論文が記述する手順に忠実な再構成である。

```
【行动准则·Magic-If】你就是{name}本人。请在心中按以下步骤推理后，只输出角色的一句回应：
1) 从对话(STM)中提取线索；2) 选择最相关的情境facet；
3) 由该facet推导社会姿态/情绪/行为/思维；4) 以角色口吻生成回应。

【行動指針・Magic-If】あなたは{name}本人である。以下の手順で推論したのち、
キャラクターの一言だけを出力せよ：
1) 会話(STM)から手がかりを抽出 ; 2) 最も関連する場面facetを選択 ;
3) そのfacetから社会的姿勢/情緒/行動/思考を導出 ; 4) キャラの口調で応答を生成。
```

### 1.3 構造スロット ＝ 記憶の4能力

論文は、構造の各スロットを記憶の各能力に割り当てる。ロールプレイ能力を4つ（MA/MS/MB/ME）に分解する。

| 構造スロット | 担う能力 | データ操作でいうと |
|---|---|---|
| `core_traits` | MA：常時アンカー | 人格の基底を常にロード |
| `cue_phrases` / `situation` | MS：選択 | 手がかりと照合して該当 facet を引く（クエリ） |
| `boundary_anchors` | MB：境界 | 範囲外をフィルタ |
| `social_role` ほか演技signals | ME：演出 | 引いた記憶を自然な発話にレンダリング |

### 1.4 論文の主張（3点）

| # | 主張 |
|---|---|
| ① 性能 | 構造化ペルソナはカード設定より良い。特に小型モデルで有効（Qwen3-8B が大型モデルに匹敵） |
| ② 仕組み | 効果が出るのは cue-addressable な選択的活性化のおかげ（手がかりキーで該当 facet を立ち上げ、style averaging を防ぐ） |
| ③ 性質 | 純粋にプロンプトベース。パラメータ更新も外部検索もツールも使わない（"no external retrieval or tool use"） |

### 1.5 論文はどう実験しているか（と本再現の異同）

論文自身の実験設定も押さえておく（本再現はこれに倣っている）。

- スキーマ構築：GPT-4.1 が素体プロファイルと facet 構造版をドラフトし、人手で検証・修正する（human-in-the-loop）。
- 評価：ベンチマーク MRBench のインスタンスを生成させ、GPT-4.1-mini の判定器が前述の4能力（MA/MS/MB/ME）を採点する（MREval）。内部状態は一切見ない。測るのは出力スコアだけのブラックボックス評価である。
- 対象モデル：Qwen3-8B ほか。MRPrompt 付き Qwen3-8B が大型モデルに匹敵する、という性能比較が論文の中心的な主張。

本再現との異同：構築は GPT-4.1、採点は GPT-4.1-mini と論文に合わせた。ただし (a) 人手検証は省略（自動構築のまま）、(b) 非公開のプロンプトは再構成、(c) `nokey`/`wrongkey`/`anti`/`card_think` など論文に無いアブレーションを追加した。cue キーの寄与と、構造 vs CoT を切り分けるためである。

---

## 2. 検証の問い

主張②には検討すべき点がある。Transformer は入力を一列のトークンとして受け取る。`{"cue_phrases":[...]}` と書いても、モデルにとって波括弧もキー名もただのトークンで、木構造も索引もない。しかも主張③が認めるとおり検索器は実装されていない。とすれば「cue-addressable」は実体のある機構なのか、比喩なのか。これは測れる問いである。

二つの問いを立てた。

- 問A：手がかりキーは機能しているか。 キーを消す/壊して該当 facet を引けなくなり性能が落ちるなら機能している。落ちなければ機能していない。
- 問B：性能向上は構造か、それとも CoT（応答前に推論の形のトークンを生成させること）か。 MRPrompt は Magic-If でこの CoT を誘導する。その効果を、構造の効果と切り分けられるか。

---

## 3. 方法（具体的に何をやったか）

### 3.1 データ構築  なぜ中国語なのか

論文は STM の素体に CharacterEval（中国語のロールプレイ評価ベンチマーク）由来のデータを使う。忠実な再現のため本実験もこれを用いた。結果として、人格スキーマ・対話文脈・Magic-If・採点ルーブリック・モデル生成出力がすべて中国語になっている（本記事の例はすべて日本語訳を併記。一方、後述の機構プローブだけは自作の英語キャラを使う）。

パイプライン：CharacterEval → GPT-4.1（`gpt-4.1-2025-04-14`）で各キャラの Narrative Schema を生成（77体）→ `assemble.py` で 100インスタンスを構成。各インスタンス＝〈LTM（スキーマ）＋STM（対話）＋今ターンの「正解 facet」＋その反転 facet〉。

### 3.2 条件（アブレーション）

主張②を直接検証するため、構成要素を削除・改変した条件を比較する。

| 条件 | プロンプトとして何が違うか | 思考 |
|---|---|---|
| `base` | 人格を散文で記述 | OFF |
| `card` | JSON のプロフィールカード（facet 無し、Magic-If 無し） | OFF |
| `mrprompt` | 全 facet＋Magic-If（フル） | ON |
| `mrprompt_noscene` | 場面 facet を抜く | ON |
| `mrprompt_nokey` | 手がかりキー（cue_phrases/situation）を削除 | ON |
| `mrprompt_wrongkey` | キーを別場面のものに入れ替え（中身は正しい） | ON |
| `mrprompt_anti` | facet の中身を正反対に入れ替え | ON |
| `card_think` | カード設定＋思考ON（問B用の対照） | ON |

表の「思考」列は、使用モデル Qwen3 の機能に関わる。Qwen3 にはネイティブの thinking モードがあり、ONにすると応答の前に `<think>…</think>` という推論ブロック（chain-of-thought＝CoT）を自分で書いてから答え、OFFだと即座に答える。本稿で「思考ON/OFF」と言うのはこの切替のこと。したがって問B（構造 vs CoT）は、この CoT ブロックを出させるか否かで効果を比べることになる。なお CoT は生成されたテキストであって、モデルの実際の内部計算を忠実に表すとは限らない点に注意。

### 3.3 生成・採点・統計

- 生成：Qwen3-8B（bf16, ROCm）。base/card は思考OFF・128トークン、mrprompt 系は思考ON・1024トークン（Magic-If がこの `<think>` 内の CoT 生成を誘導）、`</think>` 後の一文を抽出。temperature 0.7 / top_p 0.8。
- 採点：GPT-4.1-mini（`gpt-4.1-mini-2025-04-14`）。FA（正解 facet への契合度, 1–10）。正解 facet（社会的姿勢/情緒/行動/思考）・STM・応答を与え、どれだけ即しているかを採点（MREval Table 1 の再構成）。空応答は missing 扱いで非ペナルティ。
- 統計：ブートストラップ信頼区間（1万回）、ペア対比。

具体例（佟湘玉。STM＝「道場を開く」という話題、正解 facet＝抜け目ない女将の値段交渉）。各条件の生成を日本語訳で示す。キーを消した nokey も壊した wrongkey も、女将の銭勘定口調が崩れていない点に注目（＝問Aの結果が実例で見える）。

| 条件 | 生成（日本語訳） |
|---|---|
| base | それじゃうちの宿屋も大賑わいだ。人が多いのは構わないが、金を払わないのだけは困るね！ |
| card | 武術を教えるよりよっぽど面白そうだ。あんたの道場が弟子を何人とれるか見せてもらおう！ |
| mrprompt | （目を細めて笑う）道場かい？月謝を払える甲斐性があるかだね。うちの料理は江湖の大物だって褒めるんだから！ |
| nokey（キー削除） | ほう、その構えは目新しい。だが誰でも受け入れるんじゃ虫が寄る——（声を潜め）うちは黒社会の番頭は雇わないよ… |
| wrongkey（キー破壊） | 客をみんな達人に育てちまったら、うちの宿屋に誰も来なくなっちまうよ！ |
| anti（中身反転） | まずはうちの商売が繁盛してるか見てからだね。客もいなくて飯も食えなくなっちゃ困るよ |

### 3.4 機構プローブ（別実験）

行動採点は採点者(LLM)の気分にも左右される。そこで内部も直接見た。論文が一切触れない領域（論文は D.2 で「LTM をブラックボックスな条件付け源として扱う」と明言）である。自作の英語キャラ29体で、各キャラに〈正解 facet の振る舞い〉と〈その反転〉、〈一致キー〉と〈別場面の誤キー〉を用意し、次を測った。

- 強制選択の対数確率：`logP(正解応答 | 文脈, 人格) − logP(反対応答 | …)`。人格が応答選好をどれだけ動かすか。flat / nokey / wrongkey / key を対比。
- 層ごとの注意・残差スイープ：生成位置から facet 本体／手がかりキーへの注意、人格の違いが残差に立ち上がる層。
- per-character bridge：各キャラの気質を言い換え文（facet 本文は使わない＝循環回避）から作った steering ベクトル（活性化に直接足す向き）と、その facet 残差差分とのコサイン。プロンプト（言葉）による介入と、活性化への介入が同じ軸かを測る。

---

## 4. 結果

### 4.1 主張①（性能）— ⭕ 再現、ただし主因は CoT

N=100、全条件の平均 FA

| 条件 | 平均FA | 95%CI |
|---|---|---|
| base | 6.26 | [5.86, 6.63] |
| card | 6.11 | [5.72, 6.49] |
| mrprompt | 6.78 | [6.36, 7.17] |
| mrprompt_noscene | 6.53 | [6.10, 6.94] |
| mrprompt_nokey | 6.88 | [6.45, 7.29] |
| mrprompt_wrongkey | 6.68 | [6.24, 7.12] |
| mrprompt_anti | 5.78 | [5.29, 6.26] |
| card_think | 6.50 | — |

`mrprompt − card` = +0.67 [+0.20, +1.12]（有意）。性能の主張は再現された。だがこの +0.67 を構造と CoT に分解すると（問B）、様相が変わる。

| 対比 | 値 [95%CI] | 解釈 |
|---|---|---|
| card_think − card | +0.41 [−0.04, +0.85] | カードに CoT 生成を加えた効果（差の大半を埋める。ほぼ有意） |
| card_think − mrprompt | −0.31 [−0.76, +0.13] | 構造が CoT を超えて足す分（有意でない） |

この +0.67 は、おおよそ CoT分 +0.41 ＋ 構造分 +0.31 に分解でき、構造分は n≈100 で統計的に 0 と区別できない（card_think は Magic-If 抜きの素の CoT 生成なので、+0.41 は「CoT を出させること自体」の効果。Magic-If 固有の寄与は残りの非有意な +0.31 に含まれる）。すなわち性能向上の主因は CoT 生成（応答前に推論トークンを出させること＝test-time の計算）であって、構造化メモリ機構が CoT を超えて寄与する有意な証拠は得られなかった。

### 4.2 主張② 仕組み（cue-addressable）— ✗ 支持されない

手がかりキーの効果（行動）

| 対比 | 値 [95%CI] | 解釈 |
|---|---|---|
| full − nokey | −0.07 | キーを消しても下がらない |
| full − wrongkey | +0.15 | キーを壊しても下がらない |

機構プローブ（n=29）でも同じ

| 対比 | 値 [95%CI] | 解釈 |
|---|---|---|
| key − wrongkey | −0.84 [−2.98, +1.43] | 一致キーと誤キーで差なし |
| key − nokey | −3.98 [−6.74, −1.25] | キーを足すとむしろ低下 |

行動でも内部でも、一致したキーとでたらめなキーが区別されていない。注意の集中を見ても手がかりキーにはほとんど注意が向かない。cue-addressable は、行動・機構いずれのレベルでも支持されなかった。

### 4.3 何が寄与しているのか — 中身、そして第16–22層

`anti`（中身を反転）条件が答えを与える。

| 対比 | 値 [95%CI] | 解釈 |
|---|---|---|
| full − anti | +1.06 [+0.58, +1.56] | 中身を反転させると有意に低下 |

モデルはキー経由ではなく facet の中身そのものを読んで演じている。そして内部では、その処理が層に局在していた（ブートストラップCIつき）。

| 指標 | 16–22層の集中度 [95%CI] |
|---|---|
| facet本体への注意 | 1.52× [1.45, 1.58]（ピークL18） |
| 人格差の残差立ち上がり | 1.26× [1.23, 1.30]（L21でプラトー） |

<div style="margin:20px 0"><canvas id="chart-attn" width="720" height="380"></canvas></div>

図1：層ごとの「注意の向き先」。横軸＝層(0–35)、縦軸＝注意量。棒＝facet 本体（中身）への注意、白線＝手がかりキーへの注意。本体は 16–22 帯（淡黄）に集中し L18 でピーク、キーは終始低く平坦。モデルは中身を読むが、キーは引いていない。

さらに per-character bridge では、各キャラの facet swap と、そのキャラ自身の気質 steering ベクトルが、16–22層で有意に同じ方向を向いた（コサイン +0.050 [+0.020, +0.079]）。汎用の感情軸では null だったが、キャラごとに測ると正。「言葉による介入」も「活性化への介入」も、同じ場所・同じ軸だった。この帯は <a href="/poptones/posts/activation-steering/">Activation Steering の記事</a> で人格・感情を操作するベクトルが作用した層帯と一致する。

<div style="margin:20px 0"><canvas id="chart-bridge" width="720" height="380"></canvas></div>

図2：プロンプト（言葉）による介入と、活性化への直接介入（隠れ状態に steering ベクトルを足す手法）は同じ軸か。各キャラの facet 反転がプロンプト側で残差を動かす向きと、そのキャラの気質から言い換えで作った steering ベクトルの向きのコサインを層別に。16–22 帯（淡黄）で正、L27 でピーク。両者は同じ層・同じ向きを向いている。

---

## 5. まとめ（主張ごとの判定）

| 主張 | 判定 | 根拠 |
|---|---|---|
| ① 構造化 ＞ カード（特に小型） | ⭕ 再現・有意 | mrprompt − card = +0.67* |
| ① のうち「構造の寄与」 | △ 不確定 | card に CoT 生成を加えると差の大半が消失。構造分 +0.31 は非有意 |
| ② cue-addressable な選択的活性化 | ✗ 支持されず | nokey/wrongkey で不変、key−wrongkey も null |
| 実際に寄与しているもの | — | facet の内容（契合）と CoT（カードに対する差）。第16–22層に局在し、活性化steeringと同軸 |

測られた範囲では、MRPrompt の性能向上は実在するが、その源は論文が語る「cue-addressable な想起」ではない。カードに対する性能差は大半が CoT 生成に、正しい facet への契合は内容に帰属し、手がかりキーは distinguishing work をしていない。論文は出力（judge スコア）のみを測りながら機構（retrieval/recall）を語っており、その機構主張は機構レベルでは支持されなかった、というのが本検証の結論である。

構造はテキスト自体には保持されない。コンテキストに入った瞬間、フラットなトークン列になる。それでも構造化した書き方がいくらか有効だとすれば、それを支えているのはプロンプト側ではなく、事前学習で「構造化テキストの読み方」を内面化したモデル側である。

---

## 6. 限界

- プロンプト本文（Appendix N/O）は非公開。構築・採点プロンプトは再構成で、一字一句同一ではない。公式の 200 インスタンス MRBench は未公開の匿名リポジトリ内。
- n が小さい（行動 N=100、機構プローブ n=29、bridge n=17）。CI は広く、`card_think−card` と `card_think−mrprompt` はいずれも個別には非有意——CoT/構造の分解は示唆であって確定ではない。
- `card_think` はネイティブ thinking モード（汎用の CoT 生成）であって Magic-If 文そのものではない。残る +0.31 の一部はプロトコル文の質かもしれない（ただし cue-addressability は救えない）。
- 単一モデル（Qwen3-8B）・単一シード系列。条件ごとの有効 n は 94–100（思考が空/打ち切りの応答は missing）。

---

## 7. コード・データ

すべて公開している。

- GitHub: [Flowers-of-Romance/mrprompt-repro](https://github.com/Flowers-of-Romance/mrprompt-repro)
- 中国語データの日本語全訳（見たい人向け）: [translations/ja](https://github.com/Flowers-of-Romance/mrprompt-repro/tree/main/translations/ja)（人格スキーマ77体・対話文脈100・生成686件）

関連：<a href="/poptones/posts/raskolnikov/">ラスコーリニコフの記事</a>（人格 facet を手で設計した例）、<a href="/poptones/posts/activation-steering/">Activation Steering</a>（同じ16–22層帯）。

## 参考文献

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
