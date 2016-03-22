import ChoiceFilter = require("../filters/ChoiceFilter");
import {elastic} from "../services/Elastic";
import {AutocompleteService} from "../services/AutocompleteService";

interface ChoiceSuggestion {
    suggestedValue: string;
    freqDividedByModeFullDB: number;
    absoluteFrequencyFullDB: number;
}

const variableSeparator = /\W+/;
function variableTokenizer(obj: any) {
    if (!arguments.length || obj == null || obj == undefined) {
        return [];
    } 
    if (Array.isArray(obj)) {
        return obj.map(t => lunr.utils.asString(t).toLowerCase())
    }

    return obj.toString().trim().toLowerCase().split(variableSeparator)
}
lunr.tokenizer.registerFunction(variableTokenizer, 'variableTokenizer');

class ChoiceFilterComponent {
    filter: ChoiceFilter;
    autocomplete: AutocompleteService<ChoiceSuggestion>;

    valueTyped: string = '';
    allPossibleValuesPromise: Promise<ChoiceSuggestion[]>;
    possibleValuesIndex: lunr.Index;

    constructor(params: any) {
        this.filter = params.filter;
        ko.track(this, ['filter', 'valueTyped']);

        this.possibleValuesIndex = lunr(function() {
            this.field('value');
            this.ref('index');
            this.tokenizer(variableTokenizer);
        });
        this.possibleValuesIndex.pipeline.remove(lunr.stopWordFilter);

        this.allPossibleValuesPromise = this.getAllPossibleValues()
            .then((values) => {
                values.forEach((value, index) => {
                    this.possibleValuesIndex.add({
                        'value': value.suggestedValue,
                        'index': index,
                    });
                });
                return values;
            });

        this.autocomplete = new AutocompleteService<ChoiceSuggestion>({
            koQuery: ko.getObservable(this, 'valueTyped'),
            searchFn: this.search.bind(this),
            rankingFn: (s: ChoiceSuggestion) => s.absoluteFrequencyFullDB,
            keyFn: (s: ChoiceSuggestion) => s.suggestedValue,
            maxSuggestions: 20,
            suggestionClickedFn: this.useSuggestion.bind(this),
        });
    }

    search(query: string): Promise<ChoiceSuggestion[]> {
        return this.allPossibleValuesPromise
            .then((allPossibleValues) => {
                if (query != '') {
                    return this.possibleValuesIndex.search(query)
                        .map((result) => allPossibleValues[result.ref]);
                } else {
                    return allPossibleValues;
                }
            })
    }

    getAllPossibleValues(): Promise<ChoiceSuggestion[]> {
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

    useSelectedValue() {
        const selection = this.autocomplete.getSelectedSuggestion();
        if (selection) {
            this.useSuggestion(selection);
        }
    }

    useSuggestion(suggestion: ChoiceSuggestion) {
        console.log(arguments);
        this.filter.value = suggestion.suggestedValue;
        this.valueTyped = suggestion.suggestedValue;
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