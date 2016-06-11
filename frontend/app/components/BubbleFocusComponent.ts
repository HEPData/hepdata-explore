import {assert} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import {BubbleComponent} from "./BubbleComponent";

@KnockoutComponent('hep-bubble-focus', {
    template: `
    <!-- ko template: { nodes: $componentTemplateNodes } --><!-- /ko -->
    `,
})
export class BubbleFocusComponent {
    private _bubble: BubbleComponent|null = null;

    constructor(params: any) {
    }

    public setBubbleComponent(bubble: BubbleComponent) {
        assert(this._bubble == null);
        this._bubble = bubble;
    }

    /**
     * Returns event handlers to use in the input field where the bubble will
     * pop out.
     *
     * @param nextKeyDownHandler Regular keyDown handler that will be called
     * when the event is not consumed by the bubble.
     */
    public bubbleKeyHandlers(nextKeyDownHandler: (component: any, ev: KeyboardEvent) => boolean|undefined) {
        return {
            keydown: (component: any, ev: KeyboardEvent) => {
                if (this._bubble) {
                    const bubbleNext = this._bubble.keyDownHook(ev);
                    if (bubbleNext) {
                        return nextKeyDownHandler(component, ev);
                    } else {
                        return false;
                    }
                }
            },
            keypress: (component: any, ev: KeyboardEvent) => {
                if (this._bubble) {
                    return this._bubble.keyPressHook(ev);
                }
            }
        } 
    }

    public dispose() {
        ko.untrack(this);
    }
}
