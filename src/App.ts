import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { BetterStats, Stat } from "./BetterStats";

import { OBJLoaderIndexed } from "./OBJLoaderIndexed";
import { MeshletMerger } from "./MeshletMerger";

import { MeshletSimplifier_wasm } from "./utils/MeshletSimplifier";
import { MeshletCleaner } from "./utils/MeshletCleaner";
import { BoundingVolume, Meshlet } from "./Meshlet";
import { MeshletCreator } from "./utils/MeshletCreator";
import { MeshletGrouper } from "./MeshletGrouper";
import { MeshSimplifyScale } from "./utils/MeshSimplifyScale";
import { DiagramVisualizer } from "./DiagramVisualizer";
import { MeshletObject3D } from "./MeshletObject3D";


import Stats from "three/examples/jsm/libs/stats.module.js";


export class App {
    private canvas: HTMLCanvasElement;

    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;

    private stats: BetterStats;

    private statsT: Stats;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas });
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(32, this.canvas.width / this.canvas.height, 0.01, 10000);
        this.camera.position.z = 1;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0.0, 0.3, 0);
        this.controls.update();

        this.stats = new BetterStats(this.renderer);
        document.body.appendChild(this.stats.domElement);

        this.statsT = new Stats();
        document.body.appendChild(this.statsT.dom);

        this.render();
    }

    // Helpers
    private static rand(co: number) {
        function fract(n) {
            return n % 1;
        }

        return fract(Math.sin((co + 1) * 12.9898) * 43758.5453);
    }

    private createSphere(radius, color, position: number[]) {
        let g = new THREE.SphereGeometry(radius);

        const m = new THREE.MeshBasicMaterial({
            wireframe: true,
            side: 0,
            color: color,
        });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(position[0], position[1], position[2]);

        this.scene.add(mesh);
    }

    private createMesh(vertices: ArrayLike<number>, indices: ArrayLike<number>, params: { color?: number, position?: number[], opacity?: number, scale?: number[] }, DEBUG: boolean = false): THREE.Mesh {
        // if (DEBUG === false) return;

        let g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
        g.setIndex(new THREE.Uint16BufferAttribute(indices, 1));

        const m = new THREE.MeshBasicMaterial({
            wireframe: false,
            color: params.color ? params.color : 0xffffff,
            transparent: params.opacity ? true : false,
            opacity: params.opacity ? params.opacity : 0.0
        });
        const mesh = new THREE.Mesh(g, m);
        if (params.position) {
            mesh.position.set(params.position[0], params.position[1], params.position[2]);
        }
        if (params.scale) {
            mesh.scale.set(params.scale[0], params.scale[1], params.scale[2]);
        }
        this.scene.add(mesh);

        return mesh;
    }

    private showMeshlets(meshlets: Meshlet[], position: number[], scale?: number[], color?: number): THREE.Mesh[] {
        let meshes: THREE.Mesh[] = [];
        for (let i = 0; i < meshlets.length; i++) {
            const meshlet_color = color ? color : App.rand(i) * 0xffffff;
            const mesh = this.createMesh(meshlets[i].vertices_raw, meshlets[i].indices_raw, { color: meshlet_color, position: position, scale: scale });
            meshes.push(mesh);
        }
        return meshes;
    }


    public async processObj(objURL: string) {
        OBJLoaderIndexed.load(objURL, async (objMesh) => {

            const objVertices = objMesh.vertices;
            const objIndices = objMesh.indices;

            // Original mesh
            const xO = 0.3;
            const yO = -0.3;
            const DEBUG = false;
            // const originalMesh = this.createMesh(objVertices, objIndices, { opacity: 0.2, position: [-0.3, 0, 0] });

            async function appendMeshlets(simplifiedGroup: Meshlet, bounds: BoundingVolume, error: number): Promise<Meshlet[]> {
                const split = await MeshletCreator.build(simplifiedGroup.vertices_raw, simplifiedGroup.indices_raw, 255, 128);
                for (let s of split) {
                    s.clusterError = error;
                    s.boundingVolume = bounds;
                }
                return split;
            }

            let previousMeshlets: Map<number, Meshlet> = new Map();

            const step = async (meshlets: Meshlet[], y: number, scale = [1, 1, 1], lod: number): Promise<Meshlet[]> => {
                if (previousMeshlets.size === 0) {
                    for (let m of meshlets) previousMeshlets.set(m.id, m);
                }



                let nparts = Math.ceil(meshlets.length / 4);
                let grouped = [meshlets];
                if (nparts > 1) {
                    grouped = await MeshletGrouper.group(meshlets, nparts);
                }







                let x = 0;
                let splitOutputs: Meshlet[] = [];
                for (let i = 0; i < grouped.length; i++) {
                    const group = grouped[i];
                    // merge
                    const mergedGroup = MeshletMerger.merge(group);
                    const cleanedMergedGroup = await MeshletCleaner.clean(mergedGroup);
                    
                    // simplify
                    const simplified = await MeshletSimplifier_wasm.simplify(cleanedMergedGroup, cleanedMergedGroup.indices_raw.length / 2);
    
                    const localScale = await MeshSimplifyScale.scaleError(simplified.meshlet);
                    // console.log(localScale, simplified.result_error)

                    let meshSpaceError = simplified.result_error * localScale;
                    let childrenError = 0.0;

                    for (let m of group) {
                        const previousMeshlet = previousMeshlets.get(m.id);
                        if (!previousMeshlet) throw Error("Could not find previous meshler");

                        // console.log("previousMeshlet.clusterError", previousMeshlet.clusterError)
                        childrenError = Math.max(childrenError, previousMeshlet.clusterError);
                    }

                    meshSpaceError += childrenError;

                    for (let m of group) {
                        const previousMeshlet = previousMeshlets.get(m.id);
                        if (!previousMeshlet) throw Error("Could not find previous meshler");

                        previousMeshlet.parentError = meshSpaceError;
                        previousMeshlet.parentBoundingVolume = simplified.meshlet.boundingVolume;
                    }

                    const out = await appendMeshlets(simplified.meshlet, simplified.meshlet.boundingVolume, meshSpaceError);


                    for (let o of out) {
                        previousMeshlets.set(o.id, o);
                        splitOutputs.push(o);
                    }


                    for (let m of group) {
                        m.children.push(...out);
                        m.lod = lod;
                    }
                    for (let s of out) {
                        s.parents.push(...group);
                    }


                    if (DEBUG) {
                        this.showMeshlets(group, [x + (xO * 1), y, 0], [1, 1, 1], App.rand(i) * 0xffffff);
                        this.showMeshlets([cleanedMergedGroup], [x + (xO * 2), y, 0], [1, 1, 1], App.rand(i) * 0xffffff);
                        this.showMeshlets([simplified.meshlet], [+ (xO * 3), y, 0], [1, 1, 1], App.rand(i) * 0xffffff);
                    }
                }

                if (DEBUG) {
                    this.showMeshlets(meshlets, [0.0, y, 0], scale);
                    this.showMeshlets(splitOutputs, [+ (xO * 4), y, 0], [1, 1, 1]);
                }

                return splitOutputs;
            }
            const meshlets = await MeshletCreator.build(objVertices, objIndices, 255, 128);
            console.log(meshlets)

            let rootMeshlet: Meshlet = null;

            const maxLOD = 25;
            let y = 0.0;
            let inputs = meshlets;

            for (let lod = 0; lod < maxLOD; lod++) {
                const outputs = await step(inputs, y, [1, 1, 1], lod);

                console.log("inputs", inputs.map(m => m.indices_raw.length / 3));
                console.log("outputs", outputs.map(m => m.indices_raw.length / 3));

                if (outputs.length === 1) {
                    console.log("WE are done at lod", lod)

                    rootMeshlet = outputs[0];
                    rootMeshlet.lod = lod + 1;
                    rootMeshlet.parentBoundingVolume = rootMeshlet.boundingVolume;

                    break;
                }

                inputs = outputs;
                y += yO;
                console.log("\n");
            }

            console.log("root", rootMeshlet);


            if (rootMeshlet === null) throw Error("Root meshlet is invalid!");

















            function traverse(meshlet: Meshlet, fn: (meshlet: Meshlet) => void, visited: number[] = []) {
                if (visited.indexOf(meshlet.id) !== -1) return;

                fn(meshlet);
                visited.push(meshlet.id);

                for (let child of meshlet.parents) {
                    traverse(child, fn, visited);
                }
            }


            const allMeshlets: Meshlet[] = [];
            traverse(rootMeshlet, m => allMeshlets.push(m));
            console.log("total meshlets", allMeshlets.length);


            console.log("objIndicesLength", objIndices.length / 3);
            console.log("objVertices", objVertices.length / 3);

            const allMeshletsIndexLength = allMeshlets.map(m => m.indices_raw.length / 3);
            const allMeshletsIndexCount = allMeshletsIndexLength.reduce((a, b) => a + b);
            console.log("allMeshletsIndexLength", allMeshletsIndexLength, allMeshletsIndexCount);

            const allMeshletsVerticesLength = allMeshlets.map(m => m.vertices_raw.length / 3);
            const allMeshletsVertexCount = allMeshletsVerticesLength.reduce((a, b) => a + b);
            console.log("allMeshletsVerticesLength", allMeshletsVerticesLength, allMeshletsVertexCount);


            console.log("HERE")
            const meshletObject3D = new MeshletObject3D(allMeshlets.length, allMeshletsVertexCount * 3, allMeshletsIndexCount * 3);
            this.scene.add(meshletObject3D.mesh);


            allMeshlets.map(m => meshletObject3D.addMeshlet(m));
            // meshletObject3D.addMeshlet(allMeshlets[0]);

            const d = new DiagramVisualizer(250, 250);

            traverse(rootMeshlet, m => {
                if (m.children.length > 0) {
                    for (let c of m.children) {
                        d.add({ id: m.id.toString(), lod: m.lod.toString(), data: m }, { id: c.id.toString(), lod: c.lod.toString(), data: c });
                    }
                }
            })

            d.render();



            let addedMeshletsGroup: THREE.Group = new THREE.Group();
            addedMeshletsGroup.position.set(0, -yO, 0);
            addedMeshletsGroup.userData.meshletMap = {};
            addedMeshletsGroup.updateMatrix();
            addedMeshletsGroup.updateMatrixWorld();
            addedMeshletsGroup.visible = false;
            for (let i = 0; i < allMeshlets.length; i++) {
                const meshlet = allMeshlets[i];
                const mesh = this.createMesh(meshlet.vertices_raw, meshlet.indices_raw, { color: App.rand(i) * 0xffffff, position: [0, 0, 0] }, true);
                mesh.visible = false;
                addedMeshletsGroup.userData.meshletMap[meshlet.id] = mesh;
                addedMeshletsGroup.add(mesh);
            }
            this.scene.add(addedMeshletsGroup);

            function toggleN(nodeId: number, enabled: boolean) {
                const mesh = addedMeshletsGroup.userData.meshletMap[nodeId];
                mesh.visible = enabled;
            }

            const mCUT = () => {
                const testLOD = (meshlet: Meshlet) => {
                    const testFOV = Math.PI * 0.5;
                    const cotHalfFov = 1.0 / Math.tan(testFOV / 2.0);
                    const testScreenHeight = this.canvas.height; // Renderer probably * 2?

                    function projectErrorToScreen(sphere: THREE.Sphere): number {
                        if (sphere.radius === Infinity) return sphere.radius;

                        const d2 = sphere.center.dot(sphere.center);
                        const r = sphere.radius;
                        return testScreenHeight / 2.0 * cotHalfFov * r / Math.sqrt(d2 - r * r);
                    }



                    const c = meshlet.boundingVolume.center;
                    const projectedBounds = new THREE.Sphere(
                        new THREE.Vector3(c.x, c.y, c.z),
                        Math.max(meshlet.clusterError, 10e-10)
                    );


                    const objectMatrix = addedMeshletsGroup.matrixWorld;
                    const completeProj = new THREE.Matrix4().multiplyMatrices(this.camera.matrixWorld, objectMatrix);
                    projectedBounds.applyMatrix4(completeProj);



                    const clusterError = projectErrorToScreen(projectedBounds);


                    if (!meshlet.parentBoundingVolume) console.log(meshlet)

                    const pc = meshlet.parentBoundingVolume.center;
                    const parentProjectedBounds = new THREE.Sphere(
                        new THREE.Vector3(pc.x, pc.y, pc.z),
                        Math.max(meshlet.parentError, 10e-10)
                    );
                    parentProjectedBounds.applyMatrix4(completeProj);
                    const parentError = projectErrorToScreen(parentProjectedBounds);

                    const errorThreshold = 0.1;
                    const visible = clusterError <= errorThreshold && parentError > errorThreshold;
                    // console.log(meshlet.id, clusterError, parentError, visible)

                    return visible;
                }





                const lodStat = new Stat("TestLOD", `0ms`);
                this.stats.addStat(lodStat);


                setInterval(() => {

                    for (let m of allMeshlets) toggleN(m.id, false);
                    for (let m of allMeshlets) d.setNodeStatus(m.id.toString(), false);
                    for (let m of allMeshlets) meshletObject3D.setVisible(m.id, false);

                    let visibles: Meshlet[] = [];
                    const startTime = performance.now();
                    for (let n of allMeshlets) {
                        if (testLOD(n)) visibles.push(n);
                    }
                    const elapsed = performance.now() - startTime;
                    lodStat.value = `${elapsed.toFixed(3)}ms`;

                    for (let visible of visibles) {
                        toggleN(visible.id, true);
                        d.setNodeStatus(visible.id.toString(), true);
                        meshletObject3D.setVisible(visible.id, true);
                    }

                    d.render();

                }, 100);
            }

            mCUT()
        })
    }

    private render() {

        this.stats.update();
        this.statsT.update();

        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => { this.render() });
    }
}