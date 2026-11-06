import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../src/eventbus";
import type { Message } from "../src/eventbus-type";

/**
 * テスト専用の追加対応表。
 */
interface TopicMap {
    "greet": { name: string };
    "count": { n: number };
}

describe("EventBus", () => {

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

    const greetMessage: Message<TopicMap, "greet"> = { topic: "greet", payload: { name: "tester" } };

    it("コンストラクタで関数を渡していなければデフォルトのエラー処理が実行される", () => {

        // 空の状態でEventBusを生成する
        const eventbus = new EventBus<TopicMap>();
        // エラーを発生させるリスナーを登録してイベント発火させる
        eventbus.subscribe("greet", () => { throw new Error("リスナーは失敗する") });

        // 確かめたい対象（console.error）を渡し一回呼ばれたかを調べる
        eventbus.publish(greetMessage)
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("コンストラクタで関数を渡していれば渡した関数が実行される", () => {

        // 記録用のmock関数を生成してEventBusのコンストラクタに渡す
        const onError = vi.fn();
        const eventbus = new EventBus<TopicMap>(onError);
        // エラーを発生させるリスナーを登録してイベント発火させる
        eventbus.subscribe("greet", () => { throw new Error("リスナーは失敗する") });

        // ハンドラーが呼ばれたかどうかを調べる
        eventbus.publish(greetMessage);
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it("コンストラクタでエラーを投げる関数を渡していても処理が止まらない", () => {

        // エラーを投げる関数をエラーハンドラーとして使用する
        const eventbus = new EventBus<TopicMap>(() => { throw new Error("エラーハンドラーは失敗する") });
        // エラーを発生させるリスナーと、正常に処理されるリスナーを登録してイベント発火させる
        const secondListener = vi.fn();
        eventbus.subscribe("greet", () => { throw new Error("リスナー1は失敗する") });
        eventbus.subscribe("greet", secondListener);

        // コンストラクタで渡したエラーハンドラーが例外を投げても
        // publishの呼び出し元に例外は伝播しないことを確認する
        expect(() => eventbus.publish(greetMessage)).not.toThrow();
        expect(secondListener).toHaveBeenCalledTimes(1);
    });

    it("コンストラクタで関数を渡していてもpublishの引数で個別にエラーハンドラーを渡していればその関数が実行される", () => {
        
        // エラーハンドラーとして使用する
        const dummyOnError = vi.fn();
        const eventbus = new EventBus<TopicMap>(dummyOnError);
        // publishの引数で個別に指定するエラーハンドラーを用意する
        const onError = vi.fn();
        eventbus.subscribe("greet", () => { throw new Error("リスナーは失敗する") });
        eventbus.publish(greetMessage, onError);

        // ダミーが呼ばれていないことを確認しつつ
        // publishの引数で指定したエラーハンドラーが呼ばれたことを確認する
        // 対照（コントロール）
        expect(dummyOnError).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it("コンストラクタで関数を渡していなくてもpublishの引数で個別にエラーハンドラーを渡していればその関数が実行される", () => {

        // 空の状態でEventBusを生成する
        const eventbus = new EventBus<TopicMap>();
        // エラーを発生させるリスナーを登録してイベント発火させる
        eventbus.subscribe("greet", () => { throw new Error("リスナーは失敗する") });
        const onError = vi.fn();
        eventbus.publish(greetMessage, onError);

        // デフォルトのエラーハンドラーが呼ばれていないことを確認しつつ
        // publishの引数で指定したエラーハンドラーが呼ばれたことを確認する
        expect(console.error).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it("publisherのエラーハンドラーが例外を投げても呼び出し元に例外は伝播しない", () => {

        // 空の状態でEventBusを生成する
        const eventbus = new EventBus<TopicMap>();
        // エラーを発生させるリスナーを登録してイベント発火させる
        eventbus.subscribe("greet", () => { throw new Error("リスナーは失敗する") });
        // 例外を投げるエラーハンドラーをpublishの引数で指定する
        const onError = () => { throw new Error("エラーハンドラーは失敗する") };

        // 例外が発生した場合にpublishの呼び出し元に例外が伝播しないことを確認する
        expect(() => eventbus.publish(greetMessage, onError)).not.toThrow();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("listenerで例外が発生してもpublishの呼び出し元に例外は伝播しない", () => {

        // 例外を投げるリスナーと、正常に処理されるリスナーを登録してイベント発火させる
        const eventbus = new EventBus<TopicMap>();
        eventbus.subscribe("greet", () => { throw new Error("リスナーは失敗する") });
        const secondListener = vi.fn();
        eventbus.subscribe("greet", secondListener);

        // 例外が発生した場合にpublishの呼び出し元に例外が伝播しないことを確認する
        expect(() => eventbus.publish(greetMessage)).not.toThrow();
        expect(secondListener).toHaveBeenCalledTimes(1);
    });

    it("subscribeで登録した関数がpublishで発行されたメッセージを受け取れる", () => {
        
        // EventBusを生成する
        const eventbus = new EventBus<TopicMap>();
        // listenerを登録してイベント発行する
        const listener = vi.fn();
        eventbus.subscribe("greet", listener);

        // listenerが呼ばれたかどうかを調べる
        eventbus.publish(greetMessage);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("同じ関数をsubscribeで複数回登録してもpublishで発行されたメッセージは一度だけ実行される", () => {

        // listenerを複数回登録してイベント発行する
        const eventbus = new EventBus<TopicMap>();
        const listener = vi.fn();
        eventbus.subscribe("greet", listener);
        eventbus.subscribe("greet", listener);

        // listenerが1回だけ呼ばれたかどうかを調べる
        eventbus.publish(greetMessage);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("subscribeで登録した関数が非同期関数であってもpublishで発行されたメッセージを受け取れる", () => {

        // 非同期関数を登録してイベント発行する
        const asyncListener = vi.fn(async () => {});
        const eventbus = new EventBus<TopicMap>();
        eventbus.subscribe("greet", asyncListener);

        // 実行結果としてそれぞれのlistenerが呼ばれたかどうかを調べる
        eventbus.publish(greetMessage);
        expect(asyncListener).toHaveBeenCalledTimes(1);
    });

    // 非同期のテストはpromiseを渡す
    it("非同期のlistenerが失敗すると、エラーハンドラに届く", async () => {

        // 非同期での例外発生を確認するため、非同期関数を登録してイベント発行する
        const onError = vi.fn();
        const eventbus = new EventBus<TopicMap>(onError);
        eventbus.subscribe("greet", async () => { throw new Error("非同期で失敗する"); });

        // 以降の同期処理が完了したら処理が走る
        eventbus.publish(greetMessage);
        expect(onError).not.toHaveBeenCalled();

        // マクロタスクで非同期処理が完了するのを待つ
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(onError).toHaveBeenCalledTimes(1);
    });


    it("unsubscribe後は届かない", () => {

        // unsubscribeの挙動を確認するため、listenerを登録してイベント発行する
        const eventbus = new EventBus<TopicMap>();
        const listener = vi.fn();
        const unsubscribe = eventbus.subscribe("greet", listener);

        // 登録したリスナーを解除した後にイベントを発火する
        unsubscribe();
        eventbus.publish(greetMessage);
        expect(listener).not.toHaveBeenCalled();
    });

    it("別のtopicには届かない", () => {

        // 別のトピックに対するリスナーを登録してイベント発火する
        const eventbus = new EventBus<TopicMap>();
        const greetListener = vi.fn();
        eventbus.subscribe("greet", greetListener);
        const countListener = vi.fn();
        eventbus.subscribe("count", countListener);

        // 別のトピックに対するイベントを発火したことで別のトピックのリスナーが呼ばれないことを確認する
        eventbus.publish(greetMessage);
        expect(greetListener).toHaveBeenCalledTimes(1);
        expect(countListener).not.toHaveBeenCalled();
    });

    it("エラーハンドラにmessage・listener・errorが渡される", () => {

        const onError = vi.fn();
        const eventbus = new EventBus<TopicMap>(onError);

        // 比べるために、errorとlistenerを変数にしておく
        const error = new Error("リスナーは失敗する");
        const failingListener = () => { throw error; };
        eventbus.subscribe("greet", failingListener);

        // 3つの引数が、渡したものと一致するか確認する
        eventbus.publish(greetMessage);
        expect(onError).toHaveBeenCalledWith(greetMessage, failingListener, error);
    });

    it("listener内でsubscribeした場合に新しいlistenerは呼ばれない", () => {

        // listenerの中でlistenerを登録する
        const eventbus = new EventBus<TopicMap>();
        const listener = vi.fn();
        eventbus.subscribe("greet", () => {
            eventbus.subscribe("greet", listener);
        });

        // ここでpublishしても内部のlistenerは呼ばれない
        eventbus.publish(greetMessage);
        expect(listener).not.toHaveBeenCalled();
        // 二度目以降は呼ばれる
        eventbus.publish(greetMessage);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("listener内でunsubscribeしてもその時のpublish時には影響しない", () => {

        // listenerの中でunsubscribeする
        const eventbus = new EventBus<TopicMap>();
        const listener = vi.fn();
        // unsubscribeを保持するための変数
        let unsubscribe = () => false;
        // unsubscribeの処理をするlistenerの後にunsubscribeの対象となる
        // listenerが登録されている必要があるため、解除する側を先に登録する
        // 再入（リエントランシー）
        eventbus.subscribe("greet", () => { unsubscribe(); });
        unsubscribe = eventbus.subscribe("greet", listener);

        // 今回は呼ばれる（publish開始時の一覧で回る）
        eventbus.publish(greetMessage);
        expect(listener).toHaveBeenCalledTimes(1);
        // 次回は呼ばれない（解除は効いている）
        eventbus.publish(greetMessage);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
