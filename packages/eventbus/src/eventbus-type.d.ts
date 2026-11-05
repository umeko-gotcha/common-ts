
/**
 * pubsubに登録するトピックの型を定義する\
 * topicMapに追加できるものは、Topicのキーとそのキーを持つMessage型\
 * 以下の場合だと、Topicは "test" であり、Messageは { topic: "test", data: { value: string } } となる
 * @example interface TopicMap {
 * "test": { value: string }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TopicMap {}

type Topic = keyof TopicMap;

/**
 * トピック：データ ＝ 1:1で管理されるアプリメッセージ\
 * イベントの発行者（Message型のデータ生成）と、\
 * イベントの購読者（topicとMessage型のデータを受け取って処理する関数）を\
 * 繋ぐデータ型。TopicMapを指定のデータで拡張することで静的に実行される。
 */
type Message<T extends Topic> = {
    /** イベントマップに登録されるイベントキー */
    topic: T;
    /** イベントキーに対応する任意のデータ型 */
    data: TopicMap[T];
};

/** 
 * 指定のキーに対応するメッセージを受け取って処理するイベントハンドラー
 * @param message 購読したいトピックに対応したメッセージメッセージ型
 */
type Listener<T extends Topic> = (message: Message<T>) => void | Promise<void>;

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
type OnError = (
    message: Message<Topic>,
    listener: Listener<Topic>,
    error: unknown,
) => void;

/**
 * EventBusに対して発行のみを許可するためのインターフェース
 * @example 
 *  const eventbus: Publisher = new EventBus();
 */
interface Publisher {
    publish<T extends Topic>(message: Message<T>): void;
}

/**
 * EventBusに対して購読のみを許可するためのインターフェース
 * @example 
 *  const eventbus: Subscriber = new EventBus();
 */
interface Subscriber {
    subscribe<T extends Topic>(topic: T, listener: Listener<T>): UnSubscriber;
}

export type {
    TopicMap,
    Topic,
    Message,
    Listener,
    UnSubscriber,
    OnError,
    Publisher,
    Subscriber,
};
