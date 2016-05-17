///<reference path="../typings/browser.d.ts"/>
// window.addEventListener('unhandledrejection', function (e: any) {
//     debugger;
// });

import {app} from "./AppViewModel";

(<any>window).app = app;
export = app;

ko.applyBindings(app);