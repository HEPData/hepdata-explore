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
import {FilterDump} from "../filters/Filter";
import {rxObservableFromPromise} from "../rx/rxObservableFromPromise";
import {enumerate} from "../utils/functools";
import {
    registerFilterComponent,
    unregisterFilterComponent
} from "../base/getFilterComponent";
import IDisposable = Rx.IDisposable;

interface ChoiceSuggestion {
    suggestedValue: string;
    /** Number of tables having the suggested value */
    absoluteFrequencyFullDB: number;
    /** Number of tables having the suggested value / total of tables retrieved */
    freqDividedByModeFullDB: number;
}

/**
 * A class having enough data to perform autocompletion searches.
 * 
 * It contains a list of all possible suggestions and a lunr index created from
 * them.
 */
interface ChoiceIndex {
    allSuggestions: ChoiceSuggestion[];
    lunrIndex: lunr.Index;
}

@KnockoutComponent('choice-filter', {
    template: { fromUrl: 'choice-filter.html' },
})
class ChoiceFilterComponent {
    @observable()
    filter: ChoiceFilter;
    autocomplete: AutocompleteService<ChoiceSuggestion, ChoiceIndex>;

    @observable()
    valueTyped: string = '';
    // allPossibleValuesPromise: Promise<ChoiceSuggestion[]>;
    // possibleValuesIndex: lunr.Index;

    /** This observable property is used by the template to focus the text box
     * when the component is created.
     */
    @observable()
    focused = true;

    _disposables: IDisposable[] = [];

    constructor(params: any) {
        this.filter = params.filter;
        this.valueTyped = this.filter.value;

        registerFilterComponent(this.filter, this);

        // Start with an empty index
        // this.possibleValuesIndex = this.indexFromSuggestions([]);

        const suggestions$ = app.filterInteractiveUpdates$
            // The application starts without interactive updates, so just in
            // the application has just started, we load the current rootFilter
            // as first value
            .startWith(app.rootFilter)
            // Ignore null root filter state
            .filter(rootFilter => rootFilter != null)
            .map(rootFilter => rootFilter!)
            // Don't continue if our filter is not in the root filter tree
            // (i.e. it was just removed)
            .filter(rootFilter => rootFilter.findFilter(this.filter))
            // Calculate the complementary filter
            .map(rootFilter =>
                calculateComplementaryFilter(this.filter, ensure(rootFilter)))
            // Only continue if the complementary filter has changed
            .distinctUntilChanged(complementaryFilter =>
                stableStringify(complementaryFilter.dump()))
            .do((complement)=> {
                console.log(JSON.stringify(app.rootFilter!.dump(), null!, 2));
            })
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
                const greatestBucket = _.maxBy(buckets, b => b.count);
                const maxCount = greatestBucket ? greatestBucket.count : 0;
                return buckets.map((bucket) => ({
                    suggestedValue: bucket.name,
                    freqDividedByModeFullDB: bucket.count / maxCount,
                    absoluteFrequencyFullDB: bucket.count,
                }));
            })
            .map(this.indexFromSuggestions);

        this.autocomplete = new AutocompleteService<ChoiceSuggestion, ChoiceIndex>({
            koQuery: ko.getObservable(this, 'valueTyped'),
            suggestionsIndexStream: suggestions$,
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
    indexFromSuggestions(suggestions: ChoiceSuggestion[]): ChoiceIndex {
        console.log('Creating index on ' + this.filter.field);
        // There is no way to clear an index in lunr, so we just create a new
        // one from scratch
        const lunrIndex = lunr(function() {
            this.field('value');
            this.ref('ref');
            this.tokenizer(variableTokenizer);
        });
        lunrIndex.pipeline.remove(lunr.stopWordFilter);

        for (let [ref, suggestion] of enumerate(suggestions)) {
            lunrIndex.add({
                'value': suggestion.suggestedValue,
                'ref': ref,
            });
        }

        return {
            allSuggestions: suggestions,
            lunrIndex: lunrIndex,
        };
    }

    @bind()
    search(query: string, index: ChoiceIndex): ChoiceSuggestion[] {
        console.log('Searching suggestions on ' + this.filter.field);
        if (query != '') {
            return index.lunrIndex
                .search(query)
                .map((result) => index.allSuggestions[result.ref]);
        } else {
            return index.allSuggestions;
        }
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
        this.autocomplete.dispose();
        ko.untrack(this);
        for (let disposable of this._disposables) {
            disposable.dispose();
        }
        unregisterFilterComponent(this.filter);
    }
}