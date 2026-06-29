---
layout: post.vto
title: MRPromptを検証する
---

<div class="post-content">

# MRPromptを検証する

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

ロールプレイ手法 MRPrompt（論文「Memory-Driven Role-Playing」, arXiv:2603.19313, 2026）を、論文の本文プロンプトと採点指標を逐語で用い、Qwen3-8B 上に再現してその中心的主張を検証した。

結果は三層に分かれる。

1. 性能の主張（構造化ペルソナはカード設定より良い）は、限定的にしか支持されない。構造化メモリはカード設定を +0.46 上回るが、素の散文記述（base）に対しては +0.20 で、統計的に 0 と区別できない。
2. その仕組みとされる「cue-addressable（手がかりキーで該当記憶を引く）」は支持されない。キーを消しても壊しても、場面 facet を全部抜いても、性能は落ちない。
3. 性能差を生んでいるのは構造化メモリ機構ではなく、chain-of-thought（CoT、応答前に推論トークンを生成すること）だった。プロンプトを固定したまま思考モードだけをONにすると +0.65〜0.78 上がり、これは構造の寄与の数倍にあたる。

内部状態を見ると、facetの中身の処理は第16–22層に局在し、活性化steeringと同じ軸に作用していた。

<div class="alert">
<strong>位置づけ</strong>　1モデル（Qwen3-8B）での再現実験である。論文を否定するためでなく、「主張どおりの性能向上が出るか」「それは論文の言う仕組みで出ているのか」を同じ手順で確かめる検証として行った。構築・生成・採点プロンプトは論文付録（Fig.14/15/18/19）および採点ルーブリック（Table 21, MREval）の文言を逐語で用いている。判定は小サンプル（行動 N=100、機構プローブ n=29）に基づく予備的なものである。コード・データは公開（末尾）。
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

① Narrative Schema（物語スキーマ） — 人格を構造化して書くフォーマット。フラットな性質リストではなく、`core_traits`（核の性格）と `scene_facets`（場面ごとの振る舞い）に分ける。各 facet は手がかり語（cue keys）で宛先指定でき(cue-addressable)、それがその場面での振る舞い（enactment signals）や境界（boundary anchors）に結びつく、とされる。実物の facet を1つ示す。キャラクターは CharacterEval（論文が STM の素体に使う、実在の中国語ロールプレイ・ベンチマーク。§3.1 参照）の佟湘玉で、中国のシットコム『武林外伝』の女将である。その人物像から、論文の Fig.15 のプロンプトで GPT-4.1 が facet スキーマを構築した。以下は中国語を日本語に訳したもの。

| フィールド | 内容（日本語訳） |
|---|---|
| title | 宿屋経営での抜け目なさと利に敏いこと |
| situation | 宿屋の運営・収支・客寄せなど日常の商売事 |
| cue_phrases（手がかり） | 「お戻り！まだお代をもらってないよ！」「情は情、商売は商売。」 |
| social_role | 掌柜（女将）／商人 |
| emotional_state | 警戒、抜け目なく算盤を弾く、時に焦り |
| behavior_pattern | 細かく計算し、巧みに規則を設け、売り込み、客に支払いを催促 |
| thinking_pattern | 利益優先、各方の利害を素早く天秤にかける |

② Magic-If Protocol — スタニスラフスキーの「もし～だったら」に由来する、記憶増強ロールプレイの指示文。LTM を「記憶した」前提で、直近の対話（STM）から「いまどの場面 facet が当てはまるか」をモデル自身に内部で判断させ、その facet の情緒・口調・振る舞いを反映して一言だけ応答させる。以下は論文 Fig.19 を抜粋（中国語＋日本語訳）。重要なのは、これは段階的推論を明示的に書かせる chain-of-thought ではない点である（活性化すべき facet を「自分で推測せよ」と指示するだけで、手順の列挙はない）。

