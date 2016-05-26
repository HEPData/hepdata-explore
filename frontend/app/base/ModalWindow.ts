import {observable} from "../decorators/observable";
import {bind} from "../decorators/bind";

export class ModalClosed extends Error {
}

export class ModalWindow {
    @observable()
    visible: boolean = false;

    private confirmed = false;
    private resolve: Function|null = null;
    private reject: Function|null = null;
    private subscription: KnockoutSubscription;

    constructor() {
        this.subscription = ko.getObservable(this, 'visible')
            .subscribe((visible: boolean) => {
                if (visible == false) {
                    if (this.confirmed && this.resolve) {
                        this.resolve();
                    }
                    if (!this.confirmed && this.reject) {
                        this.reject(new ModalClosed());
                    }
                }
            });
    }

    show() {
        this.confirmed = false;
        this.visible = true;
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        })
    }

    @bind()
    confirm() {
        this.confirmed = true;
        this.visible = false;
    }

    dispose() {
        this.subscription.dispose();
    }
}