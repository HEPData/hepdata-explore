/** This binding is used to pass DOM elements to view models.
 *
 * Example of use:
 *
 *  function MyViewModel() {
 *    this.bindCanvas = function(canvas) {
 *      this.canvas = canvas;
 *    };
 *  }
 *
 *  <canvas data-bind="leak: bindCanvas"></canvas>
 */
ko.bindingHandlers['leak'] = {
    init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        const leakFunction: Function = valueAccessor();
        leakFunction.call(viewModel, element);
    }
};