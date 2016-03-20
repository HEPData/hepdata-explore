/** Checks types in JavaScript, both class and primitive. */
function isInstance(object: any, classType: any) {
    if (typeof object == 'object') {
        // Object instance of class
        return object instanceof classType;
    } else {
        // Value instance of primitive type
        // classType is e.g. Number
        const typeName = classType.name.toLowerCase();
        return typeof object == typeName;
    }
}
export = isInstance;