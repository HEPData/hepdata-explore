declare namespace Rx {
    export interface Observable<T> {
        zipFlatMap<T,T2>(transformFn: (source: T) => Observable<T2>): Rx.Observable<[T, T2]>;
    }
}

Rx.Observable.prototype.zipFlapMap = function zipFlatMap<T,T2>(
    transformFn: (source: T) => Observable<T2>): Rx.Observable<[T, T2]>
{
    const source = <Rx.Observable<T>>this;
    return source
        .flatMap((oldValue: T) => {
            const newValues$ = transformFn(oldValue);
            return newValues$
                .map((newValue) => (<[T,T2]>[oldValue, newValue]));
        })
};

// console.log(Rx.Observable.prototype.zipFlapMap);