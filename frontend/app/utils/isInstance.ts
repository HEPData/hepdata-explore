/** Checks types in JavaScript, both class and primitive. */
function isInstance(object: any, classType: any) {
    if (typeof object != classType) {
        return false;
    }
    if (typeof object == 'object') {
        return object instanceof classType;
    }
}
export = isInstance;