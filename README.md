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

未実装で実装予定のもの
 - publishしたMessageを保持するEventStoreの実装
 - 後からtopicをキーにイベントを検索できる機能
 - 保持してあるMessageを出力、破棄する機能
 - publish中にMessageを変更できなくする機能

## reactive
 - 現在実装内容整理中