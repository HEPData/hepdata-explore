import ChoiceFilter = require("./ChoiceFilter");
import Filter = require("./Filter");
import {PublicationTable} from "../base/dataFormat";

export class DepVarFilter extends ChoiceFilter {
    constructor(value: string) {
        super('dep_vars.name', value);
    }

    static getLongName() {
        return 'Dependent variable'
    }

    filterTable(table: PublicationTable): boolean {
        return table.dep_vars.map((v) => v.name).indexOf(this.value) != -1;
    }
}

export class IndepVarFilter extends ChoiceFilter {
    constructor(value: string = '') {
        super('indep_vars.name', value);
    }

    static getLongName() {
        return 'Independent variable'
    }

    filterTable(table: PublicationTable): boolean {
        return table.indep_vars.map((v) => v.name).indexOf(this.value) != -1;
    }
}

export class ReactionFilter extends ChoiceFilter {
    constructor(value: string = '') {
        super('reactions', value);
    }

    static getLongName() {
        return 'Reaction'
    }

    filterTable(table: PublicationTable): boolean {
        return table.reactions.indexOf(this.value) != -1;
    }
}