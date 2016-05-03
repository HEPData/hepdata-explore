import {Filter} from "../filters/Filter";

interface ComponentRef {
    name: string;
    params: {
        filter: Filter
    };
}
export = ComponentRef