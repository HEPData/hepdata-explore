// Note: you can't use .map(Rx.Observable.fromPromise) because it would receive
// more than one argument, which is not what you want.
// Use this function instead.
export function rxObservableFromPromise<T>(p: Promise<T>) {
    return Rx.Observable.fromPromise(p);
}