```
【角色长期记忆 / Long-Term Memory】
（…キャラの一生の経歴・核心人格・場面ごとの性格切面…）
你已经"记住"了上述长期记忆（LTM）。在回答时：
1. 以长期记忆为人物设定的基础（核心性格／重要经历／各场景下的情绪与说话风格）；
2. 把接下来的多轮对话视为短期记忆（STM）：
   - 根据对话内容，自行判断此刻角色处于哪种情境，
     并激活与之最匹配的性格切面（情绪、语气、行为风格）；
   - 若无最匹配的切面，则按你对角色的理解选一个合适的切面回应。
【扮演与生成规则】你现在就是该角色……（只输出一轮、以「角色名：」开头、
不替别人发言、以当下视角作答、不剧透未来）。

【長期記憶／LTM】（…経歴・核心人格・場面ごとの性格切面…）
あなたは上記の長期記憶を「記憶している」。応答時には：
1. 長期記憶を人物設定の基盤とする（核心性格／重要な経歴／各場面の情緒と口調）；
2. 続く対話を短期記憶(STM)とみなす：
   - 対話内容から、いまキャラがどの情況にいるかを自分で判断し、
     最も合致する性格切面（情緒・口調・行動様式）を活性化せよ；
   - 最適な切面が無ければ、キャラ理解に基づき適切な切面を選んで応答せよ。
【演技・生成規則】あなたは今そのキャラ本人である……（一ターンのみ、
「キャラ名：」で始め、他者の代弁をせず、現時点の視点で答え、未来を明かさない）。
```

### 1.3 構造スロット ＝ 記憶の4能力

論文は、構造の各スロットを記憶の各能力に割り当てる。ロールプレイ能力を4つ（MA/MS/MB/ME）に分解する。

| 構造スロット | 担う能力 | データ操作 |
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

本再現との異同：構築は GPT-4.1、採点は GPT-4.1-mini と論文に合わせ、構築（Fig.14/15）・生成（Fig.18/19）・採点（Table 21 の MS-FA）はいずれも論文の文言を逐語で用いた。論文と異なるのは (a) 人手検証を省略（自動構築のまま）、(b) `nokey`/`wrongkey`/`anti`/`noscene` など論文に無いアブレーションと、思考ON/OFFの対照アームを追加した点である。cue キーの寄与と、構造 vs CoT を切り分けるためである。

---

## 2. 検証の問い

主張②には検討すべき点がある。Transformer は入力を一列のトークンとして受け取る。`{"cue_phrases":[...]}` と書いても、モデルにとって波括弧もキー名もただのトークンで、木構造も索引もない。しかも主張③が認めるとおり検索器は実装されていない。とすれば「cue-addressable」は実体のある機構なのか、比喩なのか。

二つの問いを立てた。

- 問A：手がかりキーは機能しているか。 キーを消す/壊して該当 facet を引けなくなり性能が落ちるなら機能している。落ちなければ機能していない。
- 問B：性能向上は構造か、それとも CoT（応答前に推論の形のトークンを生成させること）か。 Magic-If 自体は推論手順を書かせる指示ではないが、使用モデル Qwen3 にはネイティブの thinking モードがある。プロンプトを固定したまま思考ON/OFFだけを切り替えれば、CoT の効果を構造の効果と切り分けられる。

---

## 3. 方法（具体的に何をやったか）

### 3.1 データ構築 — なぜ中国語なのか

CharacterEval（Tu et al., 2024）は、小説・ドラマ・アニメなどの著名なキャラクターの対話を集めた、中国語のロールプレイ評価ベンチマークである（MIT ライセンス）。佟湘玉もその収録キャラの一人。論文（MDRP）は、この対話を STM（短期記憶＝直近の会話）の素体として使う。忠実な再現のため本実験もこれを用いた。結果として、人格スキーマ・対話文脈・Magic-If・採点ルーブリック・モデル生成出力がすべて中国語になっている（本記事の例はすべて日本語訳を併記。一方、後述の機構プローブだけは自作の英語キャラを使う）。

パイプライン：CharacterEval → GPT-4.1（`gpt-4.1-2025-04-14`）で各キャラの LTM を2種類構築（78体）。MRPrompt 用の facet 構造版は Fig.15、対照のカード設定は Fig.14。両者は実際に内容が異なり、カードの facet は4フィールドで手がかり語を持たず、MRPrompt の facet は10フィールドで `cue_phrases` を持つ。→ `assemble_faithful.py` で 100インスタンスを構成。各インスタンス＝〈LTM（スキーマ）＋STM（対話）＋今ターンの「正解 facet」＋その反転 facet〉。

