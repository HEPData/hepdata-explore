export function insideElementOfClass(element: HTMLElement, className: string): boolean {
    if (element !== null) {
        return element.classList.contains('drag-handle')
            || insideElementOfClass(element.parentElement, className);
    } else {
        return false;
    }
}
