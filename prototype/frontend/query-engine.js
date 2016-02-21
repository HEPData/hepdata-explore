'use strict';

Promise.config({
  cancellation: true
});

function RuntimeError(message) {
  this.name = 'RuntimeError';
  this.message = message || 'A problem has been detected';
  this.stack = (new Error()).stack;
}
RuntimeError.prototype = Object.create(Error.prototype);
RuntimeError.prototype.constructor = RuntimeError;

function ServerError(message) {
  this.name = 'ServerError';
  this.message = message || 'The server returned an invalid response';
  this.stack = (new Error()).stack;
}
ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;

function assert(value, message) {
  if (!value) {
    throw new RuntimeError(message || "Assertion failed")
  }
}

function customScatterPlot(parent, chartGroup) {
  var _chart = dc.scatterPlot(parent, chartGroup);
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


    dc.transition(symbols, _chart.transitionDuration())
      .attr('opacity', function (d) {
        return _existenceAccessor(d) ? 1 : 0;
      })
      .attr('fill', _chart.getColor)
      .attr('transform', _locator)
      .attr('d', _symbol);

    dc.transition(symbols.exit(), _chart.transitionDuration())
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

var dataGrouped;

var numRecordsFormat = function () {
  var numRecordsFormatD3 = d3.format('.2s');
  return function (num) {
    if (num >= 1000) {
      return numRecordsFormatD3(num);
    } else {
      return num.toFixed(0);
    }
  };
}();

function asyncFetch(xhr, data) {
  return new Promise(function (resolve, reject, onCancel) {
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ServerError());
      }
    };
    xhr.onerror = reject;
    xhr.send(data || null);

    onCancel(function () {
      xhr.abort();
    })
  });
}

function asyncFetchJSON(path) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', path, true);
  return asyncFetch(xhr)
    .then(function () {
      return JSON.parse(xhr.responseText)
    })
}

function asyncFetchLineDelimited(path) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', path, true);
  return asyncFetch(xhr)
    .then(function () {
      return xhr.responseText.split('\n')
    })
}

function asyncFetchBinary(path) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', path, true);
  xhr.responseType = 'arraybuffer';
  return asyncFetch(xhr)
    .then(function () {
      return xhr.response;
    })
}

var elasticUrl = 'http://localhost:9200/hepdata/publication/_search';