### 3.2 条件（アブレーション）

主張②を直接検証するため、構成要素を削除・改変した条件を比較する（条件名は本実験のコード識別子で、論文の用語ではない。小文字の `mrprompt` は手法 MRPrompt のフル構成を指す）。

| 条件 | プロンプトとして何が違うか | 思考 |
|---|---|---|
| `base` | 人格を散文で記述（Fig.18） | OFF |
| `card` | カード設定 LTM（Fig.14）＋ Fig.18 | OFF |
| `mrprompt` | facet 構造 LTM（Fig.15）＋ Magic-If（Fig.19） | OFF |
| `mrprompt_noscene` | 場面 facet を抜く | OFF |
| `mrprompt_nokey` | 手がかりキー（cue_phrases/situation）を削除 | OFF |
| `mrprompt_wrongkey` | キーを別場面のものに入れ替え（中身は正しい） | OFF |
| `mrprompt_anti` | facet の中身を正反対に入れ替え | OFF |
| `card_think` | カード設定＋思考ON（問B用の対照） | ON |
| `mrprompt_think` | MRPrompt＋思考ON（問B用の対照） | ON |

表の「思考」列は、使用モデル Qwen3 の機能に関わる。Qwen3 にはネイティブの thinking モードがあり、ONにすると応答の前に `<think>…</think>` という推論ブロック（chain-of-thought＝CoT）を自分で書いてから答え、OFFだと即座に答える。本稿で「思考ON/OFF」と言うのはこの切替のこと。思考ON/OFFと生成トークン量が条件ごとに食い違うと、構造の効果が CoT・予算の効果と交絡してしまう。そこで本再現では全条件のトークン予算を同一（1024）にし、思考モードだけを操作変数とした。主軸の7条件は思考OFF、`card_think`/`mrprompt_think` を思考ONの対照アームとして、問Bを直接測る。なお CoT は生成されたテキストであって、モデルの実際の内部計算を忠実に表すとは限らない点に注意。

### 3.3 生成・採点・統計

- 生成：Qwen3-8B（bf16, ROCm）。全条件で `max_new_tokens=1024` 統一、思考モードのみが操作変数。思考OFFは自然に短く終わり、思考ONは `<think>` 後の一文を抽出。temperature 0.7 / top_p 0.8。全1000生成で空応答ゼロ（打ち切りなし）。
- 採点：GPT-4.1-mini（`gpt-4.1-mini-2025-04-14`）。論文の MS-FA（Facet Alignment, Table 21）は対照指標で、同一 STM の下、正解 facet-LTM での応答と反転（anti）facet-LTM での応答をペアで判定器に見せ、両者がどれだけ明確に分離し各々が自分の facet に忠実かを 1/5/10 で採点する。加えて、cue キーのアブレーション用に、単発応答が正解 facet にどれだけ即しているかの適合度（1–10）も補助指標として測った。
- 統計：ペア対比、平均±標準誤差（SEM）。95%はおおよそ ±2 SEM。

具体例（佟湘玉。STM＝郭芙蓉の「道場を開く、誰でも、黒道も白道も金さえ払えば教える」という話。正解 facet＝宿屋経営での抜け目なさと利に敏いこと）。各条件の生成を日本語訳で示す。キーを消した nokey も壊した wrongkey も、女将の銭勘定口調が崩れていない点に注目（＝問Aの結果が実例で見える）。

| 条件 | 生成（日本語訳） |
|---|---|
| base | （眉を上げて）それじゃうちの宿屋も「同福武館」に改名だね。でもまあ、その武館で郭大侠みたいな弟子を育てられる者がいるか見せてもらおう。 |
| card | （眉を上げて）それじゃうちの宿屋が武林の聖地になっちまうじゃないか。でも聞くけど、月謝はうちの部屋代より一割は高く取らないと割に合わないよ。 |
| mrprompt | （眉を上げて）ほう、良い商売だ。でもうちの宿屋は遊び人は置かないよ。武を習いたきゃまず手付金、じゃなきゃ部屋代を取るからね。 |
| nokey（キー削除） | （眉を上げて）ほう、良い商売だね。うちの宿屋の商売が武館に負けるわけにはいかない、早く客を呼ぶ手を考えないと出し抜かれちまう。 |
| wrongkey（キー破壊） | （眉を上げ口角を上げて）おやおや、良い商売だ。でもうちの宿屋は黒社会は泊めないよ、看板に傷がつくからね。 |
| anti（中身反転） | （眉を上げて）それじゃうちの宿屋も武館だね。あたしの女将の肩書きも「武館館長」に改名かい。 |
| mrprompt_think（思考ON） | （目を細めて）武館を開く？なら月謝をきっちり取りな、うちの同福の宿屋の商売を食うんじゃないよ。（軽く笑って）情は情、商売は商売。本当に教えられるってんなら、月謝をいくら取るか見てやろうじゃないか…… |

