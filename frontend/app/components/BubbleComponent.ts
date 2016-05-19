import {assertHas, assert} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import "../base/MyFocusChange";
import {focusedElement} from "../base/focusedElement";
import {bind} from "../decorators/bind";
import {observable} from "../decorators/observable";
import {computedObservable} from "../decorators/computedObservable";

interface Point {
    x: number;
    y: number;
}

function findBubbleFocusAncestor(element: Element): HTMLElement {
    if (element == null) {
        return null;
    } else if (element.tagName.toLowerCase() == 'hep-bubble-focus') {
        return <HTMLElement>element;
    } else {
        return findBubbleFocusAncestor(element.parentElement);
    }
}

function hasBubbleFocusAncestor(element: Element) {
    return findBubbleFocusAncestor(element) != null;
}

function findScrollableParents(element: HTMLElement, foundList: HTMLElement[] = []): HTMLElement[] {
    if (element == null) {
        return foundList;
    } else {
        const style = window.getComputedStyle(element);
        if (style['overflow-y'] == 'scroll' || style['overflow'] == 'scroll') {
            foundList.push(element);
        }
        return findScrollableParents(<HTMLElement>element.parentElement, foundList);
    }
}

/**
 * The bubble widget lives in one of three states that change in response to
 * UI events:
 *
 *          UNSELECTED <----------+
 *           ^      |             |
 *      blur |      | focus       |
 *           |      v             |
 *     SELECTED_WITH_BUBBLE       | blur
 *           ^      |             |
 *  char key |      | esc/return  |
 *           |      v             |
 *      SELECTED_NO_BUBBLE -------+
 */
enum BubbleState {
    UNSELECTED,
    SELECTED_WITH_BUBBLE,
    SELECTED_NO_BUBBLE,
}

enum BubbleEvent {
    FOCUS,
    BLUR,
    CHAR_KEY,
    ESC_OR_RETURN,
}

@KnockoutComponent('hep-bubble', {
    template: {fromUrl: 'bubble.html'},
})
export class BubbleComponent {
    /** Indicates on which side of the element the bubble will pop up. */
    @observable()
    side: 'up' | 'down' = 'down';

    @observable()
    maxHeight = 200;
    @observable()
    width = 300;

    /** The template receives CSS position here */
    @observable()
    styleTop: string = null;
    @observable()
    styleLeft: string = null;

    private $bubbleEvents = new Rx.Subject<BubbleEvent>();

    private bubbleState$ = this.$bubbleEvents
        .scan((prevState, event) => {
            if (prevState != BubbleState.UNSELECTED &&
                event == BubbleEvent.BLUR) {
                return BubbleState.UNSELECTED;
            }
            if (prevState == BubbleState.UNSELECTED &&
                event == BubbleEvent.FOCUS) {
                return BubbleState.SELECTED_WITH_BUBBLE;
            }
            if (prevState == BubbleState.SELECTED_WITH_BUBBLE &&
                event == BubbleEvent.ESC_OR_RETURN) {
                return BubbleState.SELECTED_NO_BUBBLE;
            }
            if (prevState == BubbleState.SELECTED_NO_BUBBLE &&
                event == BubbleEvent.CHAR_KEY) {
                return BubbleState.SELECTED_WITH_BUBBLE;
            }
            return prevState;
        }, BubbleState.UNSELECTED)
        .forEach(function (x) {
            console.log(x);
        });

    @computedObservable()
    get focused(): boolean {
        const element = focusedElement();
        const bubbleRoot = findBubbleFocusAncestor(element);
        if (!bubbleRoot) {
            return false;
        } else {
            // Check that *this* bubble element is inside the bubble root.
            return $(bubbleRoot).find(this._bubbleElement).length == 1;
        }
    };

    private _scrollableParents: HTMLElement[] = [];

    private _bubbleElement: HTMLElement;

    /** The element (usually an <input>) the bubble will appear near to. */
    private _linkedElement: HTMLElement = null;

    constructor(params: any) {
        assertHas(params, [
            {name: 'element', type: HTMLElement},
        ]);
        this._bubbleElement = params.element;
        if (params.width) {
            this.width = params.width;
        }
        (<any>window).a = this;

        this.side = 'down';

        ko.getObservable(this, 'focused').subscribe((focused: boolean) => {
            this.$bubbleEvents.onNext(focused ? BubbleEvent.FOCUS : BubbleEvent.BLUR);

            if (focused) {
                const bubbleRoot = findBubbleFocusAncestor(document.activeElement);
                this._linkedElement = this.findInputField(bubbleRoot);
                assert(this._linkedElement != null, 'Input field not found');
                this.calculatePosition();

                this._scrollableParents = findScrollableParents(this._linkedElement);
                for (let parent of this._scrollableParents) {
                    parent.addEventListener('scroll', this.scrollListener);
                }
            } else {
                for (let parent of this._scrollableParents) {
                    parent.removeEventListener('scroll', this.scrollListener);
                }
                this._scrollableParents = [];
            }
        });
    }

    public keyHandler(nextHandler: (ev: KeyboardEvent) => boolean|undefined) {
        return (ev: KeyboardEvent) => {
            return nextHandler(ev);
        }
    }

    private _ticking = false;
    @bind()
    private scrollListener(e: Event) {
        if (!this._ticking) {
            window.requestAnimationFrame(() => {
                this.calculatePosition();
                this._ticking = false;
            })
        }
        this._ticking = true;
    }

    private findInputField(bubbleFocusRoot: Element) {
        return <HTMLElement>bubbleFocusRoot.querySelector('input');
    }

    private calculatePosition() {
        // getBoundingClientRect() returns a rectangle with the offsets of the
        // element's margins measured from the respective borders of the
        // viewport.
        const elementRect = this._linkedElement.getBoundingClientRect();
        const tailX = elementRect.left + elementRect.width / 2;

        this.calculateSide();

        this.styleLeft = (tailX - this.width / 2) + 'px';

        // `styleTop` is used by the container div, which always measures
        // `this.width` x `this.maxHeight`.
        if (this.side == 'down') {
            // Place the container div below the linked element.
            this.styleTop = (elementRect.bottom) + 'px';
        } else {
            // Place the container div above the linked element.
            this.styleTop = (elementRect.top - this.maxHeight) + 'px';
        }
    }

    private calculateSide() {
        const elementRect = this._linkedElement.getBoundingClientRect();

        const spaceAbove = elementRect.top;
        const spaceBelow = document.documentElement.clientHeight - elementRect.bottom;

        if (spaceBelow > this.maxHeight) {
            this.side = 'down';
        } else if (spaceAbove > this.maxHeight) {
            this.side = 'up';
        } else {
            // No space in either... pick the biggest one
            this.side = spaceAbove > spaceBelow ? 'up' : 'down';
        }
    }

    public dispose() {
        ko.untrack(this);
    }

}
