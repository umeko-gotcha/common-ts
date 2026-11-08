/** 
 * 内部で使用するreactive内で共有される自動追従用のオブジェクト
 */
type Observer = {
    /** 実際にsetが実行する、callbackをラップした関数 */
    run: () => void;
    /** 依存元が依存先（Set<Observer>：Signalのgetで登録されるもの）を知るためのSet */
    deps: Set<Set<Observer>>;
};


/**
 * reactiveモジュール内で共有するためのcurrentObserve\
 * createEffect実行時にグローバルに関数を登録する\
 * Signalのget時に変数に関数が設定されていたらSignalの内部に登録\
 * 
 * **※誰が誰に依存しているのかを管理するためのオブジェクト**
 */
let currentObserver: Observer | null = null;

/**
 * 状態を保持するためのシグナルクラス
 */
class Signal<T> {

    #value: T;
    #subscribers: Set<Observer>

    /** @param value 初期値 */
    constructor(value: T) {
        this.#value = value;
        this.#subscribers = new Set();
    }

    /** 
     * 値を取得する\
     * **※注意：メソッドを取り出して渡すとthisが失われるため型エラーになる。アロー関数で包んで渡すこと**
     * @example
     * createEffect(signal.get);         // 型エラー
     * createEffect(() => signal.get()); // OK
     */
    get (this: Signal<T>): T {
        // グローバルにコンテキストが実行中なら保持しておく
        if(currentObserver) {
            this.#subscribers.add(currentObserver);
            // 依存しているObserverが自身の依存先を知るため
            // 自分に依存しているObserverをグローバルに共有する
            currentObserver.deps.add(this.#subscribers);
        }
        return this.#value;
    }

    /** 
     * 値を設定する。newValueと以前の値が同じ場合は値の更新が走らない。
     * @param newValue 新しい値
     * 
     * **※注意：Effectに渡す関数内で同じSignalのget()を同じset()に入れると無限ループを起こす**
     * @example
     * const signal = new Signal(0);
     * createEffect(() => {
     *     signal.set(signal.get() + 1); // ← 無限ループを起こす
     * });
     */
    set (this: Signal<T>, newValue: T) {
        if (Object.is(newValue, this.#value)) {
            return;
        }
        this.#value = newValue;
        // 内部に保持したコンテキストを実行する
        // #NOTE: observerのrunの中でcleanUpを行うためコピーしてからrunを実行しないと無限ループになる
        // 1. setでsubscribersがループされる
        // 2. runが動きeffectが実行される
        // 3. cleanUpでsubscribersの中身が削除された後getで再度subscribersに登録される
        // 4. subscribersが変更されたため反復し再度同じObserverのrunを実行する
        const copy = Array.from(this.#subscribers);
        for(const subscriber of copy) {
            subscriber.run();
        }
    }
}


/**
 * Observeにある依存関係を解消する
 * @param observer
 */
const cleanUp = (observer: Observer) => {
    // 依存元から自身の依存を解消する
    for(const dep of Array.from(observer.deps)) {
        dep.delete(observer);
    }
    // 依存元に渡されていたSetをリセットする
    observer.deps = new Set();
}


/**
 * 呼び出しているSignalの変更によって自動追従するためのEffectを作成する
 * @param callback signal<T>.get()を内部で実行している関数
 * @example
 *  // signalを生成する
 *  const signal = new Signal<string>("hello");
 *  // signalのgetを呼び出している関数を定義する
 *  const callback = () => {
 *      console.log(signal.get());
 *  }
 *  // 定義したcallbackを渡す（初回実行される）
 *  createEffect(callback);
 *  // 再度signalに値をセットする
 *  signal.set("test"); // ← 値をセットしたタイミングでeffectに登録したcallbackが実行される
 */
const createEffect = (callback: (this: void) => void) => {
    
    /** 実際にSignalに実行される関数 */
    const run = () => {
        // 自身の依存と自身への依存をそれぞれ解消してから処理を始める
        cleanUp(observer);
        // すでに実行中の関数があれば一度内部に保持する
        const prevObserver = currentObserver;
        // グローバルに登録する
        currentObserver = observer;
        try {
            callback();
        } finally {
            // callback内で例外が発生したかに関わらずグローバルに保持したコンテキストは解消しておく
            currentObserver = prevObserver;
        }
    }

    /** モジュール内で実行中のcallbackを共有するためのObserver */
    const observer: Observer = {
        run,
        deps: new Set(),
    }

    run();
}


export { Signal, createEffect }