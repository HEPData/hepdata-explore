declare namespace Rx {
    export interface Observable<T> {
        chain<T2>(destFn: (source: Observable<T>) => T2): T2;
    }
}

Rx.Observable.prototype.chain = function chain<T,T2>(
    destFn: (source: Rx.Observable<T>) => T2): T2
{
    const source = <Rx.Observable<T>>this;
    return destFn(source);
};