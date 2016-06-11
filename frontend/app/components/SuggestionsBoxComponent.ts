import {AutocompleteService} from "../services/AutocompleteService";
import {assertHas} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {observable} from "../decorators/observable";

@KnockoutComponent('suggestions-box', {
    template: { fromUrl: 'suggestions-box.html' },
})
export class SuggestionsBoxComponent<SuggestionType, IndexType> {
    @observable()
    autocomplete: AutocompleteService<SuggestionType, IndexType>;
    @observable()
    template: string;

    constructor(params:any) {
        assertHas(params, [
            {name: 'autocomplete', type: AutocompleteService},
            {name: 'template', type: String},
        ]);
        this.autocomplete = params.autocomplete;
        this.template = params.template;
    }

    dispose() {
        ko.untrack(this);
    }
}