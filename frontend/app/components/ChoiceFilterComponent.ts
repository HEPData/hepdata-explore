import ChoiceFilter = require("../filters/ChoiceFilter");
import {elastic} from "../services/Elastic";
import {AutocompleteService} from "../services/AutocompleteService";

interface ChoiceSuggestion {
    suggestedValue: string;
    freqDividedByModeFullDB: number;
    absoluteFrequencyFullDB: number;
}

class ChoiceFilterComponent {
    filter: ChoiceFilter;
    autocomplete: AutocompleteService<ChoiceSuggestion>;

    valueTyped: string = '';
    // suggestions: ChoiceSuggestion[] = [];

    constructor(params: any) {
        this.filter = params.filter;
        ko.track(this);

        this.autocomplete = new AutocompleteService(
            ko.getObservable(this, 'valueTyped'),
            (query: string) => {
                return this.getAllPossibleValues();
            }
        );
    }

    getAllPossibleValues(): Promise<ChoiceSuggestion[]> {
        return elastic.fetchAllIndepVars()
            .then((buckets) => {
                console.log('Fetched indep vars');
                const maxCount = _.maxBy(buckets, b => b.count).count;
                return buckets.map((bucket) => ({
                    suggestedValue: bucket.name,
                    freqDividedByModeFullDB: bucket.count / maxCount,
                    absoluteFrequencyFullDB: bucket.count,
                }));
            });
    }

    useSelectedValue() {
        
    }

    dispose() {
        ko.untrack(this);
    }
}

ko.components.register('choice-filter', {
    viewModel: ChoiceFilterComponent,
    template: { fromUrl: 'choice-filter.html' },
});

export = ChoiceFilterComponent;