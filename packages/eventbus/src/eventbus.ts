import type {
    Message,
    Listener,
    Batch,
    UnSubscriber,
    OnError,
    SubscriberGroup
} from "./eventbus-type";


/** 
 * 内部で使用するサブスクライバーの型\
 * 内部で持つフィールドに型を持たせられないための対策
 */
type AnyListener = () => void | Promise<void>;

/**
 * 内部で使用するメッセージのバージョンを管理するための型
 */
type MessageHistory<M extends object, K extends keyof M> = {
    version: number,
    message: Message<M, K>
}


/**
 * メッセージとイベントハンドラーを結ぶためのEventBus
 */
class EventBus<M extends object> {

    // トピックとトピックを購読したい関数の集合
    #listenerMap: Map<keyof M, Set<AnyListener>> = new Map();
    // EventBus全体で処理する共通のエラーハンドラー
    #onError: OnError<M>;
    // 直近のメッセージのバージョンを管理するためのマップ
    #messageHistory: Map<keyof M, MessageHistory<M, keyof M>> = new Map();
    // 現在のsubscribe実行中に適応させたいonError
    #currentOnError: OnError<M> | undefined;

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
    #assertListenersError<K extends keyof M>(message: Message<M, K>, listener: Listener<M, K>): void {

        const errorHandler = (error: unknown) => {
            try {
                const onError = this.#currentOnError ?? this.#onError;
                onError(listener, error);
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
     * 同期・非同期の両方で使う、例外を外に漏らさないエラー処理
     * @param onError ハンドリングしたいエラーハンドラー
     * @param messages 発行されたメッセージの配列
     * @param batch 実際にエラーを放出したリスナー
     */
    #assertBatchsError<K extends keyof M>(messages: Message<M, keyof M>[], batch: Batch<M, keyof M>): void {

        const errorHandler = (error: unknown) => {
            try {
                const onError = this.#currentOnError ?? this.#onError;
                onError(batch, error);
            } catch (err: unknown) {
                const topics = messages.map(message => message.topic);
                console.error(
                    `topic「${String(topics.join(', '))}」のエラーハンドラで例外が発生しました。`,
                    err,
                );
            }
        }

        try {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const result = batch(messages as Message<M, K>[]);
            if (result instanceof Promise) {
                result.catch(error => errorHandler(error));
            }
        } catch (error: unknown) {
            errorHandler(error);
        }
    }

    /**
     * 購読したいメッセージを受け取って処理させたい関数を登録するためのsubscriber
     * @param group 購読したいトピックとそのトピックのメッセージを受け取る関数のタプル
     * @returns listenerをEventBusから解除するためのdispose関数
     */
    subscribe<K extends keyof M>(group: SubscriberGroup<M, K>): UnSubscriber {

        const listenerWrapper = (): void => {
            if(group[0] === "batch") {
                // メッセージのバージョンが一致しない（ずれている）場合は処理しない
                const historys = group[1]
                            .map(topic => this.#messageHistory.get(topic))
                            .filter(history => history !== undefined);
                if(new Set(historys.map(hisotry => hisotry.version)).size > 0) {
                    return;
                }
                const messages = historys.map(history => history.message);
                this.#assertBatchsError(messages, group[2]);
            } else {
                const history = this.#messageHistory.get(group[1]);
                if(!history) {
                    return;
                }

                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                this.#assertListenersError(history.message as Message<M, K>, group[2]);
            }
        }

        const topics = group[0] === "batch" ? group[1] : [group[1]]
        const deleteSet: Set<Set<AnyListener>> = new Set();
        for(const topic of topics) {
            const listeners = this.#listenerMap.get(topic) ?? new Set();
            listeners.add(listenerWrapper);
            this.#listenerMap.set(topic, listeners);
        }

        return () => {
            for(const deletes of deleteSet) {
                deletes.delete(listenerWrapper);
                if(deletes.size > 0) {
                    return;
                }
                deletes.clear();
            }
        }
    }

    /**
     * イベントを発行しEventBusが管理しているlistenerを実行させる
     * @param message イベントとして飛ばしたいトピックとデータをまとめたメッセージ
     * @param onError listener実行中に例外が発生した際に実行させたエラーハンドラー
     */
    publish<K extends keyof M>(message: Message<M, K>, onError?: OnError<M>): void {

        // 実行のたびにバージョンを進める
        const history = 
            this.#messageHistory.get(message.topic) ?? { version: 0, message };
        history.version = history.version + 1;
        history.message = message;
        this.#messageHistory.set(message.topic, history);

        this.#currentOnError = onError ?? this.#onError;

        const listeners = Array.from(this.#listenerMap.get(message.topic) ?? []);
        for (const listener of listeners) {
            listener();
        }

        this.#currentOnError = undefined;
    }
}



export { EventBus };
