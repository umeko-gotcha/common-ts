import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Signal, createEffect, Computed } from "../src/reactive";



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

    describe("getの値取得に対する観点（正しく計算されるか）", () => {

        it("get後にComputedは計算された正しい値が返ってくる", () => {

            // 計算結果が正しいかどうか確認する
            const aSignal = new Signal(1);
            const bSignal = new Signal(2);
            const computed = Computed.create(() => aSignal.get() + bSignal.get());
            
            // 初回の値を確認する
            expect(computed.get()).toBe(3);
        });

        it("set後のComputedのgetは再計算された正しい値が返ってくる", () => {

            const logs: number[] = [];
            const aSignal = new Signal(1);
            const bSignal = new Signal(2);
            const computed = Computed.create(() => aSignal.get() + bSignal.get());
            
            // getを二回することでフィールドに計算結果を保持し忘れていないことを確認
            aSignal.set(3);
            logs.push(computed.get());
            logs.push(computed.get());
            expect(logs).toEqual([5, 5]);
        });

        // #NOTE: Computed内ではset、Effectの生成をできないようにする
        it("Computedの計算処理でsetを実行するとエラーになる", () => {

            const signal = new Signal(1);
            const computed = Computed.create(() => {
                signal.set(3);
                return 1;
            });

            expect(() => computed.get()).toThrow();
            // カウンタが戻っていれば、外でのsetは成功する（依存関係の整理は動いているため）
            expect(() => signal.set(5)).not.toThrow();
        });

        it.todo("Computedの計算処理内でcreateEffectを実行するとエラーになる");
    });


    describe("disposeに対する観点（破棄された後の挙動）", () => {

        it("disposeを実行するとSignalのset後にgetをしても古い値が返る", () => {

            const logs: number[] = [];
            const aSignal = new Signal(1);
            const computed = Computed.create(() => aSignal.get());
            
            // dispose実行前と実行後で値が変化しないことを確認する
            logs.push(computed.get());
            computed.dispose();
            aSignal.set(3);
            logs.push(computed.get());
            logs.push(computed.get());
            expect(logs).toEqual([1, 1, 1]);
        });

        it("disposeを2回実行しても壊れない", () => {

            const aSignal = new Signal(1);
            const computed = Computed.create(() => aSignal.get());
            
            // disposeを2回実行しても問題なく処理が行われる（べき等かどうか）
            computed.dispose();
            expect(() => computed.dispose()).not.toThrow();
        });

        it("一度計算されたComputedをdispose後に行うgetは再計算をしない", () => {

            // mockを間に挟んで再計算されているかどうかを確認する
            const aSignal = new Signal(1);
            const mock = vi.fn(() => aSignal.get());
            const computed = Computed.create(mock);
            computed.get();

            // dispose → 依存元を set → get しても計算関数は呼ばれない
            computed.dispose();
            aSignal.set(3);
            computed.get();
            expect(mock).toHaveBeenCalledTimes(1);
        });

        it("作成されて一度もgetされずdisposeするとget時に一度だけ計算される", () => {

            const aSignal = new Signal(1);
            const mock = vi.fn(() => aSignal.get());
            const computed = Computed.create(mock);
            
            // disposeの時点ではまだ計算されていない
            computed.dispose();
            expect(mock).not.toHaveBeenCalled();
            // get時に一度だけ計算される
            computed.get();
            aSignal.set(3);
            computed.get();
            expect(mock).toHaveBeenCalledTimes(1);
        });

        it("Effectの中で作ったComputedは、親のdisposeで破棄される", () => {

            // 誰からも参照されないことを確かめる
            // 外からComputedを確認できる状態にして、dispose後に本当に
            // innerがなくなっているのか確認する
            const aSignal = new Signal(1);
            let inner: Computed<number> | undefined;
            const dispose = createEffect(() => {
                inner = Computed.create(() => aSignal.get());
                inner.get();
            });

            // 実行後にdisposeしてからsetで値の変更を見る
            dispose();
            aSignal.set(3);
            // 破棄されていれば古い値（1）、破棄されていなければ新しい値（3）
            expect(inner?.get()).toBe(1);
        });

        it("ネストしたComputedのdisposeを呼ぶとアウターのComputedが呼ばれても内部のComputedは呼ばれない", () => {
            
            const signal = new Signal(1);
            const mock = vi.fn(() => signal.get());
            const innerComputed = Computed.create(mock);
            const outerComputed = Computed.create(() => innerComputed.get());
            
            // innerを破棄→signalをset→outerのgetでinnserが動くかどうか確認
            // 最初にgetをして計算しておく
            outerComputed.get();
            innerComputed.dispose();
            signal.set(3);
            outerComputed.get();
            expect(mock).toHaveBeenCalledOnce();
        });
        
        // 親だけが読むtriggerで親を再実行させ、1回目に作られたComputedを外から確かめる
        // 破棄されていれば、依存元をsetしても古い値（1）のまま
        it("Effectの中で作ったComputedは、親のEffectの再実行で破棄される", () => {

            // 親だけが依存しているものと、子も依存しているものを用意し、
            // 親だけが動く状態を作った上で、外からComputedを動かす
            // → Computedは破棄されるはずなので、2回動いたりすることはないはず
            const signal = new Signal(1);
            const trigger = new Signal(2);
            const created: Computed<number>[] = [];
            createEffect(() => {
                trigger.get();
                const c = Computed.create(() => signal.get());
                // Effect自体に残すのと配列に残すのとで両方行う
                c.get();
                created.push(c);
            });

            // 親が再実行 → created[0]はEffectから破棄されるはず
            trigger.set(4);
            signal.set(3);
            // Effectから破棄されていれば古い値のまま
            // Computedが破棄されている=cを計算しても過去の値を利用するため
            expect(created[0].get()).toBe(1);
        });

    });


    // pull型そのものの実装（呼び出されるまで計算しない）
    describe("読まれるまで計算しない（遅延実行）", () => {

        // computedにmockを忍ばせてsetが動いても呼ばれないことを確認する
        it("実際に呼び出されるまで計算が行われない", () => {

            const aSignal = new Signal(1);
            const mock = vi.fn(() => aSignal.get());
            Computed.create(mock);

            // setの時点では呼ばれない
            aSignal.set(3);
            expect(mock).toHaveBeenCalledTimes(0);
        });

        it("呼び出したら計算が行われる", () => {

            const aSignal = new Signal(1);
            const mock = vi.fn(() => aSignal.get());
            const computed = Computed.create(mock);

            // getを呼び出して初めてmockが呼ばれる
            computed.get();
            expect(mock).toHaveBeenCalledTimes(1);
        });

    });

    // 不要な計算を行わないというpull型のキャッシュ実装に対する内容
    describe("元が変わっていなければ計算し直さない（キャッシュ）", () => {

        it("依存元の値が変更されないなら再計算はされない", () => {

            const aSignal = new Signal(1);
            const mock = vi.fn(() => aSignal.get());
            const computed = Computed.create(mock);

            // getしてもSignalの値が変わっていないから計算されていない
            computed.get();
            computed.get();
            expect(mock).toHaveBeenCalledTimes(1);
        });

        it("依存元の値が変更されている場合は再計算を行う", () => {
                        
            const aSignal = new Signal(1);
            const mock = vi.fn(() => aSignal.get());
            const computed = Computed.create(mock);

            computed.get();
            aSignal.set(3);
            computed.get();
            expect(mock).toHaveBeenCalledTimes(2);
        });

        // 再計算されない観点でテストを行う（影響されない）
        it("無関係なSignalをsetしても再計算されない", () => {
                        
            const aSignal = new Signal(1);
            const bSignal = new Signal(2);
            const mock = vi.fn(() => aSignal.get());
            const computed = Computed.create(mock);

            // getしてもSignalの値が変わっていないから計算されていない
            computed.get();
            bSignal.set(4);
            computed.get();
            expect(mock).toHaveBeenCalledOnce();
        });


        it("Computedを読むComputedでも、依存元が変わらなければ上流は再計算されない", () => {

            // ネストしたComputedが再実行時に呼び出されないことを確認する
            const aSignal = new Signal(1);
            const mock = vi.fn(() => aSignal.get());
            const innerComputed = Computed.create(mock);
            const computed = Computed.create(() => innerComputed.get());
            
            // 再実行するが変化していないのならinnerComputedは呼び出されない
            computed.get();
            computed.get();
            expect(mock).toHaveBeenCalledOnce();
        });
    });

    describe("元が変わったら自分を読んでいる下流に知らせる（伝染）", () => {

        it("自身に依存する対象がいる状態で依存元が変更されたら自身に依存する対象は呼び出される", () => {

            const logs: number[] = [];
            const aSignal = new Signal(1);
            const computed = Computed.create(() => aSignal.get());
            createEffect(() => logs.push(computed.get()));

            // aSignalが変更されると下流のEffectも動くはず
            aSignal.set(3);
            expect(logs).toEqual([1, 3]);
        });

        it("動的に依存しなくなった対象は変更されても追従しない", () => {
            
            // 動的な依存の関係の変化でmockが一回位しか呼ばれていない
            // （一方しか追従していない）ことを確かめたい
            const isFlag = new Signal(true);
            const aSignal = new Signal(1);
            const bSignal = new Signal(2);
            const mock = vi.fn(() => isFlag.get() ? aSignal.get() : bSignal.get());
            const computed = Computed.create(mock);

            // 初回はaSignalに依存している
            computed.get();
            // flagを切り替えることでbSignalに依存するように仕向ける
            isFlag.set(false);
            computed.get();
            // 切り替えた状態（もしかしたらaとbそれぞれ依存しているかも）で
            // 一旦mockをクリアする
            mock.mockClear();
            // 再度aを更新した状態でgetしてmockが動かないことを確かめる
            aSignal.set(3);
            computed.get();
            expect(mock).not.toHaveBeenCalled();
        });

        it("動的にComputedの依存元が変わっても新しく依存する依存元を追従する", () => {

            const isFlag = new Signal(true);
            const aSignal = new Signal(1);
            const bSignal = new Signal(2);
            const mock = vi.fn(() => isFlag.get() ? aSignal.get() : bSignal.get());
            const computed = Computed.create(mock);

            // 1回目
            computed.get();
            // 2回目（bに依存させる）
            isFlag.set(false);
            computed.get();
            mock.mockClear();
            // 今度はbを変更してgetすることでもう片方は正しく呼ばれていることを確認する
            bSignal.set(4);
            computed.get();
            expect(mock).toHaveBeenCalledOnce();
        });

        // glitch freeの観点
        // ダイヤモンドグラフにおいてSignalとSignalを使用するComputedが
        // 同時に使用される状態だと下流が独立して動いてしまうためその点が
        // 発生しないことを確認する
        it("Signalとそれに依存するComputedの両方に依存するEffectがある場合Effectの実行は一度だけ行われる", () => {

            const signal = new Signal(1);
            const computed = Computed.create(() => signal.get() + 1);
            const mock = vi.fn(() => {
                signal.get();
                computed.get();
            });
            createEffect(mock);

            // 初回にmockは動くがsignalが一度動いてもEffectの中身は1度だけ動く
            signal.set(3);
            expect(mock).toHaveBeenCalledTimes(2);
        })

        it("ダイヤモンドグラフの時にEffectが見る値は常に新しい値になる", () => {
            
            const logs: number[] = [];
            const signal = new Signal(1);
            const computed = Computed.create(() => signal.get() + 1);
            createEffect(() => {
                logs.push(signal.get());
                logs.push(computed.get());
            });

            // signalを変更するとそのsignalの最新の値をcomputedは計算値に使う
            signal.set(3);
            expect(logs).toEqual([1, 2, 3, 4]);
        });

        // 下流に正しく処理が流れることを確認する
        it("ComputedがComputedを追従していてもglitchは起きない", () => {

            const logs: string[] = [];
            const signal = new Signal("a");
            const firstComputed = Computed.create(() => signal.get() + "b");
            const secondComputed = Computed.create(() => firstComputed.get() + "c");
            createEffect(() => {
                logs.push(signal.get());
                logs.push(firstComputed.get());
                logs.push(secondComputed.get());
            });

            // Signalが変更されても下流まで正しくSignalの値が使用される
            signal.set("x");
            expect(logs).toEqual(["a", "ab", "abc", "x", "xb", "xbc"]);
        });

        it("ComputedがComputedを追従していても正しく連鎖する", () => {

            const signal = new Signal("a");
            const firstComputed = Computed.create(() => signal.get());
            const mock = vi.fn(() => firstComputed.get());
            const secondComputed = Computed.create(mock);

            // 最初に実行しておくことで一度計算をしておく
            secondComputed.get();
            mock.mockClear();
            // Signalが変更されても下流まで正しくSignalの値が使用される
            signal.set("x");
            secondComputed.get();
            expect(mock).toHaveBeenCalledOnce();
        });


        // #NOTE: batch時のversionで考える
        it.todo("再計算の結果が前と同じとき、下流に知らせるか");

        // 回数を数える（vi.fn）：計算したか、呼ばれたか
        // 順番を記録する（log）：どの順で、どの値で動いたか
        // 参照を外に残す：中で作られたものを、後から直接触る

    });
});