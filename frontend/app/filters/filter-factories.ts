import ChoiceFilter = require("./ChoiceFilter");
import {PublicationTable} from "../base/dataFormat";
import {registerFilterClass} from "./filterRegistry";

@registerFilterClass
export class DepVarFilter extends ChoiceFilter {
    constructor(value: string = '') {
        super('dep_vars.name', value);
    }

    static getLongName() {
        return 'Dependent variable'
    }

    filterTable(table: PublicationTable): boolean {
        return table.dep_vars.map((v) => v.name).indexOf(this.value) != -1;
    }
}

@registerFilterClass
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

@registerFilterClass
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