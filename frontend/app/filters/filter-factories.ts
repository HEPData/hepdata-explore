import ChoiceFilter = require("./ChoiceFilter");
import Filter = require("./Filter");

export class DepVarFilter extends ChoiceFilter {
    constructor(value: string) {
        super('y_var', value);
    }

    static getLongName() {
        return 'Dependent variable'
    }
}

export class IndepVarFilter extends ChoiceFilter {
    constructor(value: string = '') {
        super('x_var', value);
    }

    static getLongName() {
        return 'Independent variable'
    }
}



function a(arg:typeof Filter) {}
a(ChoiceFilter);