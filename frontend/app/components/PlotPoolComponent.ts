import {PlotPool} from "../services/PlotPool";
import {assertHas} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {observable} from "../decorators/observable";

@KnockoutComponent('hep-plot-pool', {
    template: { fromUrl: 'plot-pool.html' },
})
export class PlotPoolComponent {
    @observable()
    plotPool: PlotPool;

    constructor(params: any) {
        assertHas(params, [
            {name: 'plotPool', type: PlotPool},
        ]);

        this.plotPool = ko.unwrap(params.plotPool);
    }
}
