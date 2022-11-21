import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderer } from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { RenderStats } from "./RenderStats";

import TriangleVertexShader from './shaders/triangle.vert.glsl';
import TriangleFragmentShader from './shaders/triangle.frag.glsl';





import { STLLoader } from "../node_modules/three/examples/jsm/loaders/STLLoader";
import { MeshletMesh } from "./MeshletMesh";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { GUI } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min';
import { MeshletLOD } from "./MeshletLOD";
import { MeshletGeometry } from "./MeshletMeshV2";


function LoadSTL(url: string): Promise<BufferGeometry> {
    const loader = new STLLoader();

    return new Promise((resolve, reject) => {
        return loader.load(url, geometry => {
            resolve(geometry);
        });
    })
}

async function load() {
    const canvas = document.querySelector("#canvasContainer");
    const renderer = new WebGLRenderer({canvas: canvas});
    renderer.setSize( window.innerWidth, window.innerHeight );
    
    const stats = Stats()
    document.body.appendChild(stats.dom)
    
    const scene = new Scene();
    const camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100000 );
    camera.position.z = 5;
    const controls = new OrbitControls(camera, renderer.domElement);



    // const vs = [
    //     175, 20, 0,
    //     196, 100, 0,
    //     248, 87, 0,
    //     234, 145, 0,
    //     300, 116, 0,
    //     300, 172, 0,
    //     232, 232, 0,
    //     170, 180, 0,
    //     157, 255, 0,
    //     232, 300, 0,
    //     100, 232, 0,
    //     60, 152, 0,
    //     118, 124, 0,
    //     118, 54, 0
    // ]

    // for (let i = 0; i < vs.length; i++) {
    //     vs[i] = vs[i] / 300;
    //     vs[i] -= 0.5;
    // }

    // const is = [
    //     0, 2, 1,
    //     1, 2, 3,
    //     2, 4, 3,
    //     3, 4, 5,
        
    //     3, 5, 6,
    //     3, 6, 7,
    //     7, 6, 8,
    //     8, 6, 9,
        
    //     8, 10, 7,
    //     7, 10, 12,
    //     10, 11, 12,
    //     12, 11, 13,
        
    //     12, 13, 1,
    //     1, 13, 0,
    //     1, 3, 7,
    //     1, 7, 12
    // ]

    // let triangleGeometry = new BufferGeometry();
    // triangleGeometry.setAttribute( 'position', new Float32BufferAttribute( vs, 3 ) );
    // triangleGeometry.setIndex(is);
    // triangleGeometry.rotateX(Math.PI);
    // // triangleGeometry = mergeVertices(triangleGeometry);
    const triangleMaterial = new ShaderMaterial({
        // wireframe: true,
        vertexShader: TriangleVertexShader,
        fragmentShader: TriangleFragmentShader
    });


    function buildDag(geometry: BufferGeometry): MeshletMesh[] {
        let meshes: MeshletMesh[] = [];

        let groupCount = Infinity;
        let previousGeometry: BufferGeometry = geometry;
        let previousParent: MeshletMesh = null;
        while(groupCount > 1) {
            const meshletMesh = new MeshletMesh(previousGeometry, triangleMaterial, previousParent, 8);

            meshes.push(meshletMesh);

            previousGeometry = meshletMesh.meshletsGeometrySimplified;
            previousParent = meshletMesh;
            groupCount = meshletMesh.meshlets.length;
            // break;
        }

        return meshes;
    }


    let suzanne = await LoadSTL("./models/suzanne.stl");
    suzanne = suzanne.scale(0.5,0.5,0.5);
    suzanne.computeBoundingSphere();
    const meshes = buildDag(suzanne);

    // const m = new MeshletGeometry(suzanne);
    // // throw Error("ewfwe")


    function ShowMeshletMeshForLOD(meshlets: MeshletMesh[], lod: number) {
        const meshlet = meshlets[lod];
        scene.add(meshlet);

        // for (let i = 0; i < meshlet.meshlets.length; i++) {
        //     const meshletGroup = meshlet.GetMeshlet(i);
        //     scene.add(meshletGroup);

        //     const material = new MeshBasicMaterial({color: 0xffff00, wireframe: true});
        //     const mesh = new Mesh(meshlet.meshletsGeometrySimplified, material);
        //     scene.add(mesh);
        // }
    }

    function benchmark(meshes: MeshletMesh[], num: number) {
        let offset = ( num - 1 ) / 2;

        const position = new Vector3();
        for ( let x = 0; x < num; x ++ ) {
            for ( let y = 0; y < num; y ++ ) {
                for ( let z = 0; z < num; z ++ ) {
                    position.set( offset - x, offset - y, offset - z );

                    const meshletLOD = new MeshletLOD(meshes);
                    meshletLOD.position.copy(position);
                    scene.add(meshletLOD);
                }

            }
        }
    }

    benchmark(meshes, 10);

    console.log(scene)


    // function benchmarkInstanced(geometry: BufferGeometry, num: number) {
    //     const instancedMesh = new InstancedMesh(geometry, triangleMaterial, num);
    //     instancedMesh.instanceMatrix.setUsage( DynamicDrawUsage ); // will be updated every frame

    //     const range = 10;
    //     const step = range * 2 / num * 2;
    //     console.log(step)
    //     const matrix = new Matrix4();
    //     const dummy = new Mesh();
    //     let index = 0;
    //     for (let x = 0; x < range; x+=step) {
    //         for (let y = 0; y < range; y+=step) {
    //             const m = matrix.clone().setPosition(x, y, 0);
    //             dummy.position.set(x,y,0);
    //             dummy.updateMatrix();
    //             console.log(m)
    //             instancedMesh.setMatrixAt(index, m);
    //             index++;
    //         }
    //     }
    //     console.log(instancedMesh)
    //     scene.add(instancedMesh);
    //     instancedMesh.instanceMatrix.needsUpdate = true;
    // }
    
    // benchmarkInstanced(suzanne, 10);
    
    const renderStats = new RenderStats(renderer, suzanne);

    function animate() {
        requestAnimationFrame( animate );
    

        stats.update();
        renderStats.update();
        renderer.render( scene, camera );
    };
    
    animate();





    // GUI
    const guiParams = {
        lod: 0
    }

    let prevLOD = guiParams.lod;
    function onLODChanged() {
        if (guiParams.lod != prevLOD) {
            scene.clear();
            ShowMeshletMeshForLOD(meshes, guiParams.lod);

            prevLOD = guiParams.lod;
        }
    }
    const gui = new GUI();
    gui.close();

    gui.add(guiParams, 'lod', 0, meshes.length - 1, 1).onChange(onLODChanged);
    gui.open();

    onLODChanged();
}

load();