import {AutocompleteService} from "../services/AutocompleteService";
import {assertHas} from "../utils/assert";

class SuggestionsBoxComponent<SuggestionType> {
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

ko.components.register('suggestions-box', {
    viewModel: SuggestionsBoxComponent,
    template: { fromUrl: 'suggestions-box.html' },
});

export = SuggestionsBoxComponent;