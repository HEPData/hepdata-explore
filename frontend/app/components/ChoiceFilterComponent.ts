import ChoiceFilter = require("../filters/ChoiceFilter");
import {elastic} from "../services/Elastic";

interface Suggestion {
    suggestedValue: string;
    freqDividedByModeFullDB: number;
    absoluteFrequencyFullDB: number;
}

class ChoiceFilterComponent {
    filter: ChoiceFilter;

    valueTyped: string;
    suggestions: Suggestion[] = [];

    getAllPossibleValues(): Promise<Suggestion[]> {
        return elastic.fetchAllIndepVars()
            .then((buckets) => {
                const maxCount = _.maxBy(buckets, b => b.count).count;
                return buckets.map((bucket) => ({
                    suggestedValue: bucket.name,
                    freqDividedByModeFullDB: bucket.count / maxCount,
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