/** The DOM does not have an event that is triggered when the focused element
 * changes, indicating the old and the new element, so here it is...
 *
 * 'myfocuschange' event.
 *
 * "My" is a bit ambiguous in that it does not say whom it belongs, but one
 * thing is sure: not to W3C. That's probably enough to avoid a collision in
 * case at some point in the future the 'focuschange' event becomes a standard.
 *
 * This event is similar to monitoring `document.activeElement` (without the
 * overhead of polling).
 *
 * Requires a `setImmediate()` implementation. For instance:
 *
 *   https://github.com/YuzuJS/setImmediate
 *
 * ---
 * This file is licensed independently from the rest of HEPData Explore to allow
 * easier reuse in other projects.
 *
 * Copyright (c) 2016 Juan Luis Boya García
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**

 Example usage, lights in yellow the focused element:

 document.addEventListener('myfocuschange', function (e: MyFocusChange) {
     e.after.style.backgroundColor = 'yellow';
     e.before.style.backgroundColor = '';
 });

 */

export interface MyFocusChange extends CustomEvent {
    /** The element that lost focus just now.
     *
     * It equals `document.body` if there was no selected element (the same
     * behavior as `document.activeElement`).
     */
    before: HTMLElement;

    /** The element that gained focus just now.
     *
     * It equals `document.body` if there was no selected element (the same
     * behavior as `document.activeElement`).
     */
    after: HTMLElement;
}

// We only pay attention to the focus element there is no focused element,
// in other cases we rely on setImmediate() and document.activeElement.
let listenFocus = (document.activeElement == document.body);

document.addEventListener('focus', (e) => {
    // Firefox triggers focus/blur events when the browser itself is focused or
    // unfocused.
    if (e.target === <any>document) {
        return;
    }

    if (listenFocus) {
        // IE focuses body sometimes. We're not interested in that.
        if (e.target === document.body) {
            console.log('IE focuses body');
            return;
        }
        listenFocus = false;

        var before = document.body;
        var after = <HTMLElement>e.target;

        var event = <MyFocusChange>document.createEvent('CustomEvent');
        event.initEvent('myfocuschange', true, true);
        event.before = before;
        event.after = after;
        document.dispatchEvent(event);
    }
}, true); // note we listen to the capturing event, as the 'focus' event does not bubble up

document.addEventListener('blur', (e) => {
    // Firefox triggers focus/blur events when the browser itself is focused or
    // unfocused.
    if (e.target === <any>document) {
        return;
    }

    // IE blurs body when the page loads. Other browsers only blur other
    // elements.
    if (e.target === document.body) {
        return;
    }

    setImmediate(() => {
        var before = <HTMLElement>e.target;
        var after = <HTMLElement>document.activeElement;
        if (before === after) {
            return;
        }

        if (document.activeElement == document.body) {
            listenFocus = true;
        }

        var event = <MyFocusChange>document.createEvent('CustomEvent');
        event.initEvent('myfocuschange', true, true);
        event.before = before;
        event.after = after;
        document.dispatchEvent(event);
    })
}, true); // note we listen to the capturing event, as the 'blur' event does not bubble up
