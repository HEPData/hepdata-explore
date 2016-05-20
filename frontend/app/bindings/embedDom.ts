import {assertInstance} from "../utils/assert";

/** This binding is used to embed DOM elements from a view model into views.
 *
 * Yeah, normally it should work the other way around, but I don't feel like
 * handing over canvas management to knockout.js.
 *
 * Example of use:
 *
 *  function MyViewModel() {
 *    this.myDiv = document.createElement('div');
 *    this.myDiv.textContent = 'Hi';
 *  }
 *
 *  <div data-bind="embedDom: myDiv"></div>
 */
ko.bindingHandlers['embedDom'] = {
    init: function (element: HTMLElement, valueAccessor: Function) {
        const embeddable: HTMLElement = valueAccessor();
        assertInstance(embeddable, HTMLElement);
        try {
            // Clear previous node contents, if any
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
            // Insert the embeddable
            element.insertBefore(embeddable, null);
        } catch (err) {
            console.error('Error inside embedDom binding: %s', err.message);
            console.error(err.stack);
        }
    }
};