// From: https://github.com/zeux/meshoptimizer

function assert(value: boolean) {
    if (!value) throw Error("Assert failed");
}

export interface meshopt_Meshlet {
	/* offsets within meshlet_vertices and meshlet_triangles arrays with meshlet data */
	vertices: number[];
	indices: number[][];

	triangle_count: number;
	vertex_count: number;
}

export class MeshletBuilder {
    // This must be <= 255 since index 0xff is used internally to indice a vertex that doesn't belong to a meshlet
    private static kMeshletMaxVertices = 255;

    // A reasonable limit is around 2*max_vertices or less
    private static kMeshletMaxTriangles = 512;

    public static meshopt_buildMeshletsBound(index_count: number, max_vertices: number, max_triangles: number): number {
        assert(index_count % 3 == 0);
        // assert(max_vertices >= 3 && max_vertices <= this.kMeshletMaxVertices);
        // assert(max_triangles >= 1 && max_triangles <= this.kMeshletMaxTriangles);
        assert(max_triangles % 4 == 0); // ensures the caller will compute output space properly as index data is 4b aligned
    
        // meshlet construction is limited by max vertices and max triangles per meshlet
        // the worst case is that the input is an unindexed stream since this equally stresses both limits
        // note that we assume that in the worst case, we leave 2 vertices unpacked in each meshlet - if we have space for 3 we can pack any triangle
        const max_vertices_conservative = max_vertices - 2;
        const meshlet_limit_vertices = (index_count + max_vertices_conservative - 1) / max_vertices_conservative;
        const meshlet_limit_triangles = (index_count / 3 + max_triangles - 1) / max_triangles;
    
        return meshlet_limit_vertices > meshlet_limit_triangles ? Math.floor(meshlet_limit_vertices) : Math.floor(meshlet_limit_triangles);
    }

    public static meshopt_buildMeshletsScan(destination: meshopt_Meshlet[], indices: Uint16Array, index_count: number, vertex_count: number, max_vertices: number, max_triangles: number): number
    {
        assert(index_count % 3 == 0);
        assert(max_vertices >= 3);
        assert(max_triangles >= 1);
    
        let meshlet: meshopt_Meshlet = {
            vertices: [],
            indices: [],

            vertex_count: 0,
            triangle_count: 0
        };
    
        // assert(max_vertices <= meshlet.vertices.length / sizeof(meshlet.vertices[0]));
        // assert(max_triangles <= meshlet.indices.length / 3);


        const used = new Uint8Array(new Array(vertex_count).fill(-1));

        let offset = 0;
        
        for (let i = 0; i < index_count; i += 3)
        {
            const a = indices[i + 0], b = indices[i + 1], c = indices[i + 2];
            assert(a < vertex_count && b < vertex_count && c < vertex_count);
    
            let av = used[a]; // pointer
            let bv = used[b]; // pointer
            let cv = used[c]; // pointer
    
            const avCheck = (av == 0xff) ? 1 : 0;
            const bvCheck = (bv == 0xff) ? 1 : 0;
            const cvCheck = (cv == 0xff) ? 1 : 0;
            const used_extra = avCheck + bvCheck + cvCheck;
            
            if (meshlet.vertex_count + used_extra > max_vertices || meshlet.triangle_count >= max_triangles)
            {
                destination[offset++] = meshlet;
    
                for (let j = 0; j < meshlet.vertex_count; ++j) {
                    used[meshlet.vertices[j]] = 0xff;
                }

                av = used[a];
                bv = used[b];
                cv = used[c];
    
                meshlet = {
                    vertices: [],
                    indices: [],
        
                    vertex_count: 0,
                    triangle_count: 0
                };
                // memset(&meshlet, 0, sizeof(meshlet));
            }
    
            if (av == 0xff)
            {
                av = meshlet.vertex_count;
                meshlet.vertices[meshlet.vertex_count++] = a;
            }
    
            if (bv == 0xff)
            {
                bv = meshlet.vertex_count;
                meshlet.vertices[meshlet.vertex_count++] = b;
            }
    
            if (cv == 0xff)
            {
                cv = meshlet.vertex_count;
                meshlet.vertices[meshlet.vertex_count++] = c;
            }
    
            // console.log(meshlet)
            if (!meshlet.indices[meshlet.triangle_count]) {
                meshlet.indices[meshlet.triangle_count] = [];
            }
            meshlet.indices[meshlet.triangle_count][0] = av;
            meshlet.indices[meshlet.triangle_count][1] = bv;
            meshlet.indices[meshlet.triangle_count][2] = cv;
            meshlet.triangle_count++;

            used[a] = av;
            used[b] = bv;
            used[c] = cv;
        }
    
        if (meshlet.triangle_count)
            destination[offset++] = meshlet;
    
        // assert(offset <= this.meshopt_buildMeshletsBound(index_count, max_vertices, max_triangles));
    
        return offset;

    }
}