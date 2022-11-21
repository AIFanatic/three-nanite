import { BufferGeometry, Float32BufferAttribute } from "three";
import { mergeBufferGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshletBuilder, meshopt_Meshlet } from "./MeshletBuilder";
import { SimplifyModifier } from "./SimplifyModifier";

interface Output {
    meshlets: meshopt_Meshlet[];
    meshletsGeometry: BufferGeometry;
    simplifiedGeometry: BufferGeometry;
}

export class MeshletGeometry {
    constructor(geometry: BufferGeometry) {
        // To non indexed
        const nonIndexedGeometry = geometry.clone().toNonIndexed();
        // Generates indices
        let mergedGeometry = mergeVertices(nonIndexedGeometry);
        mergedGeometry.computeVertexNormals();

        
        const triangleCount = mergedGeometry.index.array.length / 3;
        let groupCount = Infinity;
        let previousGeometry: BufferGeometry = mergedGeometry;
        // let previousParent: MeshletMesh = null;
        let previousMeshlets: meshopt_Meshlet[] = [];

        let meshletsAll: Output[] = [];
        while(groupCount > 1) {
            const trianglesPerGroup = previousMeshlets.length == 0 ? 
            Math.floor(Math.sqrt(triangleCount)) 
            :
            (triangleCount / previousMeshlets.length) * 2
            console.log("trianglesPerGroup", trianglesPerGroup);

            const meshlets = this.GenerateMeshlets(previousGeometry, trianglesPerGroup);
            const aggregatedMeshletsGeometry = this.AggregateMeshlets(mergedGeometry, meshlets);

            const simplifyTriangleCount = previousGeometry.index.array.length / 3 / 2;
            const simplifiedGeometry = this.SimplifyGeometry(aggregatedMeshletsGeometry, simplifyTriangleCount);

            meshletsAll.push({
                meshlets: meshlets,
                meshletsGeometry: aggregatedMeshletsGeometry,
                simplifiedGeometry: simplifiedGeometry
            });
            previousMeshlets = meshlets;
            previousGeometry = simplifiedGeometry;
            groupCount = meshlets.length;
        }

        console.log(meshletsAll)
        
    }

    private GenerateMeshlets(geometry: BufferGeometry, trianglesPerGroup: number): meshopt_Meshlet[] {
        const meshlets: meshopt_Meshlet[] = [];
        const indices = new Uint16Array(geometry.getIndex().array);
        const vertices = geometry.getAttribute("position").array;
        const maxVertices = vertices.length;

        MeshletBuilder.meshopt_buildMeshletsScan(
            meshlets,
            indices,
            indices.length,
            vertices.length,
            maxVertices,
            trianglesPerGroup
        );

        return meshlets;
    }


    private MeshletToBufferGeometry(originalGeometry: BufferGeometry, meshlet: meshopt_Meshlet): BufferGeometry {
        const indicesBuffer = [];
        for (let i of meshlet.indices) {
            indicesBuffer.push(i[0], i[1], i[2]);
        }

        const positions = originalGeometry.getAttribute("position").array;
        const vertexBuffer = [];
        for (let v of meshlet.vertices) {
            vertexBuffer.push(positions[v * 3 + 0], positions[v * 3 + 1], positions[v * 3 + 2]);
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute( 'position', new Float32BufferAttribute( vertexBuffer, 3 ) );
        geometry.setIndex(indicesBuffer);
        return geometry;
    }

    private AggregateMeshlets(originalGeometry: BufferGeometry, meshlets): BufferGeometry {
        let meshletGeometries: BufferGeometry[] = [];
        for (let i = 0; i < meshlets.length; i++) {
            meshletGeometries.push(
                this.MeshletToBufferGeometry(originalGeometry, meshlets[i])
            )
        }
        const meshletsGeometry = mergeBufferGeometries(meshletGeometries);
        return meshletsGeometry;
    }

    private SimplifyGeometry(geometry: BufferGeometry, triangleCount: number) {
        const modifier = new SimplifyModifier();

        const geometrySimplified = modifier.modify(geometry.clone(), triangleCount);
        return geometrySimplified;
    }
}