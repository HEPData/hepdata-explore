export interface Suggestion<T> {
}

export interface SuggestionEquals<T> {
    (a: Suggestion<T>, b: Suggestion<T>): boolean;
}

export class AutocompleteService<T> {
    constructor(
        public koQuery: KnockoutObservable<string>,
        public searchFn: (query: string) => Suggestion<T>[],
        public suggestionEqualsFn: SuggestionEquals<T>
    ) {

    }

    suggestions: Suggestion<T>[];
    suggestionsSelectedIndex = 0;

    search(query: string) {
        // Execute the domain specific search function
        const results = this.searchFn(query);

        // TODO: improve this by not clearing the entire array
        this.suggestions.splice.apply(
            this.suggestions, (<any[]>[this.suggestions.length]).concat(results));
    }
}