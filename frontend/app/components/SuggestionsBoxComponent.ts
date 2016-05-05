import {AutocompleteService} from "../services/AutocompleteService";
import {assertHas} from "../utils/assert";
import {KnockoutComponent} from "../base/KnockoutComponent";

@KnockoutComponent('suggestions-box', {
    template: { fromUrl: 'suggestions-box.html' },
})
export class SuggestionsBoxComponent<SuggestionType> {
    autocomplete: AutocompleteService<SuggestionType>;

    constructor(params:any) {
        assertHas(params, [
            {name: 'autocomplete', type: AutocompleteService}
        ]);
        this.autocomplete = params.autocomplete;
        ko.track(this);
    }

    dispose() {
        ko.untrack(this);
    }
}