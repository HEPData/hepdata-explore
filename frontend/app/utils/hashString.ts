// http://stackoverflow.com/a/34842797/1777162
export function hashString(str: string) {
    return str.split('').reduce((prevHash, currVal) =>
        ((prevHash << 5) - prevHash) + currVal.charCodeAt(0), 0);
}