function asyncFetchElastic(varX) {
  var xhr = new XMLHttpRequest()
  xhr.open('POST', elasticUrl, true)
  return asyncFetch(xhr, JSON.stringify({
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

      _.each(results.hits.hits, function (hit) {
        var publication = hit._source
        _.each(publication.tables, function (table) {
          _.each(table.groups, function (group) {
            if (!(group.var_x == varX)) {
              return false;
            }
            _.each(group.data_points, function (dataPoint) {
              var flatDataPoint = {
                inspire_record: publication.inspire_record,
                table_num: table.table_num,
                cmenergies1: group.cmenergies[0],
                cmenergies2: group.cmenergies[1],
                reaction: group.reaction,
                observables: table.observables,
                var_y: group.var_y,
                var_x: group.var_x,
                x_low: dataPoint.x_low,
                x_high: dataPoint.x_high,
                x_center: (dataPoint.x_low + dataPoint.x_high) / 2,
                y: dataPoint.y,
                errors: dataPoint.errors
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
        .sortBy(function(d) { return -d.recordCount })
        .value()

      return variables
    })
}

function decodeRecords(buf, strings) {
  var records = [];
  var dv = new DataView(buf);
  var pos = 0;

  function readUint8() {
    var ret = dv.getUint8(pos);
    pos += 1;
    return ret;
  }

  function readVarint() {
    var piece = readUint8();
    if (piece <= 0x7f) {
      return piece;
    } else {
      return (readVarint() << 7) | (piece & 0x7f);
    }
  }

  function readUint32() {
    var ret = dv.getUint32(pos, true);
    pos += 4;
    return ret;
  }

  var readSize = readVarint;

  function readFloat() {
    var ret = dv.getFloat32(pos, true);
    pos += 4;
    return ret;
  }

  function readString() {
    var length = readSize();
    var stringBinary = new Uint8Array(dv.buffer, pos, length);
    pos += length;
    return Utf8ArrayToStr(stringBinary);
  }

  function readList(itemFn) {
    var length = readSize();
    var ret = []
    for (var i = 0; i < length; i++) {
      ret.push(itemFn());
    }
    return ret;
  }

  function readErrors() {
    return readList(function readError() {
      var errorLabelId = readVarint();
      var plus = readFloat();
      var minus = readFloat();

      var errorLabel = strings[errorLabelId];
      assert(errorLabel !== undefined);

      return {plus: plus, minus: minus, errorLabel: errorLabel};
    })
  }

  while (pos < dv.byteLength) {
    var inspire_record = readVarint();
    var table_num = readVarint();
    var cmenergies1 = readFloat();
    var cmenergies2 = readFloat();
    var reaction = readString();
    var observables = readString();
    var var_y = readString();

    var numRecords = readSize();
    for (var i = 0; i < numRecords; i++) {
      var record = {
        inspire_record: inspire_record,
        table_num: table_num,
        cmenergies1: cmenergies1,
        cmenergies2: cmenergies2,
        reaction: reaction,
        observables: observables,
        var_y: var_y
      };
      record.x_low = readFloat();
      record.x_high = readFloat();
      record.x_center = (record.x_high + record.x_low) / 2;
      record.y = readFloat();
      record.errors = readErrors();
      records.push(record)
    }
  }
  return records;
}

function showGraphsByVarX(var_x) {
  var data = dataGrouped[var_x];
  showGraphs(data, var_x)
}

function rowChartLabels(chart, xLabel, yLabel) {
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

function plotVariable(ndx, data, var_x, var_y, minX, maxX, yVars) {
  var dimension = ndx.dimension(function (d, i) {
    var ret = [d.x_center, d.y];
    ret.var_y = d.var_y;
    ret.inspire_record = d.inspire_record;
    ret.table_num = d.table_num;
    return ret;
  });

  var newDiv = $('<div/>');
  var chart = customScatterPlot(newDiv[0]);
  $('#variable-charts').append(newDiv);
  chart
    .width(300)
    .height(300)
    .data(function (d) {
      return _.filter(d.all(), function (d, i) {
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
  window.chart = chart
}


function showGraphs(data, var_x) {
  var ndx = crossfilter(data);
  var all = ndx.groupAll();

  var allVarsChart = dc.barChart('#all-vars-chart');
  var varDistributionChart = dc.rowChart('#variable-distribution-chart');
  var numberRecords = dc.numberDisplay('#number-records');
  var reactionsChart = dc.rowChart('#reactions-chart');
  var observablesChart = dc.rowChart('#observables-chart');

  var xValues = ndx.dimension(function (d, i) {
    return d.x_center;
  });
  var yVars = ndx.dimension(function (d, i) {
    return d.var_y;
  });
  var reactions = ndx.dimension(function (d, i) {
    return d.reaction;
  });
  var observables = ndx.dimension(function (d, i) {
    return d.observables;
  });
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

  allVarsChart
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
  varDistributionChart
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

  reactionsChart
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

  observablesChart// TODO: remove? is it useful or not?
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
    var varY = d.key;
    plotVariable(ndx, data, var_x, varY, minX, maxX, yVars)
  })
  var yVars = null;

  return {
    yVarsDimension: yVars
  };
}

function screenUpdated() {
  return new Promise(function (resolve, reject) {
    window.requestAnimationFrame(resolve)
  });
}


function HepdataExplore(dataUrlPrefix) {
  var obj = {};

  obj.loadVariablePromise = Promise.resolve();
  obj.yVarsDimension = null;

  function run() {
    return asyncFetchIndependentVariables()
      .then(function (indepVars) {
        obj.indepVars = indepVars

        $('#indepVarSelect')
          .html(
            _.map(obj.indepVars, function (d, i) {
              return $('<option/>', {
                value: i,
                text: d.name + ' [' + numRecordsFormat(d.recordCount) + ' records]'
              });
            })
          )
          .on('change', function (ev) {
            var index = $(this).val();
            varXChosen(obj.indepVars[index]);
          })
          .trigger('change');

        $('#download-yaml').on('click', function (ev) {
          ev.preventDefault();
          if (obj.yVarsDimension) {
            downloadSelectionAsYaml(obj.yVarsDimension);
          }
        });

        return null;
      })
  }

  function varXChosen(xVar) {
    obj.loadVariablePromise.cancel();

    $('#visualization').hide()
    $('#visualization-loading').show()

    $('#loading-downloading').css({visibility: 'visible'});
    $('#loading-processing').css({visibility: 'hidden'});

    var dir = dataUrlPrefix + '/' + xVar.dirName;
    obj.loadVariablePromise = asyncFetchElastic(xVar.name)
      .then(function (result) {
        // Update the UI before proceeding with heavy computation
        $('#loading-downloading').css({visibility: 'hidden'});
        $('#loading-processing').css({visibility: 'visible'});
        return screenUpdated().then(function () {
          return result;
        });
      }).then(function (result) {
        obj.dataPoints = result;
        var t1 = performance.now();
        var ret = showGraphs(result, xVar.name);
        var t2 = performance.now();
        console.log("Data indexed in %.2f ms.", t2 - t1);

        obj.yVarsDimension = ret.yVarsDimension;

        $('#visualization').show()
        $('#visualization-loading').hide()
      })
  }

  function downloadSelectionAsYaml(dimension) {
    var content = jsyaml.dump(dimension.top(Infinity));
    var blob = new Blob([content], {type: "text/x-yaml;charset=utf-8"});
    saveAs(blob, "hepdata_selection.yaml");
  }

  return {
    run: run,
    private: obj
  }
}

setTimeout(function () {
  window.hepdata = new HepdataExplore('data');
  window.hepdata.run();
}, 0);

