import {assertHas, assert, AssertionError} from "../utils/assert";
import {KnockoutComponent} from "../decorators/KnockoutComponent";
import "../base/MyFocusChange";
import {focusedElement} from "../base/focusedElement";
import {bind} from "../decorators/bind";
import {observable} from "../decorators/observable";
import {computedObservable} from "../decorators/computedObservable";
import {BubbleFocusComponent} from "./BubbleFocusComponent";
import {KeyCode} from "../utils/KeyCode";
import IDisposable = Rx.IDisposable;

interface Point {
    x: number;
    y: number;
}

function findBubbleFocusAncestor(element: Element|null): HTMLElement|null {
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

function findScrollableParents(element: HTMLElement|null, foundList: HTMLElement[] = []): HTMLElement[] {
    if (element == null) {
        return foundList;
    } else {
        const style = window.getComputedStyle(element);
        if (style.overflowY == 'scroll' || style.overflow == 'scroll') {
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
    Unselected,
    SelectedWithBubble,
    SelectedNoBubble,
}

enum BubbleEvent {
    Focus,
    Blur,
    CharKey,
    EscOrReturn,
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
    styleTop: string|null = null;
    @observable()
    styleLeft: string|null = null;

    @observable()
    currentBubbleState = BubbleState.Unselected;

    @computedObservable()
    get visible() {
        return (this.currentBubbleState == BubbleState.SelectedWithBubble);
    }

    private $bubbleEvents = new Rx.Subject<BubbleEvent>();

    /**
     * If the bubble is focused, returns the bubble root.
     * Otherwise, returns null.
     */
    @computedObservable()
    get focusedBubbleRoot(): HTMLElement|null {
        assert(this._bubbleElement != null);
        const element = focusedElement();
        const bubbleRoot = findBubbleFocusAncestor(element);
        if (!bubbleRoot) {
            return null;
        } else {
            // Check that *this* bubble element is inside the bubble root.
            if ($(bubbleRoot).find(this._bubbleElement).length == 1) {
                return bubbleRoot;
            } else {
                return null;
            }
        }
    };

    private _scrollableParents: HTMLElement[] = [];

    private _bubbleElement: HTMLElement;

    /** The element (usually an <input>) the bubble will appear near to. */
    private _linkedElement: HTMLElement|null = null;

    private _disposables: IDisposable[] = [];

    constructor(params: any) {
        assertHas(params, [
            {name: 'element', type: HTMLElement},
            {name: 'bubbleFocus', type: BubbleFocusComponent},
        ]);
        this._bubbleElement = params.element;
        if (params.width) {
            this.width = params.width;
        }
        (<BubbleFocusComponent>params.bubbleFocus).setBubbleComponent(this);

        this.side = 'down';

        this._disposables.push(
            // Update `currentBubbleState` in response to events
            this.$bubbleEvents
            .scan((prevState, event) => {
                if (event == BubbleEvent.Blur) {
                    return BubbleState.Unselected;
                }
                if (prevState == BubbleState.Unselected &&
                    event == BubbleEvent.Focus) {
                    return BubbleState.SelectedWithBubble;
                }
                if (prevState == BubbleState.SelectedWithBubble &&
                    event == BubbleEvent.EscOrReturn) {
                    return BubbleState.SelectedNoBubble;
                }
                if (prevState == BubbleState.SelectedNoBubble &&
                    event == BubbleEvent.CharKey) {
                    return BubbleState.SelectedWithBubble;
                }
                return prevState;
            }, BubbleState.Unselected)
            .distinctUntilChanged()
            .forEach((state) => {
                this.currentBubbleState = state
            }));

        this._disposables.push((<KnockoutObservable<HTMLElement|null>>
            // Each time the focus is switched to enter or exit the BubbleFocusComponent
            ko.getObservable(this, 'focusedBubbleRoot'))
            .toObservableWithReplyLatest()
            // Handle the focus event
            .do(focusedBubbleRoot => {
                this.$bubbleEvents.onNext(focusedBubbleRoot
                    ? BubbleEvent.Focus
                    : BubbleEvent.Blur);
            })
            .forEach(focusedBubbleRoot => {
                if (focusedBubbleRoot) {
                    // On focus:

                    // Update _linkedElement to be the only input field within
                    // the BubbleFocusComponent
                    this._linkedElement = this.findInputField(focusedBubbleRoot);
                    assert(this._linkedElement != null, 'Input field not found');

                    // Position the bubble near the linked element
                    this.calculateAndUpdatePosition();

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
            }));

    }

    public keyDownHook(ev: KeyboardEvent) {
        if (ev.keyCode == KeyCode.Escape) {
            const bubbleWasVisible = this.visible;

            this.$bubbleEvents.onNext(BubbleEvent.EscOrReturn);
            if (bubbleWasVisible) {
                // Don't bubble (avoid closing modal dialog)
                ev.stopImmediatePropagation();
            } // the modal would be closed if the bubble was not visible already though
            return false;
        } else if (ev.keyCode == KeyCode.Return) {
            this.$bubbleEvents.onNext(BubbleEvent.EscOrReturn);
        }
        return true;
    }

    public keyPressHook(ev: KeyboardEvent) {
        this.$bubbleEvents.onNext(BubbleEvent.CharKey);
        return true;
    }

    private _ticking = false;

    @bind()
    private scrollListener(e: Event) {
        if (!this._ticking) {
            window.requestAnimationFrame(() => {
                this.calculateAndUpdatePosition();
                this._ticking = false;
            })
        }
        this._ticking = true;
    }

    private findInputField(bubbleFocusRoot: Element) {
        return <HTMLElement|null>bubbleFocusRoot.querySelector('input');
    }

    private calculateAndUpdatePosition() {
        // getBoundingClientRect() returns a rectangle with the offsets of the
        // element's margins measured from the respective borders of the
        // viewport.
        const elementRect = this._linkedElement!.getBoundingClientRect();
        const tailX = elementRect.left + elementRect.width / 2;

        this.side = this.calculateSide();

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

    private calculateSide(): 'up'|'down' {
        const elementRect = this._linkedElement!.getBoundingClientRect();

        const spaceAbove = elementRect.top;
        const spaceBelow = document.documentElement.clientHeight - elementRect.bottom;

        if (spaceBelow > this.maxHeight) {
            return 'down';
        } else if (spaceAbove > this.maxHeight) {
            return 'up';
        } else {
            // No space in either... pick the biggest one
            return spaceAbove > spaceBelow ? 'up' : 'down';
        }
    }

    public dispose() {
        console.log('disposeadnioaeoe');
        ko.untrack(this);
        for (let disposable of this._disposables) {
            disposable.dispose();
        }
    }

}
