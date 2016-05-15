/* Lunr variable tokenizer */
const variableSeparator = /\W+/;
export function variableTokenizer(obj: any) {
    if (!arguments.length || obj == null || obj == undefined) {
        return [];
    }
    if (Array.isArray(obj)) {
        return obj.map(t => lunr.utils.asString(t).toLowerCase())
    }

    return obj.toString().trim().toLowerCase().split(variableSeparator)
}
lunr.tokenizer.registerFunction(variableTokenizer, 'variableTokenizer');