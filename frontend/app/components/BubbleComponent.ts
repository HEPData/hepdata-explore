import {assertHas, assertInstance} from "../utils/assert";
import {KnockoutComponent} from "../base/KnockoutComponent";

interface Point {
    x: number;
    y: number;
}

@KnockoutComponent('hep-bubble', {
    template: { fromUrl: 'bubble.html' },
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

    /** Position of the bubble tail, as an offset of the viewport */
    tailX = 0;
    tailY = 0;

    constructor(params: any) {
        assertHas(params, [
        ]);

        this.side = 'down';


        ko.track(this);

        let ticking = false;
        setTimeout(() => {
            this.linkedElement = <HTMLElement>document.querySelector('new-filter input');
            this.calculatePosition();

            document.querySelector('.sidebar').addEventListener('scroll', (e) => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        this.calculatePosition();
                        ticking = false;
                    })
                }
                ticking = true;
            })

            document.querySelector('.bubble').addEventListener('wheel', (e) => {
                var target = document.querySelector('.sidebar');
                console.log(e);
                const newEvent = new WheelEvent('wheel', e);
                console.log(newEvent);
                target.dispatchEvent(newEvent);
            })
        }, 1000);
    }

    calculateTailPosition() {
        let x, y;

        // getBoundingClientRect() returns a rectangle with the offsets of the
        // element's margins measured from the respective borders of the
        // viewport.
        const rect = this.linkedElement.getBoundingClientRect();

        x = (rect.left + rect.width) / 2;

        if (this.side == 'down') {
            y = rect.bottom;
        } else {
            y = rect.top;
        }

        return {x: x, y: y}
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
