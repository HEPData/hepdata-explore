import {Plot} from "../visualization/Plot";
import {assertHas} from "../utils/assert";

class PlotComponent {
    plot: Plot;

    constructor(params) {
        assertHas(params, [
            {'name': 'plot', 'type': Plot}
        ]);

        this.plot = params.plot;
    }

    bindCanvas(canvas: HTMLCanvasElement) {
        this.plot.canvas = canvas;
    }
}

ko.components.register('hep-plot', {
    viewModel: PlotComponent,
    template: { fromUrl: 'plot.html' },
});

export = PlotComponent;