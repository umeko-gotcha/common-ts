import type {
    Message,
    Listener,
    UnSubscriber,
    OnError,
    Subscriber,
    Messages,
    AllListener
} from "./eventbus-type";


/** 
 * 内部で使用するサブスクライバーの型\
 * 内部で持つフィールドに型を持たせられないための対策
 */
type AnyListener = (message: never) => void | Promise<void>;

/**
 * メッセージとイベントハンドラーを結ぶためのEventBus
 */
class EventBus<M extends object> {

    // トピックとトピックを購読したい関数の集合
    #listenerMap: Map<keyof M, Set<AnyListener>> = new Map();
    // EventBus全体で処理する共通のエラーハンドラー
    #onError: OnError<M>;

    /**
     * @param onError EventBus共通で処理したい関数。\
     * 指定がない場合はエラーをログに出力するのみ（console.error）となる。
     */
    constructor(onError?: OnError<M>) {
        this.#onError = onError ?? console.error;
    }

    /**
     * 同期・非同期の両方で使う、例外を外に漏らさないエラー処理
     * @param onError ハンドリングしたいエラーハンドラー
     * @param message 発行されたメッセージ
     * @param listener 実際にエラーを放出したリスナー
     */
    #assertError<K extends keyof M>(
        onError: OnError<M>, message: Message<M, K>, listener: Listener<M, K>): void {

        const errorHandler = (error: unknown) => {
            try {
                onError(message, listener, error);
            } catch (err: unknown) {
                console.error(
                    `topic「${String(message.topic)}」のエラーハンドラで例外が発生しました。`,
                    err,
                );
            }
        }

        try {
            const result = listener(message);
            if (result instanceof Promise) {
                result.catch(error => errorHandler(error));
            }
        } catch (error: unknown) {
            errorHandler(error);
        }
    }

    /**
     * 購読したいメッセージを受け取って処理させたい関数を登録するためのsubscriber
     * @param topic 購読したいメッセージのキー
     * @param listener メッセージを受け取って処理させたい関数
     * @returns listenerをEventBusから解除するためのdispose関数
     */
    subscribe<K extends keyof M>(topic: K, listener: Listener<M, K>): UnSubscriber {
        const listeners = this.#listenerMap.get(topic) ?? new Set();
        listeners.add(listener);
        this.#listenerMap.set(topic, listeners);
        // 動的にTopicが増える設計の場合はset自体も削除する必要あり
        return () => listeners.delete(listener);
    }

    /**
     * イベントを発行しEventBusが管理しているlistenerを実行させる
     * @param message イベントとして飛ばしたいトピックとデータをまとめたメッセージ
     * @param onError listener実行中に例外が発生した際に実行させたエラーハンドラー
     */
    publish<K extends keyof M>(message: Message<M, K>, onError?: OnError<M>): void {

        const errorHandler = onError ?? this.#onError;
        // 元々登録されているlistenerを配列に変換して保持する
        // publish実行時点でのlistenerに対して操作を行うため、
        // subscribe内でのsubscribeやunsubscribeの影響を受けない
        const listeners = Array.from(this.#listenerMap.get(message.topic) ?? []);

        // #NOTE: listenerの引数の型であるMessage<M, K>のKをフィールドが持てないため、
        // AnyListener型で保持している。K自体は間違いなくmessage.topicの型であるため、
        // 型アサーションでListener<M, K>[]に変換している。
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        for (const listener of listeners as Listener<M, K>[]) {
            this.#assertError(errorHandler, message, listener);
        }
    }

    /**
     * #NOTE: 実装はAI生成で既存の実装と方針を提示し修正案を出力\
     * 関連する全てのイベントが実行されたことを確認してから実行するlisetnerを定義する。
     * 
     * @this Subscriber
     * @param topics 
     * @param listener 
     * @returns 実行後に関連するトピックの購読を解除する関数
     */
    whenAll<M extends object, const T extends readonly (keyof M)[]>(
        this: Subscriber<M>,
        topics: T,
        listener: AllListener<M, T>,
    ): UnSubscriber {

        // トピックに対応したメッセージを管理するためのMap
        const latest = new Map<keyof M, Message<M, keyof M>>();
        // listenerに紐づくトピック全体を保持するためのSet
        const arrived = new Set<keyof M>();

        const unsubscribers = topics.map((topic) =>

            // トピックごとにlistenerを登録していく
            this.subscribe(topic, (message) => {

                // それぞれのlistenerがお互いのtopicの状況を監視する
                latest.set(topic, message);
                arrived.add(topic);
                // まだ全部そろっていなければ待つ
                if (arrived.size < new Set(topics).size) {
                    return;
                }
                // そろったらリセットしてから呼ぶ
                arrived.clear();
                // #NOTE: topicsの順にlatestから取り出すので、各要素は対応するトピックのMessage
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                const messages = topics.map((t) => latest.get(t)) as Messages<M, T>;
                return listener(messages);
            }),
        );

        return () => {
            for (const unsubscribe of unsubscribers) {
                unsubscribe();
            }
        };
    }
}



export { EventBus };
