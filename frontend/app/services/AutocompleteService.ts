import {assertInstance, assertDefined} from "../utils/assert";
const KEY_ARROW_DOWN = 40;
const KEY_ARROW_UP = 38;
const KEY_TAB = 9;

/** Simple integer modulo for JavaScript so that
 *   mod(8, 8) = 0
 *  and
 *   mod(-1, 8) = 7
 */
function mod(dividend: number, divisor: number) {
    while (dividend < 0) {
        dividend += divisor;
    }
    return dividend % divisor;
}

interface AutocompleteOptions<SuggestionType> {
    koQuery: KnockoutObservable<string>;
    searchFn: (query: string) => Promise<SuggestionType[]>;
    rankingFn: (suggestion: SuggestionType) => number;
    keyFn: (suggestion: SuggestionType) => any;
    suggestionClickedFn: (suggestion: SuggestionType) => void;
    maxSuggestions: number;
}

export class AutocompleteService<SuggestionType> {
    /** Returns the current query string */
    public koQuery: KnockoutObservable<string>;
    public searchFn: (query: string) => Promise<SuggestionType[]>;
    public rankingFn: (suggestion: SuggestionType) => number;
    /** Two suggestions from two different searches are considered to be the
     * same if they return the same key. */
    public keyFn: (suggestion: SuggestionType) => any;
    public suggestionClickedFn: (suggestion: SuggestionType) => void;
    public maxSuggestions: number;

    constructor(options: AutocompleteOptions<SuggestionType>) {
        this.koQuery = options.koQuery;
        this.searchFn = options.searchFn;
        this.rankingFn = options.rankingFn;
        this.keyFn = options.keyFn;
        this.suggestionClickedFn = options.suggestionClickedFn;
        this.maxSuggestions = options.maxSuggestions;

        this.koQuery.subscribe((query: string) => {
            this.search(query);
        });
        this.search(this.koQuery());

        this.keyPressed = this.keyPressed.bind(this);
        ko.track(this, ['suggestions', 'selectedSuggestionIx']);
    }

    public suggestions: SuggestionType[] = [];
    public selectedSuggestionIx = 0;

    private search(query: string): Promise<SuggestionType[]> {
        // Execute the domain specific search function
        return this.searchFn(query)
            .then((results: SuggestionType[]) => {
                var oldSuggestionsByKey = new Map<any, SuggestionType>();
                this.suggestions.forEach((suggestion) => {
                    oldSuggestionsByKey.set(this.keyFn(suggestion), suggestion);
                });
                var hit = 0, miss = 0;

                this.suggestions = _.orderBy(results, this.rankingFn, ['desc'])
                    .slice(0, this.maxSuggestions)
                    .map((suggestion) => {
                        const sameOldSuggestion = oldSuggestionsByKey.get(this.keyFn(suggestion));
                        if (sameOldSuggestion) {
                            hit ++;
                            return sameOldSuggestion;
                        } else {
                            miss++;
                            return suggestion;
                        }
                    });
                // console.log('hit %d miss %d', hit, miss);
                return this.suggestions
            })
    }

    private nextSuggestion() {
        this.selectedSuggestionIx = mod(this.selectedSuggestionIx + 1,
                this.suggestions.length);
    }

    private prevSuggestion() {
        this.selectedSuggestionIx = mod(this.selectedSuggestionIx - 1,
            this.suggestions.length);
    }

    public getSelectedSuggestion(): SuggestionType {
        if (this.selectedSuggestionIx != null) {
            return this.suggestions[this.selectedSuggestionIx];
        } else {
            return null;
        }
    }

    public keyPressed(component: any, event: KeyboardEvent) {
        // Both Shift+Tab and Ctrl+Tab go to the previous suggestion
        const modifier = event.shiftKey || event.ctrlKey;

        if (event.keyCode == KEY_ARROW_DOWN ||
            (event.keyCode == KEY_TAB && !modifier)) {
            this.nextSuggestion();
            return false;
        } else if (event.keyCode == KEY_ARROW_UP ||
            (event.keyCode == KEY_TAB && modifier)) {
            this.prevSuggestion();
            return false;
        } else {
            // Bubble the event so the characters are added to the text box.
            // Enter key is also bubbled, triggering submit event, which is
            // handled elsewhere.
            return true;
        }
    }
}