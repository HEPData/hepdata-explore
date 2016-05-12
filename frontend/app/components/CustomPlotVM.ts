import {Plot} from "../visualization/Plot";
import TableCache = require("../services/TableCache");

export class CustomPlotVM {
    constructor(public plot: Plot, public tableCache: TableCache) {
        ko.track(this);
    }
}