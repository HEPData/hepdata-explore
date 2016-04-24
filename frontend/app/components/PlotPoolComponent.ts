

import {PlotPool} from "../services/PlotPool";
import {assertHas} from "../utils/assert";
export class PlotPoolComponent {
    plotPool: PlotPool;

    constructor(params: any) {
        assertHas(params, [
            {name: 'plotPool', type: PlotPool}
        ]);

        this.plotPool = params.plotPool;
    }
}

ko.components.register('hep-plot-pool', {
    viewModel: PlotPoolComponent,
    template: { fromUrl: 'plot-pool.html' },
});
