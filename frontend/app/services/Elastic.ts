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

function asyncFetchJSON(path: string) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path, true);
    return asyncFetch(xhr)
        .then(function () {
            return JSON.parse(xhr.responseText)
        })
}

function asyncFetchLineDelimited(path: string) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path, true);
    return asyncFetch(xhr)
        .then(function () {
            return xhr.responseText.split('\n')
        })
}

function asyncFetchBinary(path: string) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path, true);
    xhr.responseType = 'arraybuffer';
    return asyncFetch(xhr)
        .then(function () {
            return xhr.response;
        })
}

var elasticUrl = 'http://localhost:9200/hepdata-demo/publication/_search';

function asyncFetchElastic(varX) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', elasticUrl, true)
    return asyncFetch(xhr, JSON.stringify({
        "size": 0,
        "query": {
            "nested": {
                "path": "tables.groups",
                "query": {
                    "match": {
                        "tables.groups.var_x": varX
                    }
                },
                "inner_hits": {
                    "name": "matching_groups"
                }
            }
        }
    }))
        .then(function () {
            var results = JSON.parse(xhr.responseText);
            var dataPoints = [];

            function nu(val) {
                if (val === undefined) {
                    throw new Error("Undefined");
                }
                return val;
            }

            _.each(results.hits.hits, function (hit) {
                var publication = hit._source
                _.each(publication.tables, function (table) {
                    _.each(table.groups, function (group) {
                        if (!(group.var_x == varX)) {
                            return;
                        }
                        _.each(group.data_points, function (dataPoint) {
                            var flatDataPoint = {
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
                            }
                            dataPoints.push(flatDataPoint)
                        })
                    })
                })
            })

            return dataPoints
        })
}

function asyncFetchIndependentVariables() {
    var xhr = new XMLHttpRequest()
    xhr.open('POST', elasticUrl, true)
    return asyncFetch(xhr, JSON.stringify({
        "size": 0,
        "aggs": {
            "tables": {
                "nested": {
                    "path": "tables.groups"
                },
                "aggs": {
                    "variables": {
                        "terms": {
                            "field": "tables.groups.var_x",
                            "size": 10000
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
    }))
        .then(function () {
            var results = JSON.parse(xhr.responseText);

            var variables = _(results.aggregations.tables.variables.buckets)
                .map(function (bucket) {
                    return {
                        name: bucket.key,
                        recordCount: bucket.data_point_count.doc_count
                    }
                })
                // Hack: I'm sorting variables client side because I don't know how to
                // do it in ElasticSearch.
                .sortBy(function (d) {
                    return -d.recordCount
                })
                .value()

            return variables
        })
}

export interface CountAggregationBucket {
    name: string;
    count: number;
}

export class Elastic {
    elasticUrl: string;

    constructor() {
        this.elasticUrl = 'http://' + location.hostname + ':9200/hepdata';
    }

    jsonQuery(path: string, data: {}): Promise<any> {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.elasticUrl + path, true);
        return asyncFetch(xhr, JSON.stringify(data))
            .then(() => {
                return JSON.parse(xhr.responseText);
            })
    }

    fetchAllIndepVars(): Promise<CountAggregationBucket[]> {
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
                                "field": "tables.groups.var_x",
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