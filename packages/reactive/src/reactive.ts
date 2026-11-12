import type { Dispose } from "./reactive-type";

/** 
 * 内部で使用するreactive内で共有される自動追従用のオブジェクト
 */
type Observer = {
    /** 実際にsetが実行する、callbackをラップした関数 */
    run: () => void;
    /** 依存元が依存先（Set<Observer>：Signalのgetで登録されるもの）を知るためのSet */
    deps: Set<Set<Observer>>;
    /** disposeされたかどうかを管理するフラグ */
    isDisposed: boolean;
    /** どうスケジュールするかを決めるための関数 */
    notify: () => void;
};

/** 
 * 自身の所有権を管理するためのオブジェクト\
 * 1つのEffectもしくはComputedごとに一つのOwnerを持つ\
 * OwnerはDisposeできない子の参照値を管理するため
 */
type Owner = {
    /** 自身のコンテキストの中に埋もれているeffectの所有権 */
    children: Set<Owner>;
    /** 自身の依存関係を消去するための関数 */
    dispose: Dispose;
};



/**
 * reactiveモジュール内で共有するためのcurrentObserve\
 * createEffect実行時もしくはCompute.get(時にグローバルに関数を登録する\
 * Signalのget時に変数に関数が設定されていたらSignalの内部に登録\
 * 
 * **※誰が誰に依存しているのかを管理するためのオブジェクト**
 */
let currentObserver: Observer | null = null;


/**
 * Effect、Computedが自身がネストしているかどうかを確認するためのOwnerオブジェクト
 */
let currentOwner: Owner | null = null;


/**
 * スケジュールを行う
 */
const [schedule, flush] = (() => {

    const scheduleSet: Set<Observer> = new Set();
    let isSchedule: boolean = false;

    /**
     * 処理したい対象をスケジュールする
     * @param observer タスクとして積みたい処理を持つObserver
     */
    const schedule = (observer: Observer) => {
        scheduleSet.add(observer);
    }

    /**
     * たまっているタスクを実行する
     */
    const flush = () => {
        // 実行後にscheduleされているものは削除されること
        // 実行中にscheduleを変更されてもscheduleのループ自体には影響が出ないこと
        // タスクに積まれていないなら処理しない
        if(isSchedule) {
            return;
        }

        // flushが多重に実行しないように設定しておく
        isSchedule = true;

        // スケジュール本体でループする
        // 存在するならループ開始 → 内部でまずスケジュール本体を空にする
        // スケジュールの処理で再度スケジュールする処理があるなら別のループとして処理
        // もしかしたら無限ループの可能性あり ← 例外で伝える
        let count = 0;
        try {
            while(scheduleSet.size !== 0) {

                // 例えば100回以上countが回っていたら無限ループ扱いとか
                if(count > 100) {
                    throw new Error();
                }
                count = count + 1;

                // 実行するスケジュールをコピーしてから本体を消去する
                const copy = Array.from(scheduleSet);
                scheduleSet.clear();

                // スケジュールに積まれていたタスクを実行する
                for (const observer of copy) {
                    observer.run();
                }
            }
        } finally {
            isSchedule = false;
        }
    }

    return [schedule, flush];
})();

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
        // notifyの中でcleanUpが行われないため無限ループは起きない
        for(const subscriber of this.#subscribers) {
            subscriber.notify();
        }
        // 自身に依存する全てをスケジュールに登録した後に実行する
        // #NOTE: batch実装の時はここでflushするかどうかの分岐がある
        flush();
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
 * 自身が所有している子が所有している所有権の初期化処理を実行する
 * @param owner 
 */
const disposeChildren = (owner: Owner) => {
    // 子が自身のdispose処理（この関数そのもの）を実行する
    for(const child of Array.from(owner.children)) {
        child.dispose();
    }
    // 実行し終えたら自信が持つネストした子の一覧を削除する
    owner.children = new Set();
}


