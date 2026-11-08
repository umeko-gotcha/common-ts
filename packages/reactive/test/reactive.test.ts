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

    // #TODO: Disposeの実装に想定
    // Signalが持つEffect自体を完全に削除することができないためその対策（メモリリーク）
    it.todo("disposeの実行後に正しく依存関係が解消される");
});

describe("disposeによるネストしたEffectの依存性解消", () => {

    // #TODO: Ownerの実装後に想定
    // Effectがネストしている場合に内側のEffectの参照を切ることができないためその対策
    it.todo("disposeの実行後にネストしたEffectの依存性が解消される");
});