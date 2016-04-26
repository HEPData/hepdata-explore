export abstract class PlotLayer {
    canvas = new HTMLCanvasElement;

    abstract clean(): void;
    abstract draw(): void;
}