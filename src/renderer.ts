export interface CubeRenderer {
    initialize(container: HTMLElement): void;
    resize(width: number, height: number): void;
    render(): void;
    destroy(): void;
}
