declare var jsSHA: any;

export class StateStorage {
    static calcHashOfString(input: string) {
        const sha = new jsSHA('SHA-224', 'TEXT');
        sha.update(input);
        return sha.getHash('BYTES');
    }
}