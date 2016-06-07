import {Plot} from "../visualization/Plot";
import {assertHas} from "../utils/assert";
import TableCache = require("../services/TableCache");
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {bind} from "../decorators/bind";
import {app} from "../AppViewModel";
import {observable} from "../decorators/observable";

// https://github.com/eligrey/FileSaver.js/
declare function saveAs(blob: Blob, fileName: string): void;

@KnockoutComponent('hep-plot', {
    template: { fromUrl: 'plot.html' },
})
export class PlotComponent {
    @observable()
    plot: Plot;
    @observable()
    tableCache: TableCache;
    @observable()
    controlsVisible: boolean = true;

    constructor(params: any) {
        assertHas(params, [
            {name: 'plot', type: Plot},
            {name: 'tableCache', type: TableCache},
        ]);

        this.plot = ko.unwrap(params.plot);
        this.tableCache = ko.unwrap(params.tableCache);
        if ('controlsVisible' in params) {
            this.controlsVisible = ko.unwrap(params.controlsVisible);
        }
    }
    
    @bind()
    showEditPlot() {
        app.showEditPlotDialog(this.plot);
    }
    
    @bind()
    showPublicationsDialog() {
        app.showPublicationsDialog(this.plot);
    }

    @bind()
    downloadData() {
        const exportedPlot = this.plot.export();
        const exportedPlotYaml = jsyaml.safeDump(exportedPlot);
        const blob = new Blob([exportedPlotYaml], {
            type: 'text/x-yaml;charset=utf-8',
        });
        saveAs(blob, 'exported_plot.yaml');
    }
}
