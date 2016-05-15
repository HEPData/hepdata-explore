///<reference path="../typings/browser.d.ts"/>
// window.addEventListener('unhandledrejection', function (e: any) {
//     debugger;
// });

import {app} from "./AppViewModel";
window.onhashchange = function () {
    console.log('User changed hash: ' + location.hash);
    app.loadNewHash(location.hash);
};

(<any>window).app = app;
export = app;

ko.applyBindings(app);

(<any>window).print = function print(first: any, ...rest: any[]) {
    console.log(first, ...rest);
    return first;
};