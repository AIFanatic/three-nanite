import { Meshlet } from "./Meshlet";

// From: THREE.js
export class MeshletMerger {
    public static merge(meshlets: Meshlet[]): Meshlet {
        const vertices: number[] = [];
        const indices: number[] = [];
    
        // merge indices
        let indexOffset = 0;
        const mergedIndices: number[] = [];
    
        for (let i = 0; i < meshlets.length; ++i) {
            const indices = meshlets[i].indices_raw;
    
            for (let j = 0; j < indices.length; j++) {
                mergedIndices.push(indices[j] + indexOffset);
            }
            indexOffset += meshlets[i].vertices.length;
        }
    
        indices.push(...mergedIndices);
    
        // merge attributes
        for (let i = 0; i < meshlets.length; ++i) {
            vertices.push(...meshlets[i].vertices_raw);
        }
    
        const merged = new Meshlet(vertices, indices);
        return merged;
    }
}