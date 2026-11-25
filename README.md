# フロント向け個人開発用ライブラリ
主にeventbusとreactiveの実装を目的としたライブラリ。



## 目的
このRepositoryの目的は、主に以下の２点になります。
- 個人開発をする上でソースのアーキテクチャを考えた際に、eventbusとreactiveの実装が必要であったこと
- 単体テストのソースを記述することが普段ないため、自己学習を目的として練習をしたかったこと



## 実装内容について

## eventbus
実装済みのもの
 - typescriptによる型安全を目的としたeventbus classの実装
 - eventbusのインスタンスが持つ型パラメータに含まれるプロパティをトピックとしたsubscribe実装
 - eventbusのインスタンスが持つ型パラメータのバリューを引数に受け取るpublisher実装
 - eventbusの最中は例外が発生しても止まらないようにする実装
 - 複数のトピックが終わってから反応するlistenerを定義するwhenAllの実装<br>
  （javaのcycle barrier と類似の内容）

未実装で実装予定のもの
 - publishしたMessageを保持するEventStoreの実装
 - 後からtopicをキーにイベントを検索できる機能
 - 保持してあるMessageを出力、破棄する機能
 - publish中にMessageを変更できなくする機能

## reactive
実装済みのもの
 - Signal
 - createEffect
 - dispose
 - Computed
 - scheduler・flush
 - Owner

未実装で実装予定のもの
 - batch
 - untrack
 - scope
 - context

<br>


## テストの考え方

### テストで意識する観点
- 引数（ユーザーの入力）<br>
  - ユーザの入力に何が許されるか
  - その入力によってどう変わるか
    →スコープの長さによって意識する範囲が変わる
- フィールドの寿命（ライフサイクル）<br>
  - 設定したフィールドがどの関数で使用されるか
  - その変数の変化によってどうなるのか
    →変数の影響が他の関数に影響するかどうかに関わる
- 処理順番（時間のずれ）<br>
  - 処理の順番
  - 始まりと終わり
    ↑前後関係が1:1になるように考え、上書きされたりしていないかを意識