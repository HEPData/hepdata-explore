import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {observable} from "../decorators/observable";
import {TableDescriptionFilter} from "../filters/TableDescriptionFilter";
import {app} from "../AppViewModel";
import {
    registerFilterComponent,
    unregisterFilterComponent
} from "../base/getFilterComponent";

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

    @observable()
    regexpInfoVisible = false;

    constructor(params: any) {
        this.filter = params.filter;

        registerFilterComponent(this.filter, this)
    }

    getTableNames(): string[] {
        return app.tableCache.allTables.slice(0, 30).map(t=>t.description);
    }

    toggleRegexpInfo() {
        this.regexpInfoVisible = !this.regexpInfoVisible;
    }

    dispose() {
        ko.untrack(this);
        unregisterFilterComponent(this.filter);
    }
}