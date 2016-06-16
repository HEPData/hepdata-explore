// http://stackoverflow.com/a/34842797/1777162
// Modified to always return positive values.
export function hashString(str: string) {
    return Math.abs(str.split('').reduce((prevHash, currVal) =>
        ((prevHash << 5) - prevHash) + currVal.charCodeAt(0), 0));
}