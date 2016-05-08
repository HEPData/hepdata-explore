import {assertHas, assertInstance, assert} from "../utils/assert";
import {KnockoutComponent} from "../base/KnockoutComponent";
import "../base/MyFocusChange";
import {focusedElement} from "../base/focusedElement";
import {imap, map} from "../utils/map";

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

@KnockoutComponent('hep-bubble', {
    template: {fromUrl: 'bubble.html'},
})
export class BubbleComponent {
    /** The element (usually an <input>) the bubble will appear near to. */
    linkedElement: HTMLElement = null;

    /** Indicates on which side of the element the bubble will pop up. */
    side: 'up' | 'down' = 'down';

    maxHeight = 200;
    width = 300;

    styleTop: string = null;
    styleLeft: string = null;

    visible: KnockoutComputed<boolean> = ko.computed(() => {
        const element = focusedElement();
        const bubbleRoot = findBubbleFocusAncestor(element);
        if (!bubbleRoot) {
            return false;
        } else {
            // Check that *this* bubble element is inside the bubble root.
            return $(bubbleRoot).find(this._bubbleElement).length == 1;
        }
    });

    private _scrollableParents: HTMLElement[] = [];

    private _bubbleElement: HTMLElement;

    constructor(params: any) {
        assertHas(params, [
            {name: 'element', type: HTMLElement},
        ]);
        this._bubbleElement = params.element;

        this.side = 'down';
        this.scrollListener = this.scrollListener.bind(this);

        ko.track(this);

        ko.getObservable(this, 'visible').subscribe((visible: boolean) => {
            if (visible) {
                const bubbleRoot = findBubbleFocusAncestor(document.activeElement);
                this.linkedElement = this.findInputField(bubbleRoot);
                assert(this.linkedElement != null, 'Input field not found');
                this.calculatePosition();

                this._scrollableParents = findScrollableParents(this.linkedElement);
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

    private _ticking = false;
    scrollListener(e: Event) {
        if (!this._ticking) {
            window.requestAnimationFrame(() => {
                this.calculatePosition();
                this._ticking = false;
            })
        }
        this._ticking = true;
    }

    findInputField(bubbleFocusRoot: Element) {
        return <HTMLElement>bubbleFocusRoot.querySelector('input');
    }

    calculatePosition() {
        // getBoundingClientRect() returns a rectangle with the offsets of the
        // element's margins measured from the respective borders of the
        // viewport.
        const elementRect = this.linkedElement.getBoundingClientRect();
        const tailX = elementRect.left + elementRect.width / 2;

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


}