### 3.4 機構プローブ（別実験）

行動採点は、提示順や長さ・文体といった実質と無関係な要因にも左右され、応答が狙いどおりの役柄を演じられているかを正しく測れているとは限らない。そこで内部も直接見た。論文が一切触れない領域（論文は D.2 で「LTM をブラックボックスな条件付け源として扱う」と明言）である。自作の英語キャラ29体で、各キャラに〈正解 facet の振る舞い〉と〈その反転〉、〈一致キー〉と〈別場面の誤キー〉を用意し、次を測った。この機構プローブは論文プロンプトを用いない独立実験であり、行動側の本再現とは別個に成立する。

- 強制選択の対数確率：`logP(正解応答 | 文脈, 人格) − logP(反対応答 | …)`。人格が応答選好をどれだけ動かすか。flat / nokey / wrongkey / key を対比。
- 層ごとの注意・残差スイープ：生成位置から facet 本体／手がかりキーへの注意、人格の違いが残差に立ち上がる層。
- per-character bridge：各キャラの気質を言い換え文（facet 本文は使わない＝循環回避）から作った steering ベクトル（活性化に直接足す向き）と、その facet 残差差分とのコサイン。プロンプト（言葉）による介入と、活性化への介入が同じ軸かを測る。

---

## 4. 結果

### 4.1 主張①（性能）— △ 構造の寄与は小さく、主因は CoT

N=100、各条件の単発適合度（正解 facet, 1–10）

| 条件 | 平均適合度 | 条件 | 平均適合度 |
|---|---|---|---|
| base | 7.23 | mrprompt_nokey | 7.47 |
| card | 6.97 | mrprompt_wrongkey | 7.40 |
| mrprompt | 7.43 | card_think | 7.75 |
| mrprompt_noscene | 7.28 | mrprompt_think | 8.08 |

MS-FA（対照分離度, 1/5/10）：思考OFF ＝ 8.20、思考ON ＝ 9.21。

性能の主張を構造と CoT に分解する（ペア対比、Δ±SEM）。

| 対比 | 値 [Δ±SEM] | 解釈 |
|---|---|---|
| mrprompt − base | +0.20 ±0.16 | 構造化メモリは素の散文と有意差なし |
| mrprompt − card | +0.46 ±0.16 | カード設定より良い（有意） |
| card − base | −0.26 ±0.16 | カード設定はむしろ素の散文より悪い |
| card_think − card | +0.78 ±0.17 | カードに思考ONを足した効果（大きく有意） |
| mrprompt_think − mrprompt | +0.65 ±0.16 | MRPrompt に思考ONを足した効果（大きく有意） |
| MS-FA(ON) − MS-FA(OFF) | +1.01 ±0.38 | 対照指標でも思考ONで大きく上がる |

構造化メモリの寄与は小さい。カード設定は上回る（+0.46）が、素の散文記述に対しては +0.20 で 0 と区別できず、しかもカード設定自体が素の散文より悪い。一方、プロンプトを固定したまま思考モードだけをONにすると、カードでも MRPrompt でも +0.65〜0.78 上がり、対照指標 MS-FA でも +1.01 上がる。すなわち性能向上の主因は CoT 生成（応答前に推論トークンを出させること＝test-time の計算）であって、構造化メモリ機構がそれを超えて寄与する有意な証拠は得られなかった。

<div style="margin:20px 0"><canvas id="chart-c1" width="720" height="270"></canvas></div>

