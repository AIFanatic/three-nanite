import { WebGLRenderer } from "three";

export class Stat {
    public rowElement: HTMLTableRowElement;
    private nameEntry: HTMLTableCellElement;
    private valueEntry: HTMLTableCellElement;

    public set value(value: string) {
        this.valueEntry.textContent = value;
    }

    constructor(name: string, defaultValue: string) {
        this.rowElement = document.createElement("tr");
        this.nameEntry = document.createElement("td");
        this.valueEntry = document.createElement("td");
        this.nameEntry.textContent = name;
        this.valueEntry.textContent = defaultValue;

        this.rowElement.append(this.nameEntry, this.valueEntry);
    }
}

export class BetterStats {
    private renderer: WebGLRenderer;
    private readonly domElement: HTMLTableElement;

    private stats: Stat[];

    // Internal stats
    private programsStat: Stat;
    private geometriesStat: Stat;
    private texturesStat: Stat;

    private callsStat: Stat;
    private fpsStat: Stat;
    private trianglesStat: Stat;
    private pointsStat: Stat;
    private linesStat: Stat;

    private lastTime: number;
    private fps: number;

    constructor(webglRenderer: WebGLRenderer) {
        this.renderer = webglRenderer;
        this.domElement = document.createElement("table");
        this.domElement.style.backgroundColor = "#222222";
        this.domElement.style.color = "white";
        this.domElement.style.fontSize = "9px";
        this.domElement.style.fontFamily = "monospace";
        this.domElement.style.position = "absolute";
        this.domElement.style.top = "5px";
        this.domElement.style.right = "5px";
        this.domElement.style.right = "5px";
        this.domElement.style.borderRadius = "5px";
        this.domElement.style.border = "1px solid";

        this.stats = [];
        this.lastTime = 0;
        this.fps = 0;

        this.programsStat = new Stat("Programs", "0");
        this.geometriesStat = new Stat("Geometries", "0");
        this.texturesStat = new Stat("Textures", "0");

        this.callsStat = new Stat("Calls", "0");
        this.fpsStat = new Stat("FPS", "0");
        this.trianglesStat = new Stat("Triangles", "0");
        this.pointsStat = new Stat("Points", "0");
        this.linesStat = new Stat("Lines", "0");

        this.addStat(this.programsStat);
        this.addStat(this.geometriesStat);
        this.addStat(this.texturesStat);
        this.addStat(this.callsStat);
        this.addStat(this.fpsStat);
        this.addStat(this.trianglesStat);
        this.addStat(this.pointsStat);
        this.addStat(this.linesStat);
    }

    public addStat(stat: Stat) {
        if (this.stats.indexOf(stat) !== -1) return;

        this.domElement.append(stat.rowElement);
    }

    public update() {
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastTime;
        this.lastTime = currentTime;
        const currentFPS = Math.floor(1 / elapsed * 1000);

        const alpha = 0.1;
        this.fps = (1 - alpha) * this.fps + alpha * currentFPS;

        this.programsStat.value = this.renderer.info.programs.length.toString();
        this.geometriesStat.value = this.renderer.info.memory.geometries.toString();
        this.texturesStat.value = this.renderer.info.memory.textures.toString();
        this.callsStat.value = this.renderer.info.render.calls.toString();
        this.fpsStat.value = this.fps.toFixed(0);
        this.trianglesStat.value = this.renderer.info.render.triangles.toString();
        this.pointsStat.value = this.renderer.info.render.points.toString();
        this.linesStat.value = this.renderer.info.render.lines.toString();
    }
};