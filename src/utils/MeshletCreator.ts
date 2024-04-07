import { Meshlet } from "../Meshlet";
import { MeshletBuilder } from "./MeshletBuilder";

export interface MeshoptMeshlet {
    triangle_offset: number;
    triangle_count: number;
    vertex_offset: number;
    vertex_count: number;
}

interface MeshletBuildOutput {
    meshlets_count: number;
    meshlets_result: MeshoptMeshlet[];
    meshlet_vertices_result: Uint32Array;
    meshlet_triangles_result: Uint8Array;
}

export class MeshletCreator {
    private static max_vertices = 255;
    private static max_triangles = 128;
    private static cone_weight = 0.0;

    public static async buildFromWasm(vertices: Float32Array, indices: Uint32Array): Promise<MeshletBuildOutput> {
        const max_vertices = MeshletCreator.max_vertices;
        const max_triangles = MeshletCreator.max_triangles;
        const cone_weight = MeshletCreator.cone_weight;

        const output = await MeshletBuilder.build(vertices, indices, max_vertices, max_triangles, cone_weight)
        return {
            meshlets_count: output.meshlet_count,
            meshlets_result: output.meshlets_result.slice(0, output.meshlet_count),
            meshlet_vertices_result: output.meshlet_vertices_result,
            meshlet_triangles_result: output.meshlet_triangles_result
        }
    }

    public static buildMeshletsFromBuildOutput(vertices: Float32Array, output: MeshletBuildOutput): Meshlet[] {
        let meshlets: Meshlet[] = [];

        for (let i = 0; i < output.meshlets_count; i++) {
            const meshlet = output.meshlets_result[i];

            let meshlet_positions: number[] = [];
            let meshlet_indices: number[] = [];

            for (let v = 0; v < meshlet.vertex_count; ++v) {
                const o = 3 * output.meshlet_vertices_result[meshlet.vertex_offset + v];
                const x = vertices[o];
                const y = vertices[o + 1];
                const z = vertices[o + 2];

                meshlet_positions.push(x);
                meshlet_positions.push(y);
                meshlet_positions.push(z);
            }
            for (let t = 0; t < meshlet.triangle_count; ++t) {
                const o = meshlet.triangle_offset + 3 * t;
                meshlet_indices.push(output.meshlet_triangles_result[o + 0]);
                meshlet_indices.push(output.meshlet_triangles_result[o + 1]);
                meshlet_indices.push(output.meshlet_triangles_result[o + 2]);
            }

            meshlets.push(new Meshlet(meshlet_positions, meshlet_indices));
        }
        return meshlets;
    }

    public static async build(vertices: Float32Array, indices: Uint32Array, max_vertices: number, max_triangles: number) {
        const cone_weight = MeshletCreator.cone_weight;

        const output = await MeshletBuilder.build(vertices, indices, max_vertices, max_triangles, cone_weight)
        const m = {
            meshlets_count: output.meshlet_count,
            meshlets_result: output.meshlets_result.slice(0, output.meshlet_count),
            meshlet_vertices_result: output.meshlet_vertices_result,
            meshlet_triangles_result: output.meshlet_triangles_result
        }


        const meshlets = MeshletCreator.buildMeshletsFromBuildOutput(vertices, m);
        
        return meshlets;
    }
}