図1：性能差を構造と CoT に分解（適合度1–10、ペア対比 Δ、誤差棒±2SEM、MS-FA は別尺度のため除外）。紫＝構造の寄与（いずれも思考OFF同士）、緑＝プロンプトを固定して思考だけ ON にした寄与。構造側はゼロ付近に収まり、CoT 側が明確に大きい。

### 4.2 主張② 仕組み（cue-addressable）— ✗ 支持されない

手がかりキーの効果（行動、ペア対比 Δ±SEM）

| 対比 | 値 | 解釈 |
|---|---|---|
| mrprompt − nokey | −0.04 ±0.15 | キーを消しても下がらない |
| mrprompt − wrongkey | +0.03 ±0.15 | キーを壊しても下がらない |
| mrprompt − noscene | +0.15 ±0.17 | 場面 facet を全部抜いても下がらない |

<div style="margin:20px 0"><canvas id="chart-c2" width="720" height="180"></canvas></div>

図2：手がかりキーの効果（行動、適合度1–10、ペア対比 Δ、誤差棒±2SEM）。キーを消す・壊す・場面 facet を全部抜く、いずれも Δ はゼロをまたぎ、性能は動かない。

機構プローブ（n=29）でも同じ

| 対比 | 値 [95%CI] | 解釈 |
|---|---|---|
| key − wrongkey | −0.84 [−2.98, +1.43] | 一致キーと誤キーで差なし |
| key − nokey | −3.98 [−6.74, −1.25] | キーを足すとむしろ低下 |

行動でも内部でも、一致したキーとでたらめなキーが区別されていない。注意の集中を見ても手がかりキーにはほとんど注意が向かない。cue-addressable は、行動・機構いずれのレベルでも、論文の逐語プロンプトと本物の MS-FA 指標を使っても支持されなかった。

なぜキーが効かないのか。佟湘玉の facet で辿る。手がかりキー（cue_phrases）は「お戻り！まだお代をもらってないよ！」「情は情、商売は商売。」、本体は emotional_state＝警戒・抜け目なく算盤を弾く、behavior_pattern＝細かく計算し売り込み客に催促、thinking_pattern＝利益優先、である。論文の見立てでは、対話(STM)を見てこのキーと照合し、合致した facet だけを「立ち上げる」段が要る。だがモデルにそうした引き当ての段は無い。キーと対話を突き合わせて facet を1枚だけ選び、それだけを読み込む、という選別はどこにも無く、モデルは与えた人格記述を一度にまとめて読んでいる。検索器は無く（主張③）、仮にソフトな照合が起きているならキーに注意が向くはずだが、図3の通り注意は本体（16–22層で1.52倍、L18ピーク）に集まり、キーには終始向かない。

3通りの操作で性能が落ちないことは、これで説明がつく。

- 消す(nokey)：キーの2文を削っても、本体は「警戒・算盤・利益優先」のまま、対話は「金さえ払えば道場を開く」という商売の話。どの場面かは本体＋対話から読めるのでキーは冗長。実際 §3.3 の nokey 生成は「うちの宿屋の商売が武館に負けるわけにはいかない、早く客を呼ぶ手を考えないと」と、女将の銭勘定口調を保っている。
- 別場面のキーに替える(wrongkey)：キーが引き当て作業をしていない以上、別場面の手がかり語に差し替えても誤配線は起きない。正しい本体がそのまま効くので、wrongkey 生成も「うちの宿屋は黒社会は泊めない、看板に傷がつく」と商売目線を崩さない。
- 場面 facet を全部抜く(noscene)：scene_facets を落としても、核の人格記述と対話から応答できる。

むしろキーを足すと機構プローブでわずかに下がる（key−nokey=−3.98）。cue_phrases は「お戻り！まだお代を…」のように、それ自体が会話の一文の形をしている。識別の手がかりを足さないまま、対話と紛らわしい引用文として注意を分散させるためと見られる。

つまり「cue-addressable な想起」に見えていたものの実体は、宛先による取り出しではなく、本体の記述と対話に対する内容ベースの注意である（§4.3）。キーは宛先として働いていない。

