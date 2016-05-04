import {Filter} from "../filters/Filter";
import {
    DataPoint, Publication, DataPointError,
    DataPointColumn, PublicationTable
} from "../base/dataFormat";
import sum = d3.sum;
import {assert} from "../utils/assert";
import {jsonPOST} from "../base/network";

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
            this.elasticUrl = location.origin + '/elastic/hepdata3';
        } else {
            // testing on localhost and LAN
            this.elasticUrl = 'http://' + location.hostname + ':9200/hepdata3';
        }
    }

    fetchFilteredData(rootFilter: Filter): Promise<PublicationTable[]> {
        const requestData = {
            "size": 100,
            "query": {
                "nested": {
                    "path": "tables",
                    "query": rootFilter.toElasticQuery(),
                }
            }
        };
        return jsonPOST(this.elasticUrl + '/publication/_search', requestData)
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

    /** Returns an acceptable value for the `path` attribute of the
     * ElasticSearch nested filter in order to run a filter for some field path.
     *
     * The content of the function depends on how the data is mapped in
     * ElasticSearch: Since 'reactions' is indexed as nested, it must be in path
     * in order to filter by e.g. 'tables.reactions.string_full'
     */
    static getPathForFieldPath(field: string) {
        if (field.startsWith('reactions.')) {
            return 'tables.reactions';
        } else {
            return 'tables';
        }
    }

    fetchAllByField(field: string): Promise<CountAggregationBucket[]> {
        return jsonPOST(this.elasticUrl + '/publication/_search', {
            "size": 0,
            "aggs": {
                "tables": {
                    "nested": {
                        "path": Elastic.getPathForFieldPath(field)
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