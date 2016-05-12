import isInstance = require('./isInstance');
import typeOf = require('./typeOf');
import {RuntimeError} from '../base/errors';

export class AssertionError extends RuntimeError {
}

export interface PropertyDeclaration {
    name: string;
    type: any;
}

export function assert(value: boolean, message: string = 'Assertion failed') {
    if (!value) {
        throw new AssertionError(message);
    }
}

export function assertHas(object: Object,
                          properties: (PropertyDeclaration|string)[])
{
    if (object === undefined) {
        throw new AssertionError('object is undefined');
    }
    for (let _property of properties) {
        let property: PropertyDeclaration;
        if (typeof _property == 'string') {
            property = {
                name: <string>_property,
                type: null,
            }
        } else {
            property = <PropertyDeclaration>_property;
        }

        const value: any = ko.unwrap(object[property.name]);
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

export function assertInstance(value: any, type: any) {
    if (!isInstance(value, type)) {
        throw new AssertionError('Value has' +
            ' type "' + typeOf(value).name + '" but should be instance of' +
            ' "' + type.name + '"');
    }
}

export function assertDefined(value: any) {
    if (value === undefined) {
        throw new AssertionError('Value is undefined');
    }
}