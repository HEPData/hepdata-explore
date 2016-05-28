import {FilterDump} from "../filters/Filter";
import {PlotConfig, PlotConfigDump} from "../visualization/Plot";

export class StateDump {
    version: number;
    filter: FilterDump|null;
    plots: PlotConfigDump[];
}