export class HTTPError extends Error {
    code: number;

    constructor(code: number, message: string) {
        super(message);
        this.code = code;
    }
}

Promise.config({
    cancellation: true,
});

export function asyncFetch(xhr: XMLHttpRequest, data = null): Promise<void> {
    return new Promise<void>(function (resolve, reject, onCancel) {
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new HTTPError(xhr.status, xhr.statusText));
            }
        };
        xhr.onerror = reject;
        xhr.send(data);

        onCancel(function () {
            xhr.abort();
        })
    });
}

export function jsonPOST(url: string, data: {}): Promise<any> {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/json');
    return asyncFetch(xhr, JSON.stringify(data))
        .then(() => {
            return JSON.parse(xhr.responseText);
        })
}

export function jsonGET(url: string): Promise<any> {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    return asyncFetch(xhr)
        .then(() => {
            return JSON.parse(xhr.responseText);
        })
}

export function plainPUT(url: string, data: string): Promise<void> {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    return asyncFetch(xhr, data);
}