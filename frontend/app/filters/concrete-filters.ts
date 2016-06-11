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
export class ObservableFilter extends ChoiceFilter {
    constructor(value: string = '') {
        super('observables', value);
    }

    static getLongName() {
        return 'Observable'
    }
}

@registerFilterClass
export class PhraseFilter extends ChoiceFilter {
    constructor(value: string = '') {
        super('phrases', value);
    }

    static getLongName() {
        return 'Phrase'
    }
}

@registerFilterClass
export class CollaborationFilter extends ChoiceFilter {
    constructor(value: string = '') {
        super('collaborations', value);
    }

    static getLongName() {
        return 'Collaboration'
    }
}

@registerFilterClass
export class ReactionFilter extends ChoiceFilter {
    constructor(value: string = '') {
        // See bug below
        // super('reactions.string_full', value);

        // Use denormalized property as a workaround
        super('reactions_full', value);
    }

    static getLongName() {
        return 'Reaction'
    }

    filterTable(table: PublicationTable): boolean {
        return _.find(table.reactions, (r) => r.string_full == this.value) != null;
    }

    /* Because of this bug, we cannot use nested queries in filters, since they
     * break filtered aggregations, which we need in ChoiceFilterComponent to
     * show the count of tables per value.
     *
     * https://github.com/elastic/elasticsearch/issues/11749
     */
    /*
    toElasticQuery(): any {
        return {
            "nested": {
                "path": "tables.reactions",
                "query": {
                    "match": {
                        ["tables." + this.field]: this.value,
                    }
                }
            }
        }
    }
    */
}