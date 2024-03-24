import * as SimplifyModifierModule from "./qms/qms.js";

import { Meshlet } from "./App.js";

export class SimplifyModifierV4 {
    private static SimplifyModifier;

    public static async load() {
        if (!SimplifyModifierV4.SimplifyModifier) {
            SimplifyModifierV4.SimplifyModifier = await SimplifyModifierModule.default();
        }
    }

    public static async simplify(meshlet: Meshlet, percentage: number): Promise<Meshlet> {
        await SimplifyModifierV4.load();

        // return;


        // int simplify(
        //     std::vector<std::vector<double> > *vertices,
        //     std::vector<std::vector<int> > *faces,
        //     float reduceFraction,
        //     float agressiveness
        // )

        // int simplify(
        //     double *vertices,
        //     int vertex_count,
        //     int *faces,
        //     int face_count,
        //     float reduceFraction,
        //     float agressiveness
        // )

        const simplify = this.SimplifyModifier.cwrap(
            'simplify',
            'number',                 // The return type
            [
                'number',
                'number',
                'number',
                'number',
                'number',
                'number',

                'number',
                'number'
            ]
        );

        const simplified_vertex_count_fn = this.SimplifyModifier.cwrap(
            'get_simplified_vertex_count',
            'number', []
        );

        const simplified_triangle_count_fn = this.SimplifyModifier.cwrap(
            'get_simplified_triangle_count',
            'number', []
        );

        const reduceFraction = percentage;
        const aggressiveness = 7;


        const m = this.SimplifyModifier;
        const TYPES = {
            i8: { array: Int8Array, heap: "HEAP8" },
            i16: { array: Int16Array, heap: "HEAP16" },
            i32: { array: Int32Array, heap: "HEAP32" },
            f32: { array: Float32Array, heap: "HEAPF32" },
            f64: { array: Float64Array, heap: "HEAPF64" },
            u8: { array: Uint8Array, heap: "HEAPU8" },
            u16: { array: Uint16Array, heap: "HEAPU16" },
            u32: { array: Uint32Array, heap: "HEAPU32" }
        };

        function transferNumberArrayToHeap(array, type) {
            const typedArray = type.array.from(array);
            const heapPointer = m._malloc(
                typedArray.length * typedArray.BYTES_PER_ELEMENT
            );

            m[type.heap].set(typedArray, heapPointer >> 2);

            return heapPointer;
        }

        function getDataFromHeap(address, type, length) {
            return m[type.heap].slice(address >> 2, (address >> 2) + length);
        }
        
        const verticesPtr = transferNumberArrayToHeap(Float32Array.from(meshlet.vertices), TYPES.f32);
        const indicesPtr = transferNumberArrayToHeap(Uint32Array.from(meshlet.indices), TYPES.u32);




        const vertices_output = new Float32Array(meshlet.vertices.length);
        const vertices_output_ptr = transferNumberArrayToHeap(vertices_output, TYPES.f32);

        const triangles_output = new Uint32Array(meshlet.indices.length);
        const triangles_output_ptr = transferNumberArrayToHeap(triangles_output, TYPES.u32);

        simplify(verticesPtr, meshlet.vertices.length, indicesPtr, meshlet.indices.length, reduceFraction, aggressiveness, vertices_output_ptr, triangles_output_ptr);

        const simplified_vertex_count = simplified_vertex_count_fn() * 3;
        const simplified_triangle_count = simplified_triangle_count_fn() * 3;

        const vertices_output_result: Float32Array = getDataFromHeap(vertices_output_ptr, TYPES.f32, simplified_vertex_count);
        const triangles_output_result: Uint32Array = getDataFromHeap(triangles_output_ptr, TYPES.u32, simplified_triangle_count);

        return {
            vertices: Array.from(vertices_output_result),
            vertex_count: vertices_output_result.length / 3,
            indices: Array.from(triangles_output_result),
            index_count: triangles_output_result.length,
        }
    }
}