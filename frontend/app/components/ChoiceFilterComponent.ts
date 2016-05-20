import ChoiceFilter = require("../filters/ChoiceFilter");
import {elastic} from "../services/Elastic";
import {AutocompleteService} from "../services/AutocompleteService";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {app} from "../AppViewModel";
import {calculateComplementaryFilter} from "../utils/complementaryFilter";
import {bind} from "../decorators/bind";
import {observable} from "../decorators/observable";
import {variableTokenizer} from "../utils/variableTokenizer";
import {ensure} from "../utils/assert";

interface ChoiceSuggestion {
    suggestedValue: string;
    freqDividedByModeFullDB: number;
    absoluteFrequencyFullDB: number;
}

@KnockoutComponent('choice-filter', {
    template: { fromUrl: 'choice-filter.html' },
})
class ChoiceFilterComponent {
    @observable()
    filter: ChoiceFilter;
    autocomplete: AutocompleteService<ChoiceSuggestion>;

    @observable()
    valueTyped: string = '';
    allPossibleValuesPromise: Promise<ChoiceSuggestion[]>;
    possibleValuesIndex: lunr.Index;

    /** This observable property is used by the template to focus the text box
     * when the component is created.
     */
    @observable()
    focused = true;

    constructor(params: any) {
        this.filter = params.filter;
        this.valueTyped = this.filter.value;

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
            searchFn: this.search,
            rankingFn: (s: ChoiceSuggestion) => s.absoluteFrequencyFullDB,
            keyFn: (s: ChoiceSuggestion) => s.suggestedValue,
            maxSuggestions: 5,
            suggestionClickedFn: this.useSuggestion,
        });
    }

    @bind()
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
        const complementaryFilter = calculateComplementaryFilter(this.filter,
            ensure(app.rootFilter));
        return elastic.fetchCountByField(this.filter.field, complementaryFilter)
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

    @bind()
    useSuggestion(suggestion: ChoiceSuggestion) {
        this.filter.value = suggestion.suggestedValue;
        this.valueTyped = suggestion.suggestedValue;
    }

    dispose() {
        ko.untrack(this);
    }
}