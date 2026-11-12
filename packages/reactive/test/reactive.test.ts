import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Signal, createEffect } from "../src/reactive";



describe("Effectの基本動作テスト", () => {

    beforeEach(() => {
        // デフォルトのエラーログがテスト結果の表示を汚さないよう、出力を止めておく
        // （spyなので「呼ばれたかどうか」は後から確認できる）
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.spyOn(console, "dir").mockImplementation(() => { });
    });

    afterEach(() => {
        // spyOnで差し込まれたconsole系のオブジェクトを元のものに戻す
        vi.restoreAllMocks();
    });

    it("Signalの値が変わったらcreateEffectに登録した関数が自動で実行される", () => {
        
        const name = new Signal("a");
        const log: string[] = [];
        // この時点でlogには"a"があるはず
        createEffect(() => log.push(name.get()));
        // nameの値を更新するとlogには"hidden"が入るはず
        name.set("hidden");
        
        // テストの結果
        expect(log).toEqual(["a", "hidden"]);
    });

    it("Signalの値が以前の値と同じなら自動更新が走らない", () => {

        const name = new Signal("a");
        const log: string[] = [];
        // この時点でlogには"a"があるはず
        createEffect(() => log.push(name.get()));
        // nameの値を更新するがsignalの元の値と同じためlogにはaが追加されないはず
        name.set("a");
        // 別の値なら追加されるはず
        name.set("b");
        
        // テストの結果
        expect(log).toEqual(["a", "b"]);
    });
});


describe("ネストしたEffectのテスト", () => {

    beforeEach(() => {
        // デフォルトのエラーログがテスト結果の表示を汚さないよう、出力を止めておく
        // （spyなので「呼ばれたかどうか」は後から確認できる）
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.spyOn(console, "dir").mockImplementation(() => { });
    });

    afterEach(() => {
        // spyOnで差し込まれたconsole系のオブジェクトを元のものに戻す
        vi.restoreAllMocks();
    });
    
    // 正しく依存関係が登録されるか確認する
    it("内側のeffectは自分が読んだsignalで再実行される", () => {
        
        const a = new Signal("a");
        const log: string[] = [];
        // この時点でlogには"a"があるはず
        createEffect(() => {
            createEffect(() => log.push(a.get()));
        });
        // ここではaの値がlogに追加されないはず
        a.set("a+");

        // テストの結果
        expect(log).toEqual(["a", "a+"]);
    });

    it("内側で読んだsignalは、外側のeffectの依存にならない", () => {

        const a = new Signal("a");
        const b = new Signal("b");
        const log: string[] = [];
        // この時点でlogには"a"があるはず
        createEffect(() => {
            createEffect(() => b.get());
            log.push(a.get());
        });

        // ここではaの値がlogに追加されないはず
        b.set("b+");
        
        // テストの結果
        expect(log).toEqual(["a"]);
    });

    it("内側のeffectの実行後も、外側は自分が読んだsignalを追跡できる", () => {

        const a = new Signal("a");
        const b = new Signal("b");
        const log: string[] = [];
        // この時点でlogには"a"と"b"があるはず
        createEffect(() => {
            createEffect(() => b.get());
            log.push(a.get());
        });

        // ここで問題なくaの値がlogに追加されるはず
        a.set("a+");
        
        // テストの結果
        expect(log).toEqual(["a", "a+"]);
    });
});


describe("動的なEffectのテスト", () => {

    beforeEach(() => {
        // デフォルトのエラーログがテスト結果の表示を汚さないよう、出力を止めておく
        // （spyなので「呼ばれたかどうか」は後から確認できる）
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.spyOn(console, "dir").mockImplementation(() => { });
    });

    afterEach(() => {
        // spyOnで差し込まれたconsole系のオブジェクトを元のものに戻す
        vi.restoreAllMocks();
    });


    it("条件によって読むSignalが変わっても新しいSignalを追跡する", () => {

        const a = new Signal("a");
        const show = new Signal(false);
        const log: string[] = [];
        // この時点でshowはfalseのためlogには"hidden"があるはず
        createEffect(() => {
            const value = show.get() ? a.get() : "hidden";
            log.push(value); 
        });

        // ここでshowを変更したから"a"が登録されるはず
        show.set(true);
        // ここでaを変更したから"a+"が登録されるはず
        a.set("a+");
        
        // テストの結果
        expect(log).toEqual(["hidden", "a", "a+"]);
    });
    
    // Signalに一度登録されたEffectが残り続けるためその対策
    it("条件によって読まなくなったSignalの実行では再実行されない", () => {

        const a = new Signal("a");
        const show = new Signal(true);
        const log: string[] = [];
        createEffect(() => {
            const value = show.get() ? a.get() : "hidden";
            log.push(value); 
        });

        // ここでshowを変更したから"hidden"が登録されるはず
        show.set(false);
        // showとaにはすでにaの依存関係が解消されており"hidden"は増えないはず
        // true：showとaにEffectが登録されている
        // false：showとaからそれぞれEffectが解除されている
        a.set("a+");
        
        // テストの結果
        expect(log).toEqual(["a", "hidden"]);
    });
});


