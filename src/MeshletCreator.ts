import { Meshlet } from "./App";
import { MeshletBuilder, MeshoptMeshlet } from "./utils/MeshletBuilder";
import { MeshletBuilder_wasm } from "./utils/MeshletBuilder_wasm";

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

    private static async buildFromWasm(vertices: Float32Array, indices: Uint32Array, max_triangles: number): Promise<MeshletBuildOutput> {
        const max_vertices = MeshletCreator.max_vertices;
        const cone_weight = MeshletCreator.cone_weight;

        console.log("triangle count", indices.length / 3);
        console.log("max_triangles", max_triangles);

        const output = await MeshletBuilder_wasm.build(vertices, indices, max_vertices, max_triangles, cone_weight)
        return {
            meshlets_count: output.meshlet_count,
            meshlets_result: output.meshlets_result.slice(0, output.meshlet_count),
            meshlet_vertices_result: output.meshlet_vertices_result,
            meshlet_triangles_result: output.meshlet_triangles_result
        }
    }

    // Still has bugs
    private static async buildFromJS(vertices: Float32Array, indices: Uint32Array, max_triangles: number) {
        const max_vertices = MeshletCreator.max_vertices;
        const cone_weight = MeshletCreator.cone_weight;

        const max_meshlets = MeshletBuilder.meshopt_buildMeshletsBound(indices.length, max_vertices, max_triangles);

        const meshlets: MeshoptMeshlet[] = new Array<MeshoptMeshlet>(max_meshlets).fill(0).map(v => {
            return {
                vertex_offset: 0,
                triangle_offset: 0,
                vertex_count: 0,
                triangle_count: 0,
            }
        });
        const meshlet_vertices = new Uint32Array(max_meshlets * max_vertices);
        const meshlet_triangles = new Uint8Array(max_meshlets * max_triangles * 3);

        const meshletCount = MeshletBuilder.meshopt_buildMeshlets(
            meshlets,
            meshlet_vertices,
            meshlet_triangles,
            Uint32Array.from(indices),
            indices.length,
            vertices,
            vertices.length,
            12,
            max_vertices,
            max_triangles,
            cone_weight
        )

        return {
            meshlets_count: meshletCount,
            meshlets_result: meshlets.slice(0, meshletCount),
            meshlet_vertices_result: meshlet_vertices,
            meshlet_triangles_result: meshlet_triangles
        }
    }

    private static buildMeshletsFromBuildOutput(vertices: Float32Array, output: MeshletBuildOutput): Meshlet[] {
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

            meshlets.push({
                vertices: meshlet_positions,
                indices: meshlet_indices,
                vertex_count: meshlet_positions.length / 3,
                index_count: meshlet_indices.length,
            });
        }
        return meshlets;
    }

    public static async build(vertices: Float32Array, indices: Uint32Array, max_triangles: number, useWasm = true) {
        const buildOutput = useWasm ? 
                            await MeshletCreator.buildFromWasm(vertices, indices, max_triangles):
                            await MeshletCreator.buildFromJS(vertices, indices, max_triangles);

        const meshlets = MeshletCreator.buildMeshletsFromBuildOutput(vertices, buildOutput);
        
        return meshlets;
    }
}