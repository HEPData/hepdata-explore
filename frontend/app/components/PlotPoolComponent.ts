import {PlotPool} from "../services/PlotPool";
import {assertHas} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";

@KnockoutComponent('hep-plot-pool', {
    template: { fromUrl: 'plot-pool.html' },
})
export class PlotPoolComponent {
    plotPool: PlotPool;

    constructor(params: any) {
        assertHas(params, [
            {name: 'plotPool', type: PlotPool},
        ]);

        this.plotPool = params.plotPool;
    }
}