describe("disposeによるEffectの依存性解消", () => {

    beforeEach(() => {
        // デフォルトのエラーログがテスト結果の表示を汚さないよう、出力を止めておく
        // （spyなので「呼ばれたかどうか」は後から確認できる）
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.spyOn(console, "dir").mockImplementation(() => { });
    });

    afterEach(() => {
        // spyOnで差し込まれたconsole系のオブジェクトを元のものに戻す
        vi.restoreAllMocks();
    });

    // Signalが持つEffect自体を完全に削除することができないためその対策（メモリリーク）
    it("disposeの実行後に正しく依存関係が解消される", () => {

        const log: string[] = [];
        // aに依存するEffectを作成する
        const a = new Signal("a");
        const dispose = createEffect(() => log.push(a.get()));

        // disposeを実行する前はlogに"a+"が追加される
        a.set("a+");
        // disposeを実行すると以降aを変更しても追加されない
        dispose();
        a.set("a++");
        expect(log).toEqual(["a", "a+"]);
    });

    it("Effectが複数に依存している場合でもdisposeを実行後に依存が解消される", () => {

        const log: string[] = [];
        const a = new Signal("a");
        const b = new Signal("b");
        const dispose = createEffect(() => {
            log.push(a.get());
            log.push(b.get());
        });

        // disposeを実行する前はlogに"a+"と"b"が追加される
        a.set("a+");
        // disposeを実行すると以降a、bを変更しても追加されない
        dispose();
        a.set("a++");
        b.set("b+");
        expect(log).toEqual(["a", "b", "a+", "b"]);
    });

    it("再実行で後から追加された依存も、disposeで解除される", () => {

        const log: string[] = [];
        const a = new Signal("a");
        const show = new Signal(false);
        const dispose = createEffect(() => {
            log.push(show.get() ? a.get() : "hidden");
        });

        // 動的に依存する場合実行後に"a"が追加される
        show.set(true);
        // dispose後には変更をしても値が追加されない
        dispose();
        a.set("a+");
        expect(log).toEqual(["hidden", "a"]);
    });

    it("disposeを複数回呼んでもエラーにならない", () => {

        const log: string[] = [];
        const a = new Signal("a");
        const dispose = createEffect(() => log.push(a.get()));

        dispose();
        dispose();
        expect(log).toEqual(["a"]);
    });

    // 依存関係の解消後は動的に追加されても再度依存関係が追加されたりしない
    it("disposeを呼んでも別の依存関係を解消していない", () => {

        // 一つのSignalに依存する別々のEffectを作成する
        const a = new Signal("a");
        const first = vi.fn(() => a.get());
        const second = vi.fn(() => a.get());
        const dispose = createEffect(first);
        createEffect(second);

        // ここでfirstのみDisposeを実行してもsecondの依存関係は解消されていないはず
        dispose();
        a.set("a+");
        // firstは破棄されていて動かないがsecondは動いているはず
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
    });

    it("effect内で自身のdisposeを呼んでもエラーにならない", () => {

        const log: string[] = [];
        const a = new Signal("a");
        const show = new Signal(false);
        // 初回はfalseなのでエラーにならない（変数の初期化エラー）
        const dispose = createEffect(() => {
            if(show.get()) {
                dispose()
            }
            log.push(a.get());
        });

        // showをtrueに変更してdisposeした後にaに依存が登録されていないため
        // "a"は追加されるが以降のaの変更（"a+"）は検知されないはず
        show.set(true);
        a.set("a+");
        expect(log).toEqual(["a", "a"]);
    });
});

