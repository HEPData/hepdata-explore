import noop = Rx.helpers.noop;
import Observable = Rx.Observable;

declare namespace Rx {
    export interface Observable<T> {
        setLoading(loadingHandler: (loading: boolean) => void): Observable<T>;
    }
}

function setLoading<T>(
    source: Rx.Observable<Rx.Observable<T>>,
    loadingHandler: (loading: boolean) => void
) : Rx.Observable<Rx.Observable<T>>
{
    let latestRequestNumber = 0;

    const loadingStatus$ = new Rx.ReplaySubject<boolean>();
    loadingStatus$.onNext(false);

    loadingStatus$
        .distinctUntilChanged()
        .subscribe(loadingHandler);

    return Rx.Observable.create<Observable<T>>((subscriber) => {
        return source.subscribe(
            (request) => {
                const requestNumber = ++latestRequestNumber;
                loadingStatus$.onNext(true);

                subscriber.onNext(Rx.Observable.create<T>(nestedSubscriber => {
                    return request.subscribe(
                        (value) => nestedSubscriber.onNext(value),
                        (err) => nestedSubscriber.onError(err),
                        () => {
                            loadingStatus$.onNext(latestRequestNumber > requestNumber);
                            nestedSubscriber.onCompleted();
                        }
                    )
                }));
            },
            (err) => subscriber.onError(err),
            () => subscriber.onCompleted()
        )
    })
}
Rx.Observable.prototype.setLoading = function(loadingHandler: (loading: boolean) => void) {
    return setLoading(this, loadingHandler);
};