/**
 * 呼び出しているSignalの変更によって自動追従するためのEffectを作成する
 * @param callback signal<T>.get()を内部で実行している関数
 * @return 作成したEffectを削除するための関数
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
const createEffect = (callback: (this: void) => void): Dispose => {
    
    /** 実際にSignalに実行される関数 */
    const run = () => {
        // observerがすでにdisposeされていたら処理しない
        if(observer.isDisposed) {
            return;
        }

        // 実行時点で自身の所有権にある参照を一旦クリアにしてから再度処理を行う
        disposeChildren(selfOwner);
        // 自分自身をグローバルに共有しcallback内で子が
        // 自身にownerを登録できるようにする
        const prevOwner = currentOwner;
        currentOwner = selfOwner;

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
            currentOwner = prevOwner;
            currentObserver = prevObserver;
            // もしcallback()内でdisposeを呼ばれている場合は再度cleanUpを実行する
            // #NOTE: callback実行中はcurrentObserverが自身を指したままのため、
            // dispose後に呼ばれたget()で再び依存が登録される。それを外すために再度cleanUpする
            // observer = null にする方針だとここでobserverの型がneverになるため不採用
            if (observer.isDisposed) {
                disposeChildren(selfOwner);
                cleanUp(observer);
            }
        }
    }

    /** モジュール内で実行中のcallbackを共有するためのObserver */
    const observer: Observer = {
        run,
        deps: new Set(),
        isDisposed: false,
        notify: () => schedule(observer),
    }

    /** 自身をメモリから解放するための関数 */
    const dispose = () => {
        // 依存している対象から自身を解除し自身を他から参照できないようにする
        // #NOTE: 実行後はrunとobserverが互いに参照しあっているだけなので参照値は破棄される
        selfOwner.dispose();
    }

    /** dispose時に連鎖して子の参照値を破棄するためのowner */
    const selfOwner: Owner = {
        // 自分自身にネストしているeffectを保持すること
        // 自身のネストしているeffectをcleanUpすること
        children: new Set(),
        dispose: () => {
            // すでにobserverが解除されていたら処理しない
            if(observer.isDisposed) {
                return;
            }
            // 自身の子と孫の関係を切る
            disposeChildren(selfOwner);
            // 親がいれば親から自分自身を削除する
            // 双方向に登録したものは、どちら側から解除しても、両側から外れるかを見る
            parentOwner?.children.delete(selfOwner);
            // 自身の依存関係自体も解消し、誰も管理していないしされていない状態にする
            cleanUp(observer);
            observer.isDisposed = true;
        }
    }

    // 処理終了後にまだ親がある（自分がネストしている）なら親に自分を登録する
    // ここまで来た時点でcreateEffectがcreateEffectの内部で動いている場合は
    // createEffectのrunで自身のOwnerをグローバルに共有する
    // → callback内にcreateEffectがある場合は下の処理で登録される
    const parentOwner = currentOwner;
    parentOwner?.children.add(selfOwner);

    // effectを初回実行する
    run();
    return dispose;
}

/** 
 * まだ値がないことを示すsymbol\
 * Computedの初期値に対して
 * - 未定値を持たせ遅延実行を実現するか
 * - コンストラクター関数内で初回の計算をするか
 * 
 * で未設定値を選択
 */
const UNSET = Symbol("unset");

/**
 * あるSignalもしくはComputedを利用して中間値を定義するためのComputedクラス
 */
class Computed<T> {

    // 自身より上位の依存は自分の計算要否をコントロールできること
    //  → 完全に自分でコントロールできるため不要
    // Compouted自身に依存する対象は自身で管理できること → depsで受け渡す
    // Computedを実行するかは自身の上位に決めさせないこと → notifyで定義

    static #token = Symbol();
    #subscribers: Set<Observer>;
    #callback: () => T;
    #observer: Observer;
    #isDirty: boolean;
    // #value: T;
    // undefinedにするとcallback自体がundefinedの可能性があるため専用のsymbolで定義
    #value: T | typeof UNSET = UNSET;
    #owner: Owner;
    #parentOwner: Owner | null;

