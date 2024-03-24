import { Meshlet } from "./App";

// From: THREE.js
export class MeshletMerger {
    public static merge(meshlets: Meshlet[]): Meshlet {
        const mergedMeshlet: Meshlet = {
            vertices: [],
            vertex_count: 0,
            indices: [],
            index_count: 0
        };
    
        // merge indices
        let indexOffset = 0;
        const mergedIndices: number[] = [];
    
        for (let i = 0; i < meshlets.length; ++i) {
            const indices = meshlets[i].indices;
    
            for (let j = 0; j < indices.length; j++) {
                mergedIndices.push(indices[j] + indexOffset);
            }
            indexOffset += meshlets[i].vertex_count;
        }
    
        mergedMeshlet.indices = mergedIndices;
    
        // merge attributes
        for (let i = 0; i < meshlets.length; ++i) {
            const vertices = meshlets[i].vertices;
            mergedMeshlet.vertices.push(...vertices);
        }
    
        mergedMeshlet.index_count = mergedMeshlet.indices.length;
        mergedMeshlet.vertex_count = mergedMeshlet.vertices.length / 3;
    
        return mergedMeshlet;
    }
}