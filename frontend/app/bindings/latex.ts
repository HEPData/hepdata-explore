// Adapted from http://checkmyworking.com/misc/knockout-mathjax-bindings/
// This binding is the same as the text binding, but runs MathJax on the element
// afterwards to typeset any maths.
// (Note the original binding from the linked page uses html instead of text
// binding)
declare var MathJax: any;

ko.bindingHandlers['latex'] = {
    update: function(element: HTMLElement, valueAccessor: any) {
        ko.bindingHandlers.text.update!.apply(this, arguments);
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, element]);
    }
}