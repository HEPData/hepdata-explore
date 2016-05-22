import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {observable} from "../decorators/observable";
import {TableDescriptionFilter} from "../filters/TableDescriptionFilter";
import {app} from "../AppViewModel";

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

    @observable()
    showMatches = false;

    constructor(params: any) {
        this.filter = params.filter;
    }

    getTableNames(): string[] {
        return app.tableCache.allTables.slice(0, 30).map(t=>t.description);
    }

    dispose() {
        ko.untrack(this);
    }
}