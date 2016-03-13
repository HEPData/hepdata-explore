import Filter = require("../filters/Filter");

interface ComponentRef {
    name: string;
    params: {
        filter: Filter
    };
}
export = ComponentRef