/** Compares two numbers approximately. */
export function floatEquals(a: number, b: number) {
    return Math.abs(a - b) < 0.0001;
}