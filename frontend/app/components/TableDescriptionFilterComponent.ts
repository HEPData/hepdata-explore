import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {observable} from "../decorators/observable";
import {TableDescriptionFilter} from "../filters/TableDescriptionFilter";

@KnockoutComponent('hep-table-description', {
    template: { fromUrl: 'table-description-filter.html' },
})
export class TableDescriptionFilterComponent {
    @observable()
    filter: TableDescriptionFilter;

    /** This observable property is used by the template to focus the text box
     * when the component is created.
     */
    @observable()
    focused = true;

    constructor(params: any) {
        this.filter = params.filter;
    }

    dispose() {
        ko.untrack(this);
    }
}