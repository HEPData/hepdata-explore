import {observable} from "../decorators/observable";
import {bind} from "../decorators/bind";
import {computedObservable} from "../decorators/computedObservable";

export class ModalClosed extends Error {
}

export class ModalWindow<VM> {
    @observable()
    visible: boolean = false;

    @observable()
    viewModel: VM|null = null;

    @observable()
    primaryLabel: string|null = null;
    
    @computedObservable()
    get templateData() {
        return this.viewModel || {error: 'viewModel not set'};
    }

    private confirmed = false;
    private resolve: Function|null = null;
    private reject: Function|null = null;
    private subscription: KnockoutSubscription;

    constructor() {
        this.subscription = ko.getObservable(this, 'visible')
            .subscribe((visible: boolean) => {
                if (visible == false) {
                    if (this.confirmed && this.resolve) {
                        this.resolve(this.viewModel);
                    }
                    if (!this.confirmed && this.reject) {
                        this.reject(new ModalClosed());
                    }

                    // Reset the state of the ModalWindow
                    this.resolve = this.reject = null;
                    this.viewModel = null;
                    this.confirmed = false;
                }
            });
    }

    show(primaryLabel: string|null, viewModel: VM) {
        this.primaryLabel = primaryLabel;
        this.viewModel = viewModel;
        this.visible = true;
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    @bind()
    confirm() {
        this.confirmed = true;
        this.visible = false;
    }

    /**
     * The action property of knockstrap modal.
     *
     * Return the confirm function if a primary button label has been set, which
     * will cause knockstrap to include the primary button.
     *
     * In other case, returns null, which will cause it to not create the
     * button.
     */
    @computedObservable()
    get action(): Function|null {
        if (this.primaryLabel != null) {
            return this.confirm;
        } else {
            return null;
        }
    }

    dispose() {
        this.subscription.dispose();
        ko.untrack(this);
    }
}