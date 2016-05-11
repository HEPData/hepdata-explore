import {AutocompleteService} from "../services/AutocompleteService";
import {assertHas} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";

@KnockoutComponent('suggestions-box', {
    template: { fromUrl: 'suggestions-box.html' },
})
export class SuggestionsBoxComponent<SuggestionType> {
    autocomplete: AutocompleteService<SuggestionType>;
    template: string;

    constructor(params:any) {
        assertHas(params, [
            {name: 'autocomplete', type: AutocompleteService},
            {name: 'template', type: String},
        ]);
        this.autocomplete = params.autocomplete;
        this.template = params.template;
        ko.track(this);
    }

    dispose() {
        ko.untrack(this);
    }
}