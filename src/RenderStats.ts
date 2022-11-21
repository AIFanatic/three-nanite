import { BufferGeometry, WebGLRenderer } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export class RenderStats {
    private renderer: WebGLRenderer;
    private container: HTMLDivElement;

    private calls: HTMLSpanElement;
    private frame: HTMLSpanElement;
    private trianglesOriginal: HTMLSpanElement;
    private triangles: HTMLSpanElement;
    private geometries: HTMLSpanElement;
    private textures: HTMLSpanElement;

    constructor(renderer: WebGLRenderer, originalGeometry: BufferGeometry) {
        this.renderer = renderer;
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.display = "grid";
        this.container.style.top = "50";
        this.container.style.color = "white";

        this.calls = document.createElement("span");
        this.frame = document.createElement("span");
        this.trianglesOriginal = document.createElement("span");
        this.triangles = document.createElement("span");
        this.geometries = document.createElement("span");
        this.textures = document.createElement("span");

        this.container.appendChild(this.calls);
        this.container.appendChild(this.frame);
        this.container.appendChild(this.trianglesOriginal);
        this.container.appendChild(this.triangles);
        this.container.appendChild(this.geometries);
        this.container.appendChild(this.textures);

        originalGeometry = mergeVertices(originalGeometry);
        this.trianglesOriginal.textContent = `Triangles original: ${originalGeometry.index.array.length / 3}`;

        document.body.appendChild(this.container);
    }

    public update() {
        this.calls.textContent = `Calls: ${this.renderer.info.render.calls}`;
        this.frame.textContent = `Frame: ${this.renderer.info.render.frame}`;
        this.triangles.textContent = `Triangles: ${this.renderer.info.render.triangles}`;
        this.geometries.textContent = `Geometries: ${this.renderer.info.memory.geometries}`;
        this.textures.textContent = `Textures: ${this.renderer.info.memory.textures}`;
    }
}