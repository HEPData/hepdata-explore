export const recordCountFormat = function () {
    var numRecordsFormatD3 = d3.format('.2s');
    return function (num: number) {
        if (num >= 1000) {
            return numRecordsFormatD3(num);
        } else {
            return num.toFixed(0);
        }
    };
}();

// Make it global so it can be used in templates
(<any>window).recordCountFormat = recordCountFormat;