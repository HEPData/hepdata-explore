// awesome solution from http://www.knockmeout.net/2013/06/knockout-debugging-strategies-plugin.html
(function() {
  var existing = ko.bindingProvider.instance;

  ko.bindingProvider.instance = {
    nodeHasBindings: existing.nodeHasBindings,
    getBindings: function(node, bindingContext) {
      var bindings;
      try {
        bindings = existing.getBindings(node, bindingContext);
      }
      catch (ex) {
        if (window.console && console.log) {
          console.error("binding error", ex.message, node, bindingContext);
        }
      }

      return bindings;
    }
  };
})();