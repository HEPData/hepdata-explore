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

    let loadingStatus = false;
    loadingHandler(loadingStatus);

    return Rx.Observable.create<Observable<T>>((subscriber) => {
        return source.subscribe(
            (request) => {
                const requestNumber = ++latestRequestNumber;
                if (loadingStatus == false) {
                    loadingStatus = true;
                    loadingHandler(loadingStatus);
                }

                subscriber.onNext(Rx.Observable.create<T>(nestedSubscriber => {
                    return request.subscribe(
                        (value) => nestedSubscriber.onNext(value),
                        (err) => nestedSubscriber.onError(err),
                        () => {
                            const newLoadingStatus = latestRequestNumber > requestNumber;
                            if (newLoadingStatus != loadingStatus) {
                                loadingStatus = newLoadingStatus;
                                loadingHandler(loadingStatus);
                            }
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