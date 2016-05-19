import {assertHas, assert} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {BubbleComponent} from "./BubbleComponent";

@KnockoutComponent('hep-bubble-focus', {
    template: `
    <!-- ko template: { nodes: $componentTemplateNodes } --><!-- /ko -->
    `,
})
export class BubbleFocusComponent {
    private _bubble: BubbleComponent = null;

    constructor(params: any) {
    }

    public setBubbleComponent(bubble: BubbleComponent) {
        assert(this._bubble == null);
        this._bubble = bubble;
    }

    public bubbleKeyHandler(nextHandler: (component: any, ev: KeyboardEvent) => boolean|undefined) {
        return (component: any, ev: KeyboardEvent) => {
            if (this._bubble) {
                const bubbleNext = this._bubble.keyHook(ev);
                if (bubbleNext) {
                    return nextHandler(component, ev);
                } else {
                    return false;
                }
            }
        }
    }

    public dispose() {
        ko.untrack(this);
    }
}