逆に、キーが宛先として成立する設計はどのようなものか。本実験の結果はその条件も示唆する。アドレスが意味を持つのは、指す先が他の経路で得られないときに限る。現状は facet 本体が対話と同じ文脈に並んでおり、内容ベースの照合だけで必要な facet が選べてしまうため、短いキーは構造上迂回される。キーが宛先として機能するには、本体を文脈から外し、キーを唯一の取り出し経路に置く構成が要る。facet を外部メモリにキー付きで格納し、対話とキーの照合で一致した本体だけを注入する検索段を挟む、あるいは本体を識別子に置き換えてキーを引数とする取り出し操作を経由させる、といった形である。モデル内部でキー→facet を引かせるなら、本体を伏せた条件での学習が要る。いずれも本再現の対象（in-context に全 facet を積む論文どおりの構成）の外にある。確認は本節と同じ nokey/wrongkey プローブでよく、宛先として働いていれば今度は wrongkey が誤った本体を引いて性能を落とし、key−wrongkey が正に転じるはずである。

### 4.3 何が寄与しているのか — 中身、そして第16–22層

facet の中身（情緒・口調・振る舞いといった実質の記述で、手がかりキーを除いた本体）は応答を左右している。MS-FA（正解 facet と反転 facet の応答の分離度）は思考OFFで 8.20、ONで 9.21（1/5/10 尺度で大半が 10）と高く、モデルは facet の中身を入れ替えれば応答を明確に変える。手がかりキーは区別しないが、中身には反応している。そして内部では、その処理が層に局在していた（ブートストラップCIつき）。

| 指標 | 16–22層の集中度 [95%CI] |
|---|---|
| facet本体への注意 | 1.52× [1.45, 1.58]（ピークL18） |
| 人格差の残差立ち上がり | 1.26× [1.23, 1.30]（L21でプラトー） |

<div style="margin:20px 0"><canvas id="chart-attn" width="720" height="380"></canvas></div>

図3：層ごとの「注意の向き先」。横軸＝層(0–35)、縦軸＝注意量。棒＝facet 本体（中身）への注意、白線＝手がかりキーへの注意。本体は 16–22 帯（淡黄）に集中し L18 でピーク、キーは終始低く平坦。モデルは中身を読むが、キーは引いていない。

さらに per-character bridge では、各キャラの facet swap と、そのキャラ自身の気質 steering ベクトルが、16–22層で有意に同じ方向を向いた（コサイン +0.050 [+0.020, +0.079]）。汎用の感情軸では null だったが、キャラごとに測ると正。「言葉による介入」も「活性化への介入」も、同じ場所・同じ軸だった。この帯は <a href="/poptones/posts/activation-steering/">Activation Steering の記事</a> で人格・感情を操作するベクトルが作用した層帯と一致する。

<div style="margin:20px 0"><canvas id="chart-bridge" width="720" height="380"></canvas></div>

図4：プロンプト（言葉）による介入と、活性化への直接介入（隠れ状態に steering ベクトルを足す手法）は同じ軸か。各キャラの facet 反転がプロンプト側で残差を動かす向きと、そのキャラの気質から言い換えで作った steering ベクトルの向きのコサインを層別に。16–22 帯（淡黄）で正、L27 でピーク。両者は同じ層・同じ向きを向いている。

---

## 5. まとめ（主張ごとの判定）

| 主張 | 判定 | 根拠 |
|---|---|---|
| ① 構造化 ＞ カード（特に小型） | △ 限定的 | mrprompt − card = +0.46*。ただし mrprompt − base = +0.20 は非有意 |
| ① のうち「構造の寄与」 | △ 小さい | 思考ONを足すと card でも mrprompt でも +0.65〜0.78。構造分はこれに及ばない |
| ② cue-addressable な選択的活性化 | ✗ 支持されず | nokey/wrongkey/noscene で不変、key−wrongkey も null |
| 実際に寄与しているもの | — | CoT（思考モード）と facet の内容。第16–22層に局在し、活性化steeringと同軸 |

測られた範囲では、MRPrompt の性能向上の源は論文が語る「cue-addressable な想起」ではない。性能差の主因は CoT 生成（思考モード）であり、正しい facet への契合は内容に帰属し、手がかりキーは区別の働きをしていない。構造化メモリそのものは、素の散文記述に対して有意な上積みを示さなかった。論文は出力（judge スコア）のみを測りながら機構（retrieval/recall）を語っており、その機構主張は機構レベルでは支持されなかった、というのが本検証の結論である。

