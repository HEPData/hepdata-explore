import {range} from "../utils/map";
import {assert} from "../utils/assert";
declare var jsSHA: any;

const urlChars = '123456789abcdefghkmnpqrstuvwxyzABCDEFGHKMNPQRSTUVWXYZ';
const lengthUrlString = 5;
const urlNumberModulo = Math.pow(urlChars.length, lengthUrlString);

const arrayBuffer = new ArrayBuffer(4);
const dataView = new DataView(arrayBuffer);

function hashToUrlNumber(bytes: string) {
    const suffixString = bytes.slice(bytes.length - 4);
    // Cast the string as a 32 bit integer big endian
    for (let i of range(4)) {
        dataView.setUint8(i, suffixString.charCodeAt(i));
    }
    const suffixNumber = dataView.getUint32(0, false);

    // Return the modulo
    return suffixNumber % urlNumberModulo;
}

function numberToUrlString(number: number) {
    assert(number < urlNumberModulo);
    let output = '';
    for (let i of range(lengthUrlString)) {
        output = urlChars[number % urlChars.length] + output;
        number = (number / urlChars.length) >> 0;
    }
    return output;
}

function hashString(input: string): string {
    const sha = new jsSHA('SHA-224', 'TEXT', 'UTF8');
    sha.update(input);
    const rawHash = sha.getHash('BYTES');
    return rawHash;
}

export function customUrlHash(input: string) {
    return numberToUrlString(hashToUrlNumber(hashString(input)));
}