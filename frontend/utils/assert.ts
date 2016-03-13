///<reference path="isInstance.ts"/>
function AssertionError(message) {
    this.name = 'AssertionError';
    this.message = message;
    this.stack = (<any>new Error()).stack;
}
AssertionError.prototype = new Error();

interface PropertyDeclaration {
    name: string;
    type: typeof String | typeof Object | typeof Number | typeof Boolean;
}

function assertHas(object: Object, properties: (PropertyDeclaration|string)[]) {
    if (object === undefined) {
        throw new AssertionError('object is undefined');
    }
    for (const _property of properties) {
        let property: PropertyDeclaration;
        if (typeof _property == 'string') {
            property = {
                name: <string>_property,
                type: null,
            }
        } else {
            property = <PropertyDeclaration>_property;
        }

        const value: any = object[property.name];
        if (value === undefined) {
            throw new AssertionError('Missing property "' + property.name +
                    '" in object.');
        }
        if (property.type !== null && !isInstance(value, property.type)) {
            const type = (typeof value != 'object' ?
                typeof value :
                value.constructor.name);

            throw new AssertionError('Property "' + property.name + '" has' +
                ' type "' + type + '"')
        }
    }
}