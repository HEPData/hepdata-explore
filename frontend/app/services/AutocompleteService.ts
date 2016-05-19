import {assertInstance, assertDefined, assert} from "../utils/assert";
import {Option, Some, None} from "../base/Option";
import {bind} from "../decorators/bind";
import {observable} from "../decorators/observable";
import {KeyCode} from "../utils/KeyCode";

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

    private _suggestionElements = new WeakMap<SuggestionType, HTMLElement>();

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
    }

    @observable()
    public suggestions: SuggestionType[] = [];
    @observable()
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
        this.ensureSuggestionIsVisible(this.suggestions[this.selectedSuggestionIx]);
    }

    private prevSuggestion() {
        this.selectedSuggestionIx = mod(this.selectedSuggestionIx - 1,
            this.suggestions.length);
        this.ensureSuggestionIsVisible(this.suggestions[this.selectedSuggestionIx]);
    }

    public getSelectedSuggestion(): Option<SuggestionType> {
        if (this.selectedSuggestionIx != null) {
            return new Some(this.suggestions[this.selectedSuggestionIx]);
        } else {
            return new None<SuggestionType>();
        }
    }

    /**
     * Reusable key event handler. Handles selection with Tab and arrow keys.
     * Returns false iif a matching event is handled.
     */
    @bind()
    public keyPressed(component: any, event: KeyboardEvent) {
        // Both Shift+Tab and Ctrl+Tab go to the previous suggestion
        const modifier = event.shiftKey || event.ctrlKey;

        if (event.keyCode == KeyCode.ArrowDown) {
            this.nextSuggestion();
            return false;
        } else if (event.keyCode == KeyCode.ArrowUp) {
            this.prevSuggestion();
            return false;
        } else if (!modifier && (event.keyCode == KeyCode.Tab)) {
            this.acceptSelected();
            // Keep bubbling so the focus jumps to the next field
            return true;
        } else {
            // Bubble the event so the characters are added to the text box.
            // Enter key is also bubbled, triggering submit event, which is
            // handled elsewhere.
            return true;
        }
    }

    /** Like keyPressed(), but also handles the enter key instead of relying in
     * form submit.
     */
    @bind()
    public keyPressedHandleEnter(component: any, event: KeyboardEvent) {
        if (event.keyCode == KeyCode.Return) {
            this.acceptSelected();
            return false;
        } else {
            return this.keyPressed(component, event);
        }
    }

    private _suggestionMouseDown(suggestion: SuggestionType, event: MouseEvent) {
        if (event.button == 0) {
            // Left click
            this.suggestionClickedFn(suggestion);
        }
    }

    public koMouseDownHandler(suggestion: SuggestionType) {
        return (component: any, event: MouseEvent) => {
            this._suggestionMouseDown(suggestion, event);
        };
    }

    /** Intended to be used as form submit target */
    @bind()
    public acceptSelected() {
        const selectedSuggestion = this.getSelectedSuggestion();
        if (selectedSuggestion.isSet()) {
            this.suggestionClickedFn(selectedSuggestion.get());
        }
    }

    private _leakSuggestionElement(suggestion: SuggestionType, element: HTMLElement): void {
        this._suggestionElements.set(suggestion, element);
    }

    /**
     * This function is intended to use as the value for the `leak` binding in
     * the <li> object holding a suggestion.
     */
    public leakSuggestionElementHandler(suggestion: SuggestionType) {
        return (element: HTMLElement) => {
            this._leakSuggestionElement(suggestion, element);
        };
    }

    private _scrollPane: HTMLElement = null;
    /**
     * Scrolls the completion pane to make sure the currently selected
     * suggestion is visible.
     */
    private ensureSuggestionIsVisible(suggestion: SuggestionType) {
        const scrollPane = this._scrollPane;
        if (!scrollPane) {
            // No scroll pane specified, so nothing to scroll.
            return;
        }

        const element: HTMLElement = this._suggestionElements.get(suggestion);
        assert(element != null);

        // Same scroll policy as seen in IntelliJ: the pane should be scrolled
        // just enough to make the element completely visible.

        const viewportTop = scrollPane.scrollTop;
        const viewportBottom = scrollPane.scrollTop + scrollPane.clientHeight;

        const elementTop = element.offsetTop;
        const elementBottom = element.offsetTop + element.clientHeight;

        if (elementTop < viewportTop) {
            // scroll up
            scrollPane.scrollTop -= viewportTop - elementTop;
        } else if (elementBottom > viewportBottom) {
            // scroll down
            scrollPane.scrollTop += elementBottom - viewportBottom;
        }
    }

    public leakScrollPaneHandler() {
        return (element: HTMLElement) => {
            this._scrollPane = element;
        };
    }
}