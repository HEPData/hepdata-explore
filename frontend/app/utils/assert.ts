import isInstance = require('./isInstance');
import typeOf = require('./typeOf');

export function AssertionError(message) {
    this.name = 'AssertionError';
    this.message = message;
    this.stack = (<any>new Error()).stack;
}
AssertionError.prototype = new Error();

export interface PropertyDeclaration {
    name: string;
    type: any;
}

export function assertHas(object: Object,
                          properties: (PropertyDeclaration|string)[])
{
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
            throw new AssertionError('Property "' + property.name + '" has' +
                ' type "' + typeOf(value).name + '" but should be instance of' +
                ' "' + (<any>property.type).name) + '"';
        }
    }
}