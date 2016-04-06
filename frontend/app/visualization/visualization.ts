import {DataPoint} from "../base/dataFormat";
import numRecordsFormat = require('./numRecordsFormat');

declare var d3Transform: any; // SVG transform generator for D3.js
type provisional = any;

declare class Map2<K1, K2, V> {
    get(a:K1, b:K2): V;
    set(a:K1, b:K2, value:V): void;
    keys(): Iterable<[K1, K2]>;
}

var array2dComparisonOperators = {
    name: '2d',
    lt: function _lt(a,b) {
        if (a[0] !== b[0]) {
            return a[0] < b[0];
        } else {
            return a[1] < b[1];
        }
    },
    lte: function _lte(a,b) {
        if (a[0] !== b[0]) {
            return a[0] <= b[0];
        } else {
            return a[1] <= b[1];
        }
    },
    gt: function _gt(a,b) {
        if (a[0] !== b[0]) {
            return a[0] > b[0];
        } else {
            return a[1] > b[1];
        }
    },
    gte: function _gte(a,b) {
        if (a[0] !== b[0]) {
            return a[0] >= b[0];
        } else {
            return a[1] >= b[1];
        }
    }
};

function rowChartLabels(chart: provisional, xLabel: string, yLabel: string) {
    chart.svg()
        .append('text')
        .attr('class', 'x-axis-label')
        .attr("text-anchor", "middle")
        .attr("x", chart.width() / 2)
        .attr("y", chart.height())
        .text(xLabel);

    chart.svg()
        .append('text')
        .attr('class', 'y-axis-label')
        .attr("text-anchor", "middle")
        .text(yLabel)
        .attr('transform', d3Transform()
            .translate(15, chart.height() / 2)
            .rotate(-90)
        )
}

function customScatterPlot(parent, chartGroup?) {
    var _chart = (<provisional>dc).scatterPlot(parent, chartGroup);
    var _locator = function (d) {
        return 'translate(' + _chart.x()(_chart.keyAccessor()(d)) + ',' +
            _chart.y()(_chart.valueAccessor()(d)) + ')';
    };
    var _existenceAccessor = function (d) {
        return d.value;
    };
    var _symbol = d3.svg.symbol();

    var _symbolSize = 3;
    var _highlightedSize = 5;
    var _hiddenSize = 0;

    _symbol.size(function (d) {
        if (!_existenceAccessor(d)) {
            return _hiddenSize;
        } else if (this.filtered) {
            return Math.pow(_highlightedSize, 2);
        } else {
            return Math.pow(_symbolSize, 2);
        }
    });

    _chart.plotData = function () {
        var symbols = _chart.chartBodyG().selectAll('path.symbol')
            .data(_chart.data());

        symbols
            .enter()
            .append('path')
            .attr('class', 'symbol')
            .attr('opacity', 0)
            .attr('fill', _chart.getColor)
            .attr('transform', _locator);


        (<provisional>dc).transition(symbols, _chart.transitionDuration())
            .attr('opacity', function (d) {
                return _existenceAccessor(d) ? 1 : 0;
            })
            .attr('fill', _chart.getColor)
            .attr('transform', _locator)
            .attr('d', _symbol);

        (<provisional>dc).transition(symbols.exit(), _chart.transitionDuration())
            .attr('opacity', 0).remove();
    };

    var colorScale = d3.scale.category10();
    /*
     TODO: compare with colorScale

     var colors = colorScale.range();
     var nextColorIndex = 0;
     var keyToColor = {};
     */
    _chart.getColor = function (d, i) {
        var key = d.key.inspire_record + '-' + d.key.table_num;
        return colorScale(key);

        /* should do the same:

         if (!(key in keyToColor)) {
         keyToColor[key] = colors[nextColorIndex];
         nextColorIndex = (nextColorIndex + 1) % colors.length;
         console.log(key);
         }
         return keyToColor[key];
         */
    };

    return _chart
}