describe("disposeによるネストしたEffectの依存性解消", () => {

    beforeEach(() => {
        // デフォルトのエラーログがテスト結果の表示を汚さないよう、出力を止めておく
        // （spyなので「呼ばれたかどうか」は後から確認できる）
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.spyOn(console, "dir").mockImplementation(() => { });
    });

    afterEach(() => {
        // spyOnで差し込まれたconsole系のオブジェクトを元のものに戻す
        vi.restoreAllMocks();
    });
    
    // Effectがネストしている場合に内側のEffectの参照を切ることができないためその対策
    // #NOTE: 子が破棄されない代わりに親が破棄する
    it("親をdisposeすると、子も孫も破棄される", () => {

        const log: string[] = [];
        const a = new Signal("a");
        const b = new Signal("b");
        const c = new Signal("c");
        const dispose = createEffect(() => {
            createEffect(() => {
                createEffect(() => log.push(a.get()))
                log.push(b.get());
            });
            log.push(c.get());
        });

        // dispose実行後にbの値を更新するが"a", "b+", "c"は追加されない
        dispose();
        a.set("a+");
        b.set("b+");
        c.set("c+");
        expect(log).toEqual(["a", "b", "c"]);
    });

    it("親が再実行されると、前回作られた子は破棄される", () => {

        const log: string[] = [];
        const a = new Signal("a");
        const b = new Signal("b");
        // 親を作り再実行させて子がいるかもしれない状態を作る
        createEffect(() => {
            createEffect(() => log.push(a.get()));
            log.push(b.get());
        });
        b.set("b+");

        // 一度空にしてから子のSignalを変える
        log.length = 0;
        a.set("a+");
        expect(log).toEqual(["a+"]);
    });

    it("子だけをdisposeしても、親は動き続ける", () => {

        // 子のチェックをするために子の回数を調べるようにする
        const a = new Signal("a");
        const b = new Signal("b");
        const log: string[] = [];
        const child = vi.fn(() => b.get());
        createEffect(() => {
            const innerDispose = createEffect(child);
            // 子の参照値をのみを切る
            innerDispose();
            log.push(a.get());
        });
        // 一度計測をクリアにする
        child.mockClear();

        // 破棄された子のmockは動かない
        b.set("b+");
        expect(child).not.toHaveBeenCalled();
        // 子はすでに存在しないが親は動き続ける
        a.set("a+");
        expect(log).toEqual(["a", "a+"]);
    });

    it("親と子が同じsignalに依存していても、子は増えない", () => {

        // 子だけを削除して親だけが動いても子が増えていないことを確かめる
        const a = new Signal("a");
        const child = vi.fn(() => a.get());
        createEffect(() => {
            a.get();
            createEffect(child);
        });

        // 子の回数自体を調べるようにするため親だけ動かして子が想定通り動くかどうか確認する
        child.mockClear();
        a.set("a+");
        a.set("a++");
        expect(child).toHaveBeenCalledTimes(2);
    });

    it("条件によって子を作らなくなったら、前回の子は破棄される", () => {

        // 動的に依存が変更される場合において参照値が取り残されないか
        const log: string[] = [];
        const a = new Signal("a");
        const show = new Signal(true);
        createEffect(() => {
            if(show.get()) {
                createEffect(() => log.push(a.get()));
            }
        });

        // 最初は依存しているけどshowの結果により依存しなくなる場合
        // aに値をセットしても反応しないはず
        show.set(false);
        a.set("a+");
        expect(log).toEqual(["a"]);

    });
    it("親の外で作ったeffectは、別のeffectの再実行で破棄されない", () => {

        // finallyの部分に対する確認テスト
        // 親同士をそれぞれ独立して作りお互いに干渉しないかどうか確認する
        const trigger = new Signal(0);
        const b = new Signal("b");
        const log: string[] = [];
        createEffect(() => trigger.get());
        createEffect(() => log.push(b.get()));

        // 親が再実行される
        trigger.set(1);
        // 外で作ったeffectは生きているはず
        b.set("b+");
        expect(log).toEqual(["b", "b+"]);
    });
});


describe("Computedの実装テスト", () => {

    beforeEach(() => {
        // デフォルトのエラーログがテスト結果の表示を汚さないよう、出力を止めておく
        // （spyなので「呼ばれたかどうか」は後から確認できる）
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.spyOn(console, "dir").mockImplementation(() => { });
    });

    afterEach(() => {
        // spyOnで差し込まれたconsole系のオブジェクトを元のものに戻す
        vi.restoreAllMocks();
    });

    describe("値を取得する際の処理", () => {
        it.todo("Signalが変更されたら再計算を行える");
        it.todo("Computedが変更されたら再計算を行える");
        it.todo("2つあるSignalのうちどちらが変更されたら再計算できるようになる");
        it.todo("dispose後にSignalの変更があっても再計算はされない");
    });

    describe("Effectに依存される場合の処理", () => {
        it.todo("Computedが再計算される時だけEffectが実行される");
        it.todo("2つのSignalに依存するComputedに依存しても1回しかEffectは動かない");
        it.todo("disposeが呼ばれた後Effectは動かない");
    });

    describe("ネストしたComputedについての処理", () => {
        it.todo("Computed内でComputedを生成したら？");
        it.todo("Computed内でdisposeまで行ったら？");
        // 以下の二つは例外処理とDepth実装、Computed自体のPromise許容するかどうかで判断
        it.todo("Computed内でsetが呼ばれたら？");
        it.todo("Computed内でEffectが呼ばれたら？");
    });

    describe("多重の依存関係についての処理", () => {
        it.todo("Computedに依存していても正しく計算される");
        it.todo("一つのSignalにComputedが依存し、SignalとComputedにEffectが依存している状態でもEffectは一度だけ実行される");
    });

});