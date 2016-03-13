function typeOf(value: any) {
    return (typeof value != 'object' ?
        typeof value :
        value.constructor);
}
export = typeOf;