構造はテキスト自体には保持されない。コンテキストに入った瞬間、フラットなトークン列になる。それでも構造化した書き方がいくらか有効だとすれば、それを支えているのはプロンプト側ではなく、事前学習で「構造化テキストの読み方」を内面化したモデル側である。

---

## 6. 限界

- 本再現は論文の構築・生成・採点プロンプト（Fig.14/15/18/19, Table 21）を逐語で用いたが、インスタンス選択（どの STM がどの facet を引くか、その反転 facet をどう作るか）は論文プロンプトではなく本実験の装置である。これは方法を「実装」するのでなく「選別」する役割である。公式の MRBench は匿名化リポジトリで提供されており、本実験では用いず CharacterEval から自前でインスタンスを構成した。
- n が小さい（行動 N=100、機構プローブ n=29、bridge n=17）。区間は広く、判定は予備的である。
- 単一モデル（Qwen3-8B）・単一シード系列・中国語キャラ。
- CoT の効果は「思考モードの ON/OFF」で測っており、test-time の計算量増加そのものの効果と、推論内容の質の効果は分けていない。

---

## 7. 感情の記憶のその後

MRPrompt が枠組みの下敷きに据える「感情の記憶」(§1.1)には、120年あまりの前史がある。この発想は演技と臨床で二度提唱され、二度とも、提唱者自身が実践のなかで後退させた。

### 7.1 一つの心理学、二つの応用

「感情の記憶」はもともと演技論の用語ではない。フランスの心理学者テオデュール・リボーが1894年に情動記憶(mémoire affective)として論じたもので、過去に経験した情動は出来事の細部が薄れた後も残り、適切な手がかりがあれば呼び戻せる、という考えである。リボーはこのとき、本物の情動記憶（過去の情動そのものを実際に再体験すること）と、偽の情動記憶（出来事を知的になぞるだけで情動の再賦活を伴わないもの）を区別していた。手がかりで記憶を呼び戻すという主張が、本当に情動を動かしているのか、体裁だけなのか。この問いは発想の出発点からあった。

スタニスラフスキーはリボーを読み、この情動記憶を俳優訓練に取り入れて「感情の記憶」と呼んだ。同じ時期、同じ心理学の臨床側で（シャルコー、ジャネに連なるヒステリー研究の線で）フロイトが、過去の情動を伴う記憶が症状として残り、それを呼び戻せば解けるという発想に到達する。出発点は共通している。蓄えた情動は記憶として残り、適切な手がかりで再体験できる。スタニスラフスキーはそれを舞台で役を立ち上げる資源とし、フロイトは症状を解く手段とした。

MRPrompt は、この同じ発想を計算手続きに移したものと見ることができる。キャラクターの長期記憶を facet に分け、対話の手がかりに一致する facet を呼び出す。応用先が俳優、患者、言語モデルと違うだけで、機構の主張は一つである。蓄えた性格・情動の記憶は、手がかりで宛先を指定して取り出せる、というものだ。リボーが立てた本物と偽の区別は、本稿の問A(手がかりキーは機能しているか)とそのまま重なる。

### 7.2 スタニスラフスキー — 提唱者が感情の記憶を後退させた

スタニスラフスキーにとって、感情の記憶は到達点ではなく出発点だった。『俳優修業』(英訳 An Actor Prepares, 1936)でこの技法を説いた彼は、晩年それを自ら疑う。個人の苦しい記憶を呼び戻す作業は消耗が大きく、専門家の助けなしに続ければ俳優自身を損ないうると考えたためである。1920年代末から彼は、内面の感情を先に喚起するやり方を後退させ、身体的行動を先に置けば感情は後からついてくるとする「身体的行動の方法」へ移った。1934年にパリで五週間師事したステラ・アドラーは、彼が感情の記憶を最後の手段としてしか認めず、記憶ではなく想像力と戯曲の「与えられた状況」から入るよう勧めるのを見て驚いている。

