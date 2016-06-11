import {FilterDump} from "../filters/Filter";
import {PlotConfigDump} from "../visualization/Plot";

export class StateDump {
    version: number;
    filter: FilterDump;
    plots: PlotConfigDump[];
}