import Filter = require("../filters/Filter");
import {
    DataPoint, Publication, DataPointError,
    DataPointColumn, PublicationTable
} from "../base/dataFormat";
import sum = d3.sum;
import {assert} from "../utils/assert";
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
        if (location.hostname.indexOf('rufian.eu') != -1) {
            // my test server
            this.elasticUrl = location.origin + '/elastic/hepdata2';
        } else {
            // testing on localhost and LAN
            this.elasticUrl = 'http://' + location.hostname + ':9200/hepdata2';
        }
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

    fetchFilteredData(rootFilter: Filter): Promise<PublicationTable[]> {
        console.log(rootFilter);
        const requestData = {
            "size": 100,
            "query": {
                "nested": {
                    "path": "tables",
                    "query": rootFilter.toElasticQuery(),
                }
            }
        };
        return this.jsonQuery('/publication/_search', requestData)
            .then((results: ElasticQueryResult) => {
                const publications: Publication[] = _.map(results.hits.hits,
                    (x) => x._source);

                const tables = [];

                for (let publication of publications) {
                    for (let table of publication.tables) {
                        if (rootFilter.filterTable(table)) {
                            table.publication = publication;
                            this.addRangeProperties(table.data_points);
                            tables.push(table);
                        }
                    }
                }

                return tables;
            })
    }
    
    /**
     * Values may come with a range (low, high) or with a series of error tags.
     * This function unifies them as a single representation.
     * 
     * It also adds a calculated `value` property from the range if the column
     * lacked it.
     */
    private addRangeProperties(dataPoints: DataPoint[]) {
        // Values may come with a range (low, high) or with a series of error tags.
        // This function unifies them as a single representation.
        // 

        function square(x: number) {
            return x * x;
        }

        function sumErrors(column: DataPointColumn) {
            const errors = column.errors || [];
            let summedMinus, summedPlus;

            if (errors.length == 0) {
                summedMinus = summedPlus = 0;
            } else if (errors.length == 1) {
                // TODO clarify why we have negative errors
                summedMinus = Math.abs(errors[0].minus);
                summedPlus = Math.abs(errors[0].plus);
            } else {
                // Square root of the sum of the squares of errors, as Eammon asked
                summedPlus = 0;
                summedMinus = 0;
                for (let error of errors) {
                    summedPlus += square(error.plus);
                    summedMinus += square(error.minus);
                }
                summedPlus = Math.sqrt(summedPlus);
                summedMinus = Math.sqrt(summedMinus);
            }

            column.low = column.value - summedMinus;
            column.high = column.value + summedPlus;
        }

        for (let dataPoint of dataPoints) {
            for (let column of dataPoint) {
                // assert(column.value == undefined || column.low == undefined
                //     || column.value >= column.low);
                // assert(column.value == undefined || column.low == undefined
                //     || column.value <= column.high);

                if (column.low === undefined) {
                    // It may have error tag representation, sum the errors
                    sumErrors(column);
                }
                
                // If the data point comes without a value, infer it from the 
                // range.
                if (column.value === undefined) {
                    column.value = (column.low + column.high) / 2;
                }

                // assert(column.value >= column.low);
                // assert(column.value <= column.high);
            }
        }
    }

    fetchAllByField(field: string): Promise<CountAggregationBucket[]> {
        return this.jsonQuery('/publication/_search', {
            "size": 0,
            "aggs": {
                "tables": {
                    "nested": {
                        "path": "tables"
                    },
                    "aggs": {
                        "variables": {
                            "terms": {
                                "field": "tables." + field,
                                "size": 10000,
                            },
                        }
                    }
                }
            }
        }).then((results) => {
            return _(results.aggregations.tables.variables.buckets)
                .map((bucket) => ({
                    name: bucket.key,
                    count: bucket.doc_count
                }))
                .sortBy(d => -d.count)
                .value();
        });
    }
}

export const elastic = new Elastic();