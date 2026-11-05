import type { 
    Topic,
    TopicMap,
    Message,
    Listener,
    UnSubscriber,
    OnError,
    Publisher,
    Subscriber
} from "./eventbus-type"


/** 
 * 内部で使用するサブスクライバーの型\
 * 内部で持つフィールドに型を持たせられないための対策
 */
type AnySubscriber = (message: Message<never>) => void | Promise<void>;

/**
 * メッセージとイベントハンドラーを結ぶためのEventBus
 */
class EventBus {

    // トピックとトピックを購読したい関数の集合
    #listenerMap = new Map<Topic, Set<AnySubscriber>>();
    // EventBus全体で処理する共通のエラーハンドラー
    #onError: OnError;

    /**
     * @param onError EventBus共通で処理したい関数。\
     * 指定がない場合はエラーをログに出力するのみ（console.error）となる。
     */
    constructor(onError?: OnError) {
        this.#onError = onError ?? console.error;
    }

    /**
     * 購読したいメッセージを受け取って処理させたい関数を登録するためのsubscriber
     * @param topic 購読したいメッセージのキー
     * @param callback メッセージを受け取って処理させたい関数
     * @returns callbackをEventBusから解除するためのdispose関数
     */
    subscribe<K extends Topic>(topic: K, callback: Listener<K>): UnSubscriber {
        let listeners = this.#listenerMap.get(topic);
        if (!listeners) {
            // setに登録しつつローカル変数として保持する
            this.#listenerMap.set(topic, (listeners = new Set()));
        }
        listeners.add(callback);
        return () => listeners.delete(callback);
    }

    /**
     * イベントを発行しEventBusが管理しているlistenerを実行させる
     * @param message イベントとして飛ばしたいトピックとデータをまとめたメッセージ
     * @param onError listener実行中に例外が発生した際に実行させたエラーハンドラー
     */
    publish<K extends Topic>(message: Message<K>, onError?: OnError) {

        // 引数で個別に指定されていればそのエラーハンドラーを利用する
        const errorHandler = onError ?? this.#onError;
        // 元々登録されているlistenerを配列に変換して保持する
        // publish実行時点でのlistenerに対して操作を行うため、
        // subscribe内でのsubscribeやunsubscribeの影響を受けない
        const listeners = Array.from(this.#listenerMap.get(message.topic) ?? []);

        // 同期・非同期の両方で使う、例外を外に漏らさないエラー処理
        const handler = (listener: Listener<K>, error: unknown) => {
            try {
                errorHandler(message, listener, error);
            } catch (err: unknown) {
                console.error(
                    `topic「${String(message.topic)}」のエラーハンドラで例外が発生しました。`,
                    err,
                );
            }
        };

        for (const listener of listeners) {
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

/** グローバルに監視するインスタンス */
const eventbus = new EventBus();


export type {
    Topic,
    TopicMap,
    Message,
    Publisher,
    Subscriber,
    OnError,
    Listener,
    UnSubscriber,
}

export {
    EventBus,
    eventbus
}