function plotVariable(ndx: CrossFilter.CrossFilter<DataPoint>, data: DataPoint[],
                      var_x: string, var_y: string,
                      minX: number, maxX: number,
                      yVars: any) {
    var dimension = (<provisional>ndx).dimension(function (d) {
        var ret: provisional = [d.x_center, d.y];
        ret.var_y = d.var_y;
        ret.inspire_record = d.inspire_record;
        ret.table_num = d.table_num;
        return ret;
    }, array2dComparisonOperators);

    var newDiv = $('<div/>');
    var chart = customScatterPlot(newDiv[0]);
    $('#variable-charts').append(newDiv);
    chart
        .width(300)
        .height(300)
        .data(function (d) {
            return _.filter(d.all(), function (d: provisional, i) {
                return d.key.var_y == var_y;
            });
        })
        .elasticX(true)
        .dimension(dimension)
        .group(dimension.group())
        .x(d3.scale.pow().exponent(.5).domain([minX, maxX]))
        // .y(d3.scale.pow().exponent(.5).domain([chart.yAxisMin(), chart.yAxisMax()]))
        .margins({top: 10, right: 50, bottom: 30, left: 42})
        .yAxisLabel(var_y)
        .xAxisLabel(var_x)
        .brushOn(true);

    chart.yAxis()
        .tickFormat(d3.format(".2s"));

    chart.render();
    (<any>window).chart = chart
}

export function groupDataByVariablePairs(data: DataPoint[]) {
    // Group data points by their X-Y variable pair.
    const grouped = new Map2<string, string, DataPoint[]>();

    for (let i = 0; i < data.length; i++) {
        const datum = data[i];
        let matchingPoints = grouped.get(datum.var_x, datum.var_y);
        if (!matchingPoints) {
            matchingPoints = [];
            grouped.set(datum.var_x, datum.var_y, matchingPoints);
        }
        matchingPoints.push(datum);
    }
    return grouped;
}

interface TaggedXY {
    [0]: number;
    [1]: number;
    var_x: string;
    var_y: string;
}

export function sampleData(dataGroups: Map2<string,string,DataPoint[]>)
    : [DataPoint[], Map2<string,string,DataPoint[]>]
{
    // In order to not hog the interface, there is a limit on how many data points will be
    // represented for each variable pair.
    const maxValuesPerKey = 1000;

    const keys = Array.from(dataGroups.keys());
    // We've removed the unlucky data points from the groups, but they are still in the full
    // data set. We will reconstruct a new data set without those filtered out.
    let filteredData: DataPoint[] = [];
    let filteredDataGroups = new Map2<string,string,DataPoint[]>();

    for (let [varX, varY] of keys) {
        const values = dataGroups.get(varX, varY);
        const filteredValues = _.sampleSize(values, maxValuesPerKey);

        filteredDataGroups.set(varX, varY, filteredValues);
        // Add to the global data set
        filteredData = filteredData.concat.apply(filteredData, filteredValues)
    }

    return [filteredData, filteredDataGroups];
}

export function showGraphs(data: DataPoint[], dataGroups: Map2<string,string,DataPoint[]>) {
    const ndx = crossfilter<DataPoint>(data);

    // const allVarsChart = dc.barChart('#all-vars-chart');
    const dataPointCountLabel = (<provisional>dc).numberDisplay('#data-point-count');

    // This aggregation retains the count of the matched data points at a given time.
    const dataPointCount = ndx.groupAll().reduce(function (p, v) {
        p.n++;
        return p;
    }, function (p, v) {
        p.n--;
        return p;
    }, function () {
        return {n: 0};
    });

    dataPointCountLabel
        .formatNumber(numRecordsFormat)
        .group(dataPointCount)
        .valueAccessor(function (d) {
            return d.n;
        })
        .render();

    const xyDimension = (<provisional>ndx).dimension((d: DataPoint) => {
        let ret: provisional = [d.x_center, d.y];
        // Tag each data point of this dimension with information useful for filtering.
        ret.var_x = d.var_x;
        ret.var_y = d.var_y;
        return ret;
    }, array2dComparisonOperators);

    // Sort variable pairs (i.e. keys) by datum count
    const keys = Array.from(dataGroups.keys());
    let sortedKeys = _.sortBy(keys, ([varX, varY]) => {
        return -dataGroups.get(varX, varY).length
    });

    // Plot at most 7 variable pairs
    sortedKeys = sortedKeys.slice(0, 7);

    // Delete previous charts and generate new ones, one for each variable pair
    $('#variable-charts').empty();

    sortedKeys.forEach(([varX, varY]) => {
        const filteredData = dataGroups.get(varX, varY);
        plotVariablePair(ndx, xyDimension,
            varX, varY, filteredData);
    });


}

