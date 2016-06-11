import ChoiceFilter = require("../filters/ChoiceFilter");
import {elastic, CountAggregationBucket} from "../services/Elastic";
import {AutocompleteService} from "../services/AutocompleteService";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {app} from "../AppViewModel";
import {calculateComplementaryFilter} from "../utils/complementaryFilter";
import {bind} from "../decorators/bind";
import {observable} from "../decorators/observable";
import {variableTokenizer} from "../utils/variableTokenizer";
import {ensure} from "../utils/assert";
import IDisposable = Rx.IDisposable;
import {FilterDump} from "../filters/Filter";
import {rxObservableFromPromise} from "../rx/rxObservableFromPromise";
import {enumerate} from "../utils/map";

interface ChoiceSuggestion {
    suggestedValue: string;
    /** Number of tables having the suggested value */
    absoluteFrequencyFullDB: number;
    /** Number of tables having the suggested value / total of tables retrieved */
    freqDividedByModeFullDB: number;
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

    _disposables: IDisposable[] = [];

    constructor(params: any) {
        this.filter = params.filter;
        this.valueTyped = this.filter.value;

        // Start with an empty index
        this.possibleValuesIndex = this.indexFromSuggestions([]);

        const suggestions$ = (<KnockoutObservable<FilterDump|null>>
            ko.getObservable(app, 'filterDump'))
            .toObservableWithReplyLatest()
            // Ignore null root filter state
            .filter(filterDump => filterDump != null)
            // Don't continue if our filter is not in the root filter tree 
            // (i.e. it was just removed)
            .filter(() => app.rootFilter!.findFilter(this.filter))
            // Calculate the complementary filter
            .map(() => calculateComplementaryFilter(this.filter, ensure(app.rootFilter)))
            // It should never be null since there should always be a root
            // compound filter... but just in case filter out the potential
            // cases where there is not.
            .filter(complementaryFilter => complementaryFilter != null)
            .map(it => it!)
            // Only continue if the complementary filter has changed
            .distinctUntilChanged(complementaryFilter =>
                stableStringify(complementaryFilter.dump()))
            .do(()=>{console.log('Querying complementary filter');})
            // Launch the query
            .map(complementaryFilter =>
                elastic.fetchCountByField(this.filter.field, complementaryFilter))
            .map(rxObservableFromPromise)
            // Ignore errors, only showing a warning for developers.
            //
            // The rest of the interface will continue working but the
            // suggestions will be outdated until the complementary filter is
            // changed.
            //
            // Usually, if this search fails, other will also probably fail
            // showing a more prominent error.
            .map(obs =>
                obs.catch((err: any) => {
                    console.warn('Error querying ElasticSearch inside a ChoiceFilterComponent:');
                    console.warn(err);
                    return Rx.Observable.empty<CountAggregationBucket[]>();
                }))
            .switch()
            .map((buckets: CountAggregationBucket[]): ChoiceSuggestion[] => {
                const maxCount = _.maxBy(buckets, b => b.count).count;
                return buckets.map((bucket) => ({
                    suggestedValue: bucket.name,
                    freqDividedByModeFullDB: bucket.count / maxCount,
                    absoluteFrequencyFullDB: bucket.count,
                }));
            })
            .shareReplay(1);

        this.allPossibleValuesPromise = suggestions$
            .take(1)
            .toPromise(Promise);

        this._disposables.push(
            suggestions$
            .forEach((suggestions) => {
                console.log(suggestions[0]);
                this.possibleValuesIndex = this.indexFromSuggestions(suggestions);
                this.autocomplete.updateSearchResults();
            })
        );

        this.autocomplete = new AutocompleteService<ChoiceSuggestion>({
            koQuery: ko.getObservable(this, 'valueTyped'),
            searchFn: this.search,
            rankingFn: (s: ChoiceSuggestion) => -s.absoluteFrequencyFullDB,
            keyFn: (s: ChoiceSuggestion) => s.suggestedValue,
            maxSuggestions: 5,
            suggestionAcceptedFn: this.useSuggestion,
            acceptWithTabKey: true,
            nonUniformPaging: false,
        });
    }

    @bind()
    indexFromSuggestions(suggestions: ChoiceSuggestion[]) {
        // There is no way to clear an index in lunr, so we just create a new
        // one from scratch
        const possibleValuesIndex = lunr(function() {
            this.field('value');
            this.ref('index');
            this.tokenizer(variableTokenizer);
        });
        possibleValuesIndex.pipeline.remove(lunr.stopWordFilter);

        for (let [index, suggestion] of enumerate(suggestions)) {
            possibleValuesIndex.add({
                'value': suggestion.suggestedValue,
                'index': index,
            });
        }

        return possibleValuesIndex;
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
        for (let disposable of this._disposables) {
            disposable.dispose();
        }
    }
}