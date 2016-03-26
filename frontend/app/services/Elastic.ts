import Filter = require("../filters/Filter");
import {DataPoint, Publication} from "../base/dataFormat";
export function ServerError(message: string = null) {
    this.name = 'ServerError';
    this.message = message || 'The server returned an invalid response';
    this.stack = (<any>new Error()).stack;
}
ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;

Promise.config({
    cancellation: true,
});

function asyncFetch(xhr: XMLHttpRequest, data = null) {
    return new Promise(function (resolve, reject, onCancel) {
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new ServerError());
            }
        };
        xhr.onerror = reject;
        xhr.send(data);

        onCancel(function () {
            xhr.abort();
        })
    });
}

export interface CountAggregationBucket {
    name: string;
    count: number;
}

interface ElasticQueryResult {
    // Subset of the fields we use from the response of ElasticSearch

    // Matched publications
    hits: {
        hits: {_source:Publication}[]
    };
}

export class Elastic {
    elasticUrl: string;

    constructor() {
        this.elasticUrl = 'http://' + location.hostname + ':9200/hepdata';
    }

    jsonQuery(path: string, data: {}): Promise<any> {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.elasticUrl + path, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        return asyncFetch(xhr, JSON.stringify(data))
            .then(() => {
                return JSON.parse(xhr.responseText);
            })
    }

    fetchFilteredData(rootFilter: Filter) {
        const requestData = {
            "size": 10000,
            "query": {
                "nested": {
                    "path": "tables.groups",
                    "query": rootFilter.toElasticQuery(),
                    "inner_hits": {
                        "name": "matching_groups"
                    }
                }
            }
        };
        return this.jsonQuery('/publication/_search', requestData)
            .then((results: ElasticQueryResult) => {
                let dataPoints: DataPoint[] = [];

                function nu<T>(val: T): T {
                    if (val === undefined) {
                        throw new Error("Undefined");
                    }
                    return val;
                }

                _.each(results.hits.hits, function (hit) {
                    const publication = hit._source;
                    _.each(publication.tables, function (table) {
                        _.each(table.groups, function (group) {
                            _.each(group.data_points, function (dataPoint) {
                                const flatDataPoint: DataPoint = {
                                    inspire_record: nu(publication.inspire_record),
                                    table_num: nu(table.table_num),
                                    cmenergies1: nu(group.cmenergies[0]),
                                    cmenergies2: nu(group.cmenergies[1]),
                                    reaction: nu(group.reaction),
                                    observables: nu(table.observables),
                                    var_y: nu(group.var_y),
                                    var_x: nu(group.var_x),
                                    x_low: nu(dataPoint.x_low),
                                    x_high: nu(dataPoint.x_high),
                                    x_center: nu((dataPoint.x_low + dataPoint.x_high) / 2),
                                    y: nu(dataPoint.y),
                                    errors: nu(dataPoint.errors),
                                };
                                dataPoints.push(flatDataPoint);
                            })
                        })
                    })
                });

                // ElasticSearch filters on document (i.e. publication) level. It will return
                // publications that have at least one matching data point, but there may be
                // many non-matching data points in those publications.
                // We proceed now to filter those at client side.
                dataPoints = _.filter(dataPoints, rootFilter.filterDataPoint.bind(rootFilter));

                return dataPoints;
            })
    }

    fetchAllByField(field: string): Promise<CountAggregationBucket[]> {
        return this.jsonQuery('/publication/_search', {
            "size": 0,
            "aggs": {
                "tables": {
                    "nested": {
                        "path": "tables.groups"
                    },
                    "aggs": {
                        "variables": {
                            "terms": {
                                "field": "tables.groups." + field,
                                "size": 10000,
                            },
                            "aggs": {
                                "data_point_count": {
                                    "nested": {
                                        "path": "tables.groups.data_points"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }).then((results) => {
            return _(results.aggregations.tables.variables.buckets)
                .map((bucket) => ({
                    name: bucket.key,
                    count: bucket.data_point_count.doc_count
                }))
                // Hack: I'm sorting variables client side because I don't know
                // how to do it in ElasticSearch, if it is possible.
                .sortBy(d => -d.count)
                .value();
        });
    }
}

export const elastic = new Elastic();