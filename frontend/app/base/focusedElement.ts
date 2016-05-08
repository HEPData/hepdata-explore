import {MyFocusChange} from "./MyFocusChange";

export const focusedElement = ko.observable(document.activeElement);

document.addEventListener('myfocuschange', (e: MyFocusChange) => {
    focusedElement(e.after);
});