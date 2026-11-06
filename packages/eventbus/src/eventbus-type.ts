/**
 * トピック：データ ＝ 1:1で管理されるアプリメッセージ\
 * イベントの発行者（Message型のデータ生成）と、\
 * イベントの購読者（topicとMessage型のデータを受け取って処理する関数）を\
 * 繋ぐデータ型。任意の型Tを指定のデータで拡張することで静的に型チェックされる。
 * @template M 任意のオブジェクトを拡張した型。トピックとデータのマッピングを定義する。
 * @template T Mのキーの型。トピック名を指定する。
 */
type Message<M extends object, T extends keyof M> = {
    /** トピック名 */
    topic: T;
    /** トピックと1:1で対応するデータ */
    payload: M[T];
};

/**
 * 指定のキーに対応するメッセージを受け取って処理するイベントハンドラー
 * @param message 購読したいトピックに対応したメッセージ型
 */
type Listener<M extends object, T extends keyof M> = (
    message: Message<M, T>,
) => void | Promise<void>;

/** 
 * 実行後にイベントハンドラーを購読解除するための関数 
 * @returns イベントハンドラーが削除できたかどうか
 */
type UnSubscriber = () => boolean;

/**
 * イベントの発行側がイベント発行時に発生するエラーに対して処理するためのエラーハンドラー
 * @param message エラー発生時に発行していたメッセージオブジェクト
 * @param listener 実行時にエラーを吐いた関数
 * @param error listenerの実行時に発生したエラー
 */
type OnError<M extends object> = <K extends keyof M>(
    message: Message<M, K>,
    listener: Listener<M, K>,
    error: unknown
) => void;

/**
 * EventBusに対して発行のみを許可するためのインターフェース
 * @example
 *  interface YourMessageMap {
 *      topic1: { value: string };
 *      topic2: { value: number };
 *  }
 *  const eventbus: Publisher<YourMessageMap> = new EventBus<YourMessageMap>();
 */
interface Publisher<M extends object> {
    publish<T extends keyof M>(message: Message<M, T>, onError?: OnError<M>): void;
}

/**
 * EventBusに対して購読のみを許可するためのインターフェース
 * @example 
 *  interface YourMessageMap {
 *      topic1: { value: string };
 *      topic2: { value: number };
 *  }
 *  const eventbus: Subscriber<YourMessageMap> = new EventBus<YourMessageMap>();
 */
interface Subscriber<M extends object> {
    /** トピックに対するリスナーを購読する */
    subscribe<T extends keyof M>(topic: T, listener: Listener<M, T>): UnSubscriber;
}

export type {
    Message,
    Listener,
    UnSubscriber,
    OnError,
    Publisher,
    Subscriber,
};
