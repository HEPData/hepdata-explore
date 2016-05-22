import {Filter} from "../filters/Filter";
import {
    DataPoint, Publication, DataPointError,
    DataPointColumn, PublicationTable, isSymmetricError
} from "../base/dataFormat";
import {
    assert, assertInstance, assertHas,
    AssertionError
} from "../utils/assert";
import {jsonPOST} from "../base/network";
import {sum, map} from "../utils/map";
import SomeFilter = require("../filters/SomeFilter");
import AllFilter = require("../filters/AllFilter");
import {calculateComplementaryFilter} from "../utils/complementaryFilter";
import {bind} from "../decorators/bind";

export interface CountAggregationBucket {
    name: string;
    count: number;
}

interface ElasticQueryResult {
    // Subset of the fields we use from the response of ElasticSearch

    // Matched publications
    hits: {
        hits: {
            _source: Publication,
            inner_hits: {
                tables: {
                    hits: {
                        hits: {
                            _source: PublicationTable
                        }[]
                    }
                }
            }
        }[]
    };
}

export class Elastic {
    elasticUrl: string;

    constructor() {
        if (location.hostname.indexOf('rufian.eu') != -1) {
            // my test server
            this.elasticUrl = location.origin + '/elastic/hepdata4';
        } else {
            // testing on localhost and LAN
            this.elasticUrl = 'http://' + location.hostname + ':9200/hepdata4';
        }
    }

    @bind()
    fetchFilteredData(rootFilter: Filter): Promise<PublicationTable[]> {
        const requestData = {
            "size": 100,
            "query": {
                "nested": {
                    "path": "tables",
                    "query": rootFilter.toElasticQuery(),
                    "inner_hits": {},
                },
            }
        };
        return jsonPOST(this.elasticUrl + '/publication/_search', requestData)
            .then((results: ElasticQueryResult) => {
                const returnedTables: PublicationTable[] = [];

                for (let publicationHit of results.hits.hits) {
                    const publication: Publication = publicationHit._source;
                    const filteredTables: PublicationTable[] = map(
                        publicationHit.inner_hits.tables.hits.hits, h=>h._source);

                    for (let table of filteredTables) {
                        // Use client side filtering too
                        if (!rootFilter.isUsable() || rootFilter.filterTable(table)) {
                            // The table passes all filters, index it.
                            table.publication = publication;
                            this.addRangeProperties(table.data_points);
                            returnedTables.push(table);
                        }
                    }
                }

                return returnedTables;
            })
    }

    fetchCountByField(field: string, filter: Filter|null)
        : Promise<CountAggregationBucket[]>
    {
        let elasticFilter: any = undefined;
        if (filter) {
            elasticFilter = {
                "nested": {
                    "path": "tables",
                    "query": filter.toElasticQuery(),
                }
            };
        } else {
            // Empty filter that matches anything
            elasticFilter = {
                "bool": {
                    "must": []
                }
            }
        }

        return jsonPOST(this.elasticUrl + '/publication/_search', {
            "size": 0,
            "aggs": {
                "tables_filtered": {
                    "filter": elasticFilter,
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
                }
            }
        }).then((results) => {
            return _(results.aggregations.tables_filtered.tables.variables.buckets)
                .map((bucket: any) => ({
                    name: bucket.key,
                    count: bucket.doc_count
                }))
                .sortBy(d => -d.count)
                .value();
        });
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
        
        function normalizeError(error: DataPointError) {
            if (isSymmetricError(error)) {
                // Yep, sometimes is negative... even though it should not
                // matter.
                const value = Math.abs(error.value);
                return [value, value];
            } else {
                // Note: error.minus is usually negative except in anomalous
                // cases.
                // Sometimes, error.plus may be negative, swapping the symbols.
                // This code normalizes data in those cases for plotting
                // purposes.
                const error_down = -Math.min(error.plus, error.minus, 0.0);
                const error_up = Math.max(error.plus, error.minus, 0.0);

                assert(error_down >= 0);
                assert(error_up >= 0);

                return [error_down, error_up];
            }
        }

        function sumErrors(column: DataPointColumn) {
            if (column.value == null) {
                // No value, no error
                column.error_up = column.error_down = 2;
            } else if ('low' in column) {
                // Just use the range as computed error
                if (typeof column.low != 'number') throw new AssertionError();
                if (typeof column.high != 'number') throw new AssertionError();
                if (typeof column.value != 'number') throw new AssertionError();

                // assert(column.high >= column.low);
                // ... except the data is not that clean! (the commented out
                // assert above fails)

                // For some reason, sometimes low and high are twisted, so we
                // will just take them as two values and compute the lower and
                // higher respectively.
                const high = Math.max(column.high, column.low);
                const low = Math.min(column.high, column.low);
                
                column.error_up = high - column.value;
                column.error_down = column.value - low;

                assert(column.error_up >= 0);
                assert(column.error_down >= 0);
            } else if (column.errors == null || column.errors.length == 0) {
                // No error specified, so just set zero.
                column.error_down = column.error_up = 0;
            } else if (column.errors.length == 1) {
                // Just one error, use that
                [column.error_down, column.error_up] = normalizeError(column.errors[0]);
            } else {
                // Several errors, use the vector norm of them (sqrt of sum of
                // squares of the error values).
                // Do the calculation separately for error_down and error_up.

                const squaredErrors: {down: number, up: number}[] = [];
                for (let error of column.errors) {
                    const [error_down, error_up] = normalizeError(error);
                    squaredErrors.push({
                        down: error_down * error_down,
                        up: error_up * error_up,
                    });
                }

                column.error_down = Math.sqrt(sum(squaredErrors, (e) => e.down));
                column.error_up = Math.sqrt(sum(squaredErrors, (e) => e.up));
            }

            assert(!isNaN(column.error_down));
            assert(!isNaN(column.error_up));
        }

        for (let dataPoint of dataPoints) {
            for (let column of dataPoint) {
                assert(column.value == undefined || !isNaN(column.value));

                // If the data point comes without a value, infer the value from
                // the range... even if it already have a value too for some
                // weird reason
                if ('low' in column) {
                    assert(typeof column.low == 'number' && !isNaN(column.low));
                    assert(typeof column.high == 'number' && !isNaN(column.high));
                    // if it even has that
                    column.value = (column.low + column.high) / 2;
                }

                // Some columns may be completely void. Set them as a explicit
                // null, not a doubtful undefined.
                if (column.value === undefined) {
                    column.value = null;
                }

                sumErrors(column);

                assert(column.error_down >= 0);
                assert(column.error_up >= 0);
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
}

export const elastic = new Elastic();