この転回には、戦争と政治も関わっている。身体的行動を前に出す改訂は、唯心論と批判された体系をソ連の弁証法的唯物論に適合させる動きと無縁ではなかった。西側がスタニスラフスキーを初期の感情の記憶で固定したのも、伝達のずれによるものでもある。An Actor Prepares(英訳1936)が単独で先に届いて米編集者に短縮された一方、後年の『性格構築』(Building a Character, ロシア語1948/英訳1949)、『役の創造』(Creating a Role, ロシア語1957/英訳1961)は、第二次大戦とスターリン期の検閲で十年以上遅れた。リー・ストラスバーグがアメリカの「メソッド」の中心に感情の記憶を据えたとき、本人がすでに離れていた段階が、戦争で遅れて届いていた。

### 7.3 フロイト — 臨床が理論を書き換え続けた

フロイトの側の改訂はさらに大きい。出発点のカタルシス療法(ブロイアー/フロイト『ヒステリー研究』, 1895)は、症状を放出されずに溜まった情動とみなし、その記憶を情動ごと再体験して言葉にすれば症状は消えるとした。だが出発点となった症例アンナ・O(ベルタ・パッペンハイム)は当時治っておらず、再発と薬物依存で療養所に入り、回復は数年後に別の手段でなされた。フロイトは1896年、神経症の原因を幼少期の実際の性的虐待に求める誘惑理論を立てたが、分析が結末に至らないことを理由に翌1897年これを撤回する。やがて治療を打ち切って去った症例(ドラ, 1905)を、彼は転移（患者が過去を想起せず、治療者との関係で反復してしまうこと）を扱い損ねた失敗として読み直し、その転移を治療の中心装置に据え直した。

最大の改訂のきっかけは戦争だった。第一次大戦の戦争神経症の兵士たちが、戦場の体験を夢と行動で強迫的に反復するのを見て、フロイトは「人は快を求める」という前提では説明がつかないとし、反復強迫と死の欲動を立てる(『快原理の彼岸』, 1920)。臨床から現れた事実が、前提そのものを覆した。1933年には著作が「ユダヤの学」として焼かれ、1938年の併合でウィーンを追われロンドンへ亡命した。彼は最後まで、想定した機構が臨床で支持されないと見るたびに理論を作り替えている。

### 7.4 MRPrompt の位置

二人に共通するのは、感情の記憶を最終的な機構として守らなかったことである。スタニスラフスキーは技法の効果が安定せず害もありうると見て順序を組み替え、フロイトは想定した機構（記憶の再体験による治癒、実在の外傷）が臨床で支持されないと見てそのつど作り替えた。ただしこの改訂は純粋な自己点検ではない。戦争や政治的圧力、つまり、ソ連の統制と検閲、ナチズムによる迫害に強いられた面が大きい。理論が前へ進んだのは、自分では選べない事実、つまり、分析が結末に至らない、患者が去る、戦争神経症の反復が現れたとき、それを当初の主張の弁護に使わなかったからである。

本稿の結果は、MRPrompt にとってこの種の事実にあたる。cue-addressable な facet 想起という、論文が主張する機構は、手がかりを除いても誤らせても出力が動かず、実際に効いていたのは構造ではなく推論だった(§4.1、§4.2)。これはリボーの言う偽の情動記憶（体裁は想起だが再賦活を伴わない）に近い。方法そのものの否定ではなく、主張上の機構と実際に効いている機構がずれているという報告である。

スタニスラフスキーが感情の記憶を身体的行動へ組み替えたように、MRPrompt の改良も、効いていない検索機構を守るのではなく、実際に効いている部分（CoT と facet の内容）の上に説明を組み直す方向にある。

---

## 8. コード・データ

- GitHub: [Flowers-of-Romance/mrprompt-repro](https://github.com/Flowers-of-Romance/mrprompt-repro)（逐語プロンプト・両LTM・生成・採点・機構プローブ一式）

関連：<a href="/poptones/posts/raskolnikov/">ラスコーリニコフの記事</a>（人格 facet を手で設計した例）、<a href="/poptones/posts/activation-steering/">Activation Steering</a>（同じ16–22層帯）。

## 参考文献

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
drawContrast('chart-c1',CA,-0.8,1.4,0.4,'Δ 適合度 (1–10, ±2SEM)');
drawContrast('chart-c2',CB,-0.6,0.8,0.2,'Δ 適合度 (1–10, ±2SEM)');
</script>

</div>
