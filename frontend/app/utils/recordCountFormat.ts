export const recordCountFormat = function () {
    var numRecordsFormatD3 = d3.format('.2s');
    return function (num) {
        if (num >= 1000) {
            return numRecordsFormatD3(num);
        } else {
            return num.toFixed(0);
        }
    };
}();

// Make it global so it can be used in templates
window.recordCountFormat = recordCountFormat;