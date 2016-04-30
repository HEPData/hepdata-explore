export class RuntimeError extends Error {
    stack: string;

    constructor(message: string) {
        super();
        this.name = this.constructor.name;
        this.message = message;
        this.stack = (<any>new Error()).stack;
        debugger;
    }
}