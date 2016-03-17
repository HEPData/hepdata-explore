import ChoiceFilter = require("../filters/ChoiceFilter");
import {elastic} from "../services/Elastic";

interface Suggestion {
    suggestedValue: string;
    relativeFrequencyFullDB: number;
    absoluteFrequencyFullDB: number;
}

class ChoiceFilterComponent {
    filter: ChoiceFilter;

    valueTyped: string;
    suggestions: Suggestion[] = [];

    getAllPossibleValues(): Promise<Suggestion[]> {
        return elastic.fetchAllIndepVars()
            .then((buckets) => {
                const totalRecords = _.sum(_.map(buckets, b => b.count));
                return buckets.map((bucket) => ({
                    suggestedValue: bucket.name,
                    relativeFrequencyFullDB: bucket.count / totalRecords,
                    absoluteFrequencyFullDB: bucket.count,
                }));
            });
    }

    constructor(params: any) {
        this.filter = params.filter;
        ko.track(this);

        this.getAllPossibleValues()
            .then((values) => {
                this.suggestions = values;
                console.log(values);
            });
    }
}

ko.components.register('choice-filter', {
    viewModel: ChoiceFilterComponent,
    template: { fromUrl: 'choice-filter.html' },
});

export = ChoiceFilterComponent;