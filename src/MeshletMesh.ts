import { BufferGeometry, Camera, Color, DoubleSide, Float32BufferAttribute, Material, Mesh, Scene, ShaderMaterial, WebGLRenderer } from "three";
import { mergeBufferGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshletBuilder, meshopt_Meshlet } from "./MeshletBuilder";

import MeshletVertexShader from './shaders/meshlet.vert.glsl';
import MeshletFragmentShader from './shaders/meshlet.frag.glsl';
import { Utils } from "./Utils";
import { SimplifyModifier } from "./SimplifyModifier";

export class MeshletMesh extends Mesh {
    public meshlets: meshopt_Meshlet[];
    
    public parent: MeshletMesh | null;
    public meshletsGeometry: BufferGeometry;
    public meshletsGeometrySimplified: BufferGeometry;
    
    constructor(geometry: BufferGeometry, material: Material, parent: MeshletMesh | null, maxTriangles: number) {
        // To non indexed
        const nonIndexedGeometry = geometry.clone().toNonIndexed();
        // Generates indices
        let mergedGeometry = mergeVertices(nonIndexedGeometry);

        // const modifier = new SimplifyModifier();

        // mergedGeometry = modifier.modify(mergedGeometry, mergedGeometry.index.array.length / 3 / 2);
        
        mergedGeometry.computeVertexNormals();
        super(mergedGeometry, material);
        
        this.parent = parent;
        this.meshlets = [];
        const indices = new Uint16Array(mergedGeometry.getIndex().array);
        const vertices = mergedGeometry.getAttribute("position").array;
        const triangleCount = indices.length / 3;
        const maxVertices = vertices.length;

        const trianglesPerGroup = parent == null ? 
        Math.floor(Math.sqrt(triangleCount)) 
        :
        (triangleCount / parent.meshlets.length) * 2
        console.log("trianglesPerGroup", trianglesPerGroup);

        MeshletBuilder.meshopt_buildMeshletsScan(
            this.meshlets,
            indices,
            indices.length,
            vertices.length,
            maxVertices,
            trianglesPerGroup
        );

        let meshletGeometries = [];
        for (let i = 0; i < this.meshlets.length; i++) {
            meshletGeometries.push(this.GetMeshlet(i));
        }
        this.meshletsGeometry = mergeBufferGeometries(meshletGeometries);

        const modifier = new SimplifyModifier();

        this.meshletsGeometrySimplified = this.meshletsGeometry.clone();
        this.meshletsGeometrySimplified = modifier.modify(this.meshletsGeometrySimplified, this.meshletsGeometrySimplified.index.array.length / 3 / 2);
    }
    
    public GetMeshlet(index: number): BufferGeometry {
        const meshlet = this.meshlets[index];

        const indicesBuffer = [];
        for (let i of meshlet.indices) {
            indicesBuffer.push(i[0], i[1], i[2]);
        }

        const positions = this.geometry.getAttribute("position").array;
        const vertexBuffer = [];
        for (let v of meshlet.vertices) {
            vertexBuffer.push(positions[v * 3 + 0], positions[v * 3 + 1], positions[v * 3 + 2]);
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute( 'position', new Float32BufferAttribute( vertexBuffer, 3 ) );
        geometry.setIndex(indicesBuffer);
        return geometry;
    }

    // private GetMeshFromVerticesAndIndices(vertexBuffer: number[], indicesBuffer: number[], color: Color): Mesh {
    //     const geometry = new BufferGeometry();
    //     geometry.setAttribute( 'position', new Float32BufferAttribute( vertexBuffer, 3 ) );
    //     geometry.setIndex(indicesBuffer);
    //     const material = new ShaderMaterial({
    //         // vertexColors: true,
    //         vertexShader: MeshletVertexShader,
    //         fragmentShader: MeshletFragmentShader,
    //         side: DoubleSide,
    //         uniforms: {
    //             color: {value: color}
    //         }
    //     });
    //     // const material = new MeshBasicMaterial({color: "green"});
    
    //     const mesh = new Mesh(geometry, material);
    //     return mesh;
    // }

    // public GetMeshlet(index: number): Mesh {
    //     const meshlet = this.meshlets[index];

    //     const indicesBuffer = [];
    //     for (let i of meshlet.indices) {
    //         indicesBuffer.push(i[0], i[1], i[2]);
    //     }

    //     const positions = this.geometry.getAttribute("position").array;
    //     const vertexBuffer = [];
    //     for (let v of meshlet.vertices) {
    //         vertexBuffer.push(positions[v * 3 + 0], positions[v * 3 + 1], positions[v * 3 + 2]);
    //     }

    //     const color = "#" + Utils.SimpleHash(`${index}432t34f4${index}${index}`);
    //     const colorr = new Color(color);

    //     const mesh = this.GetMeshFromVerticesAndIndices(vertexBuffer, indicesBuffer, colorr);
    //     return mesh;
    // }
}