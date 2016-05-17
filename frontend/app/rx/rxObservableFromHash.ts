function removeLeadingHashtag(hash: string) {
    // Remove the leading #
    if (hash.startsWith('#')) {
        return hash.slice(1);
    } else {
        return hash;
    }
}

export function getCurrentHash() {
    return removeLeadingHashtag(location.hash);
}

export function rxObservableFromHash(): Rx.Observable<string> {
    return Rx.DOM.fromEvent(window, 'hashchange')
        .map(() => location.hash)
        .startWith(location.hash)
        .map(removeLeadingHashtag)
}