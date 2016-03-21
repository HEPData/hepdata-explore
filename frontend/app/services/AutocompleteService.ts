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
    maxSuggestions: number;
}

export class AutocompleteService<SuggestionType> {
    public koQuery: KnockoutObservable<string>;
    public searchFn: (query: string) => Promise<SuggestionType[]>;
    public rankingFn: (suggestion: SuggestionType) => number;
    public maxSuggestions: number;

    constructor(options: AutocompleteOptions<SuggestionType>) {
        this.koQuery = options.koQuery;
        this.searchFn = options.searchFn;
        this.rankingFn = options.rankingFn;
        this.maxSuggestions = options.maxSuggestions;

        this.koQuery.subscribe((query: string) => {
            this.search(query);
        });
        this.search(this.koQuery());

        this.keyPressed = this.keyPressed.bind(this);
        ko.track(this);
    }

    public suggestions: SuggestionType[] = [];
    public selectedSuggestionIx = 0;

    private search(query: string): Promise<SuggestionType[]> {
        // Execute the domain specific search function
        return this.searchFn(query)
            .then((results: SuggestionType[]) => {
                this.suggestions = _.orderBy(results, this.rankingFn, ['desc'])
                    .slice(0, this.maxSuggestions);
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