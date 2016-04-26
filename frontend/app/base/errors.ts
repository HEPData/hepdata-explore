export function RuntimeError(message) {
    this.name = 'RuntimeError';
    this.message = message;
    this.stack = (<any>new Error()).stack;
}
RuntimeError.prototype = new Error();