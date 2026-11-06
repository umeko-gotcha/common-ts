import type {
    Message,
    Listener,
    UnSubscriber,
    OnError
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

        // 同期・非同期の両方で使う、例外を外に漏らさないエラー処理
        const handler = (listener: Listener<M, K>, error: unknown) => {
            try {
                errorHandler(message, listener, error);
            } catch (err: unknown) {
                console.error(
                    `topic「${String(message.topic)}」のエラーハンドラで例外が発生しました。`,
                    err,
                );
            }
        };

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        for (const listener of listeners as Listener<M, K>[]) {
            try {
                const result = listener(message);
                if (result instanceof Promise) {
                    result.catch(err => handler(listener, err));
                }
            } catch (error: unknown) {
                handler(listener, error);
            }
        }
    }
}

export { EventBus };
