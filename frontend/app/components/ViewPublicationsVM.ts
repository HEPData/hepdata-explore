import {observable} from "../decorators/observable";
import {Plot} from "../visualization/Plot";

export class ViewPublicationsVM {
    @observable()
    plot: Plot;

    constructor(plot: Plot) {
        this.plot = plot;
    }

    dispose() {
        ko.untrack(this);
    }
}