    private constructor(token: symbol, callback: () => T) {
        // factoryメソッド経由以外では生成できないようにする
        if(token !== Computed.#token) {
            throw new TypeError();
        }

        // 改めてComputedの準備を行う
        this.#subscribers = new Set();
        this.#callback = callback;
        this.#observer = {
            run: () => {
                // Computedのrunは実行されないので処理しない
                // #NOTE: notifyでスケジュールされEffectでrunからgetされるので
                // 呼ばれることがない
            },
            deps: new Set(),
            isDisposed: false,
            notify: () => {
                // Signalがnotify実行時点で変更フラグが立っている
                // = すでに自分の依存対象が変更に切り替えているので処理の必要がない
                if(this.#isDirty) {
                    return;
                }
                // Signalによって呼ばれる = 変更がある前提なので
                // この時点で初回だと必ず通る
                // 以降重複した呼び出しは上のifで避ける
                this.#isDirty = true;
                // 自身の更新前に下流が（getを）実行してしまう可能性があるため
                // 下流も一度スケジュールし（一箇所に集める）実行タイミングを固定することで
                // Computed、Effectの重複とglitchを避ける
                const copy = Array.from(this.#subscribers);
                for (const subscriber of copy) {
                    subscriber.notify();
                }
            }
        }
        // 自身が誰かの子として生成されている場合は自身を追加する
        this.#owner = {
            children: new Set(),
            dispose: () => this.dispose(),
        }
        const prevOwner = currentOwner;
        prevOwner?.children.add(this.#owner);
        this.#parentOwner = prevOwner;

        this.#isDirty = true;
    }

    static create<T>(callback: () => T): Computed<T> {
        return new Computed(Computed.#token, callback);
    }

    /**
     * 依存元の値を利用した中間値を取得する
     * @returns 計算後の値
     */
    get (): T {

        // すでに参照値が破棄されているなら以前の値を返す
        if(this.#observer.isDisposed) {

            // 未定値でない場合はそのまま返す
            if (this.#value !== UNSET) {
                return this.#value;
            }
            // 未定値のまま = 一度も計算されていない なので
            // 一度も計算されないまま破棄された場合は、追跡せずに1回だけ計算する
            const prevObserver = currentObserver;
            currentObserver = null;
            try {
                this.#value = this.#callback();
                return this.#value;
            } finally {
                currentObserver = prevObserver;
            }
        }

        // 自分に依存しているものがあれば自身への依存として保持する
        // その依存を下位に渡しcleanUp時に削除できるようにする
        if(currentObserver) {
            this.#subscribers.add(currentObserver);
            currentObserver.deps.add(this.#subscribers);
        }

        // ここではTに絞り込まれているため以降は必ずvalueが存在する
        if (!this.#isDirty && this.#value !== UNSET) {
            return this.#value;
        }

        // 自分に依存する対象があれば一旦受け取って自身をグローバルに登録する
        const prevObserver = currentObserver;
        currentObserver = this.#observer;
        try {
            // 以前に登録されていた依存関係を解除する
            disposeChildren(this.#owner);
            cleanUp(this.#observer);

            // 依存はcallbackの中で使用されていたら登録される
            this.#value = this.#callback();
            // 計算が正しく行えた場合のみ再計算フラグを下す
            this.#isDirty = false;
            return this.#value;
        } finally {
            currentObserver = prevObserver;
        }
    }

    /**
     * 自身の依存関係を解消し実行以降は誰からも参照されないようにする\
     * 破棄後のgetは最後に計算した値を返す。一度も計算されていなければ、追跡せずに1回だけ計算する。
     */
    dispose () {
        if(this.#observer.isDisposed) {
            return;
        }
        cleanUp(this.#observer);
        disposeChildren(this.#owner);
        // 親があれば自身を削除してから親の参照値を外す
        this.#parentOwner?.children.delete(this.#owner);
        this.#parentOwner = null;
        this.#observer.isDisposed = true;
    }
}


export { Signal, createEffect, Computed }