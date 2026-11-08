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

    // #TODO: Ownerの実装後に想定
    // Effectがネストしている場合に内側のEffectの参照を切ることができないためその対策
    it.todo("disposeの実行後にネストしたEffectの依存性が解消される");
});