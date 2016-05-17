import noop = Rx.helpers.noop;

declare namespace Rx {
    export interface Observable<T> {
        setLoading(loadingHandler: (loading: boolean) => void): Observable<T>;
    }
}

Rx.Observable.prototype.setLoading = function setLoading<T>(loadingHandler: (loading: boolean) => void) {
    const source$ = <Rx.Observable<Rx.Observable<T>>>this;

    const loadingStatus$ = new Rx.Subject<boolean>();
    loadingStatus$.onNext(false);

    let latestRequestNumber = 0;
    let observableToRequestNumber = new WeakMap<Rx.Observable<T>,number>();

    source$.subscribe(function onNext(request: Rx.Observable<T>) {
        // A request have been sent
        const requestNumber = ++latestRequestNumber;
        observableToRequestNumber.set(request, requestNumber);
        loadingStatus$.onNext(true);

        function onCompletedOrError() {
            loadingStatus$.onNext(latestRequestNumber > requestNumber);
        }
        request.subscribe(noop, onCompletedOrError, onCompletedOrError);
    }, Rx.helpers.defaultError, function onCompleted() {
        loadingStatus$.onCompleted();
    });

    loadingStatus$
        .distinctUntilChanged()
        .forEach(loadingHandler);

    return source$;
};