function plotVariablePair(ndx: CrossFilter.CrossFilter<DataPoint>,
                          xyDimension: CrossFilter.Dimension<DataPoint, TaggedXY>,
                          varX: string, varY: string, filteredData: DataPoint[]) {
    let minX = Infinity;
    let maxX = -Infinity;

    for (var i = 0; i < filteredData.length; i++) {
        var obj = filteredData[i];
        if (obj.x_low < minX) {
            minX = obj.x_low;
        }
        if (obj.x_high > maxX) {
            maxX = obj.x_high;
        }
    }

    const chartElement = document.createElement('div');
    const chart = customScatterPlot(chartElement);
    $('#variable-charts').append(chartElement);
    chart
        .width(300)
        .height(300)
        .dimension(xyDimension)
        .group(xyDimension.group())
        .data((d) => {
            const allDimensionDataPoints: provisional = d.all();
            return _.filter(allDimensionDataPoints, (d: {key: TaggedXY}) => {
                return d.key.var_x == varX && d.key.var_y == varY;
            });
        })
        .elasticX(true)
        .x(d3.scale.pow().exponent(.5).domain([minX, maxX]))
        .margins({top: 10, right: 50, bottom: 30, left: 42})
        .yAxisLabel(varY)
        .xAxisLabel(varX)
        .brushOn(true);

    chart.yAxis()
        .tickFormat(d3.format(''))

    chart.render();
}

export function showGraphsVariables(data, var_x) {
    var ndx = crossfilter<DataPoint>(data);
    var all = ndx.groupAll();

    var allVarsChart = dc.barChart('#all-vars-chart');
    var numberRecords = (<provisional>dc).numberDisplay('#number-records');
    var varDistributionChart = dc.rowChart('#variable-distribution-chart');
    var reactionsChart = dc.rowChart('#reactions-chart');
    var observablesChart = dc.rowChart('#observables-chart');

    var xValues = ndx.dimension((d) => d.x_center);
    var yVars = ndx.dimension((d) => d.var_y);
    var reactions = ndx.dimension((d) => d.reaction);
    var observables = ndx.dimension((d) => d.observables);
    var allCount = ndx.groupAll().reduce(function (p, v) {
        p.n++;
        return p;
    }, function (p, v) {
        p.n--;
        return p;
    }, function () {
        return {n: 0};
    });

    var minX = Infinity;
    var maxX = -Infinity;

    for (var i = 0; i < data.length; i++) {
        var obj = data[i];
        if (obj.x_low < minX) {
            minX = obj.x_low;
        }
        if (obj.x_high > maxX) {
            maxX = obj.x_high;
        }
    }

    (<provisional>allVarsChart)
        .width(900)
        .height(130)
        .margins({top: 10, right: 50, bottom: 30, left: 40})
        .x(d3.scale.pow().exponent(.5).domain([minX, maxX]))
        //     .x(d3.scale.linear().domain([minX, maxX]))
        .dimension(xValues)
        .group(xValues.group().reduceCount())
        .gap(1)
        .xAxisLabel(var_x)
        .yAxisLabel('# of records')
        .render();

    var plainColor = "#6BAED6";

    var yVarsGroup = yVars.group().reduceCount();
    (<provisional>varDistributionChart)
        .width(300)
        .height(300)
        .elasticX(true)
        .dimension(yVars)
        .group(yVarsGroup)
        .ordering(function (d) {
            return -d.value;
        })
        .ordinalColors([plainColor])
        .render();

    (<provisional>reactionsChart)
        .width(300)
        .height(200)
        .elasticX(true)
        .dimension(reactions)
        .group(reactions.group().reduceCount())
        .ordering(function (d) {
            return -d.value;
        })
        .ordinalColors([plainColor])
        .render();

    (<provisional>observablesChart)// TODO: remove? is it useful or not?
        .width(300)
        .height(400)
        .elasticX(true)
        .dimension(observables)
        .group(observables.group().reduceCount())
        .ordering(function (d) {
            return -d.value;
        })
        .render();

    rowChartLabels(reactionsChart, '# of records', 'Reactions');
    rowChartLabels(varDistributionChart, '# of records', 'Dependent variables');
    rowChartLabels(observablesChart, '# of records', 'Observables');

    numberRecords
        .formatNumber(numRecordsFormat)
        .group(allCount)
        .valueAccessor(function (d) {
            return d.n;
        })
        .render();

    $('#variable-charts').empty();
    yVarsGroup.top(10).forEach(function (d, i) {
        var varY = <provisional>d.key;
        plotVariable(ndx, data, var_x, varY, minX, maxX, yVars)
    })
    yVars = null;

    return {
        yVarsDimension: yVars
    };
}