/** 
 * 実行時に自身の依存関係をなくす関数\
 * createEffectの戻り値として得られ、実行すると以降作成したEffectは以降全ての依存関係から解除される。\
 * そのため、一度実行すると二度とそのEffectは実行されなくなり、メモリから解放される。\
 * 複数回Disposeを実行してもエラーにはならない。
 */
type Dispose = () => void;



export type { Dispose };
