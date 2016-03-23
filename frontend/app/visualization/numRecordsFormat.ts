const numRecordsFormat = function () {
    var numRecordsFormatD3 = d3.format('.2s');
    return function (num: number): string {
        if (num >= 1000) {
            return numRecordsFormatD3(num);
        } else {
            return num.toFixed(0);
        }
    };
}();

export = numRecordsFormat;