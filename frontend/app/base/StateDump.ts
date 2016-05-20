import {FilterDump} from "../filters/Filter";

export class StateDump {
    version: number;
    filter: FilterDump|null;
}