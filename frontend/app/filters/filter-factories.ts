import ChoiceFilter = require("./ChoiceFilter");
import Filter = require("./Filter");

export class DepVarFilter extends ChoiceFilter {
    constructor(value: string) {
        super('dep_vars.name', value);
    }

    static getLongName() {
        return 'Dependent variable'
    }
}

export class IndepVarFilter extends ChoiceFilter {
    constructor(value: string = '') {
        super('indep_vars.name', value);
    }

    static getLongName() {
        return 'Independent variable'
    }
}