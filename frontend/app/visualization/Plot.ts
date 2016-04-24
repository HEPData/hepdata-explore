export class Plot {
    alive: boolean = false;
    canvas: HTMLElement = null;

    spawn() {

    }

    kill() {
        this.alive = false;
    }
}