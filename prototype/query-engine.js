'use strict';

var dataGrouped;
var indepVars;

var numRecordsFormat = function() {
  var numRecordsFormatD3 = d3.format('.2s');
  return function(num) {
    if (num >= 1000) {
      return numRecordsFormatD3(num);
    } else {
      return num;
    }
  };
}();

function readFromCSV() {
  d3.csv('data.csv', function(data) {
    data.forEach(function(d) {
      d.y = +d.y;
      d.x_low = +d.x_low;
      d.x_high = +d.x_high;
    })

    startVis(data);
  })
}

function readFromBinary() {
  var req = new XMLHttpRequest()
  req.open('GET', 'data.bin', true)
  req.responseType = 'arraybuffer';

  req.onload = function(event) {
    var data = decodeBinaryFormat(req.response);
    startVis(data)
  }
  req.send(null)
}

function decodeBinaryFormat(buf) {
  var records = []
  var dv = new DataView(buf);
  var pos = 0;

  function readSize() {
    var ret = dv.getUint32(pos, true)
    pos += 4;
    return ret;
  }
  function readFloat() {
    var ret = dv.getFloat32(pos, true)
    pos += 4;
    return ret;
  }
  function readString() {
    var length = readSize();
    var stringBinary = new Uint8Array(dv.buffer, pos, length)
    pos += length;
    return Utf8ArrayToStr(stringBinary);
  }

  while (pos < dv.byteLength) {
    var group = {}
    group.cmenergies = readFloat()
    group.reaction = readString()
    group.observables = readString()
    group.var_x = readString()
    group.var_y = readString()

    var numRecords = readSize()
    for (var i = 0; i < numRecords; i++) {
      var record = _.clone(group)
      record.x_low = readFloat()
      record.x_high = readFloat()
      record.y = readFloat()
      records.push(record)
    }
  }
  return records;
}
function startVis(data) {
  // group by xVar
  dataGrouped = _.groupBy(data, function(d,i) {
    return d.var_x;
  })
  // independent variables sorted by more to less elements
  var indepVars = _.sortBy(_.keys(dataGrouped), function(d,i) {
    return -dataGrouped[d].length;
  })

  $('#indepVarSelect')
    .html(
      _.map(indepVars, function(d,i) {
        var numberRecords = dataGrouped[d].length;
        return $('<option/>', {
          value: d,
          text: d + ' [' + numRecordsFormat(numberRecords) + ' records]'
        });
      })
    )
    .on('change', function(ev) {
      updateVarXChooser()
    })

  updateVarXChooser()
}

function updateVarXChooser() {
  showGraphsByVarX($('#indepVarSelect').val())
}

function showGraphsByVarX(var_x) {
  var data = dataGrouped[var_x]
  showGraphs(data, var_x)
}

function rowChartLabels(chart, xLabel, yLabel) {
  chart.svg()
    .append('text')
    .attr('class', 'x-axis-label')
    .attr("text-anchor", "middle")
    .attr("x", chart.width()/2)
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

function mean_x(d) {
  return (d.x_low + d.x_high) / 2;
}

function plotVariable(ndx, data, var_x, var_y, minX, maxX, yVars) {
  var dimension = ndx.dimension(function(d,i) {
    var ret = [mean_x(d), d.y]
    ret.var_y = d.var_y
    return ret;
  })

  var newDiv = $('<div/>')
  var chart = dc.scatterPlot(newDiv[0])
  $('#variable-charts').append(newDiv)
  chart
    .width(300)
    .height(300)
    .data(function(d) {
      return _.filter(d.all(), function(d,i) {
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
    .brushOn(true)

  chart.yAxis()
    .tickFormat(d3.format(".2s"))

  chart.render()
  window.chart = chart
}


function showGraphs(data, var_x) {
  var ndx = crossfilter(data);
  var all = ndx.groupAll();

  var allVarsChart = dc.barChart('#all-vars-chart')
  var varDistributionChart = dc.rowChart('#variable-distribution-chart')
  var numberRecords = dc.numberDisplay('#number-records')
  var reactionsChart = dc.rowChart('#reactions-chart')
  var observablesChart = dc.rowChart('#observables-chart')

  var xValues = ndx.dimension(function(d,i) {
    return (d.x_low + d.x_high) / 2;
  });
  var yValues = ndx.dimension(function(d,i) {
    return d.y;
  });
  var yVars = ndx.dimension(function(d,i) {
    return d.var_y;
  })
  var reactions = ndx.dimension(function(d,i) {
    return d.reaction;
  })
  var observables = ndx.dimension(function(d,i) {
    return d.observables;
  })
  var allCount = ndx.groupAll().reduce(function(p,v) {
    p.n++;
    return p;
  }, function(p,v) {
    p.n--;
    return p;
  }, function() {
    return {n: 0};
  })

  var minX = _.min(data, function(d,i) {
    return d.x_low;
  }).x_low;
  var maxX = _.max(data, function(d,i) {
    return d.x_high;
  }).x_high;

  allVarsChart
    .width(900)
    .height(250)
    .margins({top: 10, right: 50, bottom: 30, left: 40})
    .x(d3.scale.pow().exponent(.5).domain([minX, maxX]))
 //     .x(d3.scale.linear().domain([minX, maxX]))
    .dimension(xValues)
    .group(xValues.group().reduceCount())
    .gap(1)
    .xAxisLabel(var_x)
    .yAxisLabel('# of records')
    .render()

  var yVarsGroup = yVars.group().reduceCount();
  varDistributionChart
    .width(300)
    .height(400)
    .elasticX(true)
    .dimension(yVars)
    .group(yVarsGroup)
    .render()

  reactionsChart
    .width(300)
    .height(400)
    .elasticX(true)
    .dimension(reactions)
    .group(reactions.group().reduceCount())
    .render()

  observablesChart
    .width(300)
    .height(400)
    .elasticX(true)
    .dimension(observables)
    .group(observables.group().reduceCount())
    .render()

  rowChartLabels(reactionsChart, '# of records', 'Reactions')
  rowChartLabels(varDistributionChart, '# of records', 'Dependent variables')
  rowChartLabels(observablesChart, '# of records', 'Observables')

  numberRecords
    .formatNumber(d3.format(".2s"))
    .group(allCount)
    .valueAccessor(function(d) {
      return d.n;
    })
    .render()

  $('#variable-charts').empty()
  yVarsGroup.top(10).forEach(function(d,i) {
    var varY = d.key
    plotVariable(ndx, data, var_x, varY, minX, maxX, yVars)
  })
}

readFromBinary()
