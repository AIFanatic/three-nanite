import { WebGLRenderer } from "three";

export class BetterStats {
    private renderer: WebGLRenderer;
    private msTexts: HTMLDivElement[];
    private lastTime: number;
    public readonly domElement: HTMLDivElement;

    private fps: number;

    constructor(webglRenderer: WebGLRenderer) {
        this.renderer = webglRenderer;

        const container	= document.createElement( 'div' );
        this.domElement = container;
        container.style.cssText = 'width:80px;opacity:0.9;cursor:pointer;position:absolute;bottom:0';
    
        const msDiv	= document.createElement( 'div' );
        msDiv.style.cssText = 'padding:0 0 3px 3px;text-align:left;background-color:#200;';
        container.appendChild( msDiv );
    
        const msText = document.createElement( 'div' );
        msText.style.cssText = 'color:#f00;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
        msText.innerHTML= 'WebGLRenderer';
        msDiv.appendChild( msText );

        this.msTexts = [];
        const nLines = 10;
        for(var i = 0; i < nLines; i++){
            this.msTexts[i]	= document.createElement( 'div' );
            this.msTexts[i].style.cssText = 'color:#f00;background-color:#311;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
            msDiv.appendChild( this.msTexts[i] );
            this.msTexts[i].innerHTML= '-';
        }
    
        this.lastTime = performance.now();
        this.fps = 0;
    }

    public update() {
        // if( Date.now() - this.lastTime < 1000/30 ) return;

        const currentTime = performance.now();
        const elapsed = currentTime - this.lastTime;
        this.lastTime = currentTime;

        const currentFPS = Math.floor(1 / elapsed * 1000);

        const alpha = 0.1;
        this.fps = (1 - alpha) * this.fps + alpha * currentFPS;

        var i = 0;
        this.msTexts[i++].textContent = "=== Memory ===";
        this.msTexts[i++].textContent = "Programs: "	+ this.renderer.info.programs?.length;
        this.msTexts[i++].textContent = "Geometries: "+this.renderer.info.memory.geometries;
        this.msTexts[i++].textContent = "Textures: "	+ this.renderer.info.memory.textures;

        this.msTexts[i++].textContent = "=== Render ===";
        this.msTexts[i++].textContent = "Calls: "	+ this.renderer.info.render.calls;
        this.msTexts[i++].textContent = "FPS: "	+ Math.floor(this.fps);
        this.msTexts[i++].textContent = "Triangles: "	+ Math.floor(this.renderer.info.render.triangles);
        this.msTexts[i++].textContent = "Points: "	+ this.renderer.info.render.points;
        this.msTexts[i++].textContent = "Lines: "	+ this.renderer.info.render.lines;
    }
};