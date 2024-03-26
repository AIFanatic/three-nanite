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


interface TriangleAdjacency2 {
    counts: Uint32Array;
    offsets: Uint32Array;
    data: Uint32Array;
}

class Cone {
    constructor(
        public px: number,
        public py: number,
        public pz: number,
        public nx: number,
        public ny: number,
        public nz: number
    ) { }
}

class KDNode {
    split: number;
    index: number;
    axis: number; // In TypeScript, we use regular numbers and manage the size constraints programmatically
    children: number;

    constructor() {
        this.split = 0;
        this.index = 0;
        this.axis = 0;
        this.children = 0;
    }
}

interface MeshoptMeshlet {
    triangle_offset: number;
    triangle_count: number;
    vertex_offset: number;
    vertex_count: number;
}

export class MeshletBuilder {
    // This must be <= 255 since index 0xff is used internally to indice a vertex that doesn't belong to a meshlet
    private static kMeshletMaxVertices = 255;

    // A reasonable limit is around 2*max_vertices or less
    private static kMeshletMaxTriangles = 512;





    private static buildTriangleAdjacency(adjacency: TriangleAdjacency2, indices: Uint32Array, indexCount: number, vertexCount: number): void {
        const faceCount = indexCount / 3;

        // Allocate arrays
        adjacency.counts = new Uint32Array(vertexCount);
        adjacency.offsets = new Uint32Array(vertexCount);
        adjacency.data = new Uint32Array(indexCount);

        // Fill triangle counts
        for (let i = 0; i < indexCount; ++i) {
            if (indices[i] < vertexCount) {
                adjacency.counts[indices[i]]++;
            } else {
                throw new Error(`Index out of bounds: ${indices[i]} is not less than vertexCount ${vertexCount}`);
            }
        }

        // Fill offset table
        let offset = 0;
        for (let i = 0; i < vertexCount; ++i) {
            adjacency.offsets[i] = offset;
            offset += adjacency.counts[i];
        }

        if (offset !== indexCount) {
            throw new Error(`Offset ${offset} does not equal indexCount ${indexCount}`);
        }

        // Fill triangle data
        for (let i = 0; i < faceCount; ++i) {
            const a = indices[i * 3 + 0];
            const b = indices[i * 3 + 1];
            const c = indices[i * 3 + 2];

            adjacency.data[adjacency.offsets[a]++] = i;
            adjacency.data[adjacency.offsets[b]++] = i;
            adjacency.data[adjacency.offsets[c]++] = i;
        }

        // Fix offsets that have been disturbed by the previous pass
        for (let i = 0; i < vertexCount; ++i) {
            if (adjacency.offsets[i] < adjacency.counts[i]) {
                throw new Error(`Offset for vertex ${i} is less than its count`);
            }
            adjacency.offsets[i] -= adjacency.counts[i];
        }
    }

    private static computeBoundingSphere(result: number[], points: number[][], count: number): void {
        if (count <= 0) throw new Error("Count must be greater than 0");

        // find extremum points along all 3 axes; for each axis, we get a pair of points with min/max coordinates
        const pmin: number[] = [0, 0, 0];
        const pmax: number[] = [0, 0, 0];

        for (let i = 0; i < count; ++i) {
            const p = points[i];

            for (let axis = 0; axis < 3; ++axis) {
                if (p[axis] < points[pmin[axis]][axis]) pmin[axis] = i;
                if (p[axis] > points[pmax[axis]][axis]) pmax[axis] = i;
            }
        }

        // find the pair of points with the largest distance
        let paxisd2 = 0;
        let paxis = 0;

        for (let axis = 0; axis < 3; ++axis) {
            const p1 = points[pmin[axis]];
            const p2 = points[pmax[axis]];

            const d2 = (p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2 + (p2[2] - p1[2]) ** 2;

            if (d2 > paxisd2) {
                paxisd2 = d2;
                paxis = axis;
            }
        }

        // use the longest segment as the initial sphere diameter
        const p1 = points[pmin[paxis]];
        const p2 = points[pmax[paxis]];

        const center: number[] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
        let radius = Math.sqrt(paxisd2) / 2;

        // iteratively adjust the sphere until all points fit
        for (let i = 0; i < count; ++i) {
            const p = points[i];
            const d2 = (p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2 + (p[2] - center[2]) ** 2;

            if (d2 > radius * radius) {
                const d = Math.sqrt(d2);
                if (d <= 0) throw new Error("Distance must be greater than 0");

                const k = 0.5 + (radius / d) / 2;

                center[0] = center[0] * k + p[0] * (1 - k);
                center[1] = center[1] * k + p[1] * (1 - k);
                center[2] = center[2] * k + p[2] * (1 - k);
                radius = (radius + d) / 2;
            }
        }

        result[0] = center[0];
        result[1] = center[1];
        result[2] = center[2];
        result[3] = radius;
    }

    private static getMeshletScore(distance2: number, spread: number, cone_weight: number, expected_radius: number): number {
        const cone = 1.0 - spread * cone_weight;
        const cone_clamped = cone < 1e-3 ? 1e-3 : cone;

        return (1 + Math.sqrt(distance2) / expected_radius * (1 - cone_weight)) * cone_clamped;
    }

    private static getMeshletCone(acc: Cone, triangle_count: number): Cone {
        const result = new Cone(acc.px, acc.py, acc.pz, acc.nx, acc.ny, acc.nz);

        const center_scale = triangle_count === 0 ? 0.0 : 1.0 / triangle_count;

        result.px *= center_scale;
        result.py *= center_scale;
        result.pz *= center_scale;

        const axis_length = result.nx * result.nx + result.ny * result.ny + result.nz * result.nz;
        const axis_scale = axis_length === 0.0 ? 0.0 : 1.0 / Math.sqrt(axis_length);

        result.nx *= axis_scale;
        result.ny *= axis_scale;
        result.nz *= axis_scale;

        return result;
    }

    private static computeTriangleCones(triangles: Cone[], indices: Uint32Array, index_count: number, vertex_positions: Float32Array, vertex_count: number, vertex_positions_stride: number): number {
        const vertex_stride_float = vertex_positions_stride / 4; // sizeof(float) is 4 bytes
        const face_count = index_count / 3;

        let mesh_area = 0;

        for (let i = 0; i < face_count; ++i) {
            const a = indices[i * 3 + 0], b = indices[i * 3 + 1], c = indices[i * 3 + 2];
            if (a >= vertex_count || b >= vertex_count || c >= vertex_count) {
                throw new Error('Index out of bounds');
            }

            const p0 = vertex_positions.subarray(vertex_stride_float * a, vertex_stride_float * a + 3);
            const p1 = vertex_positions.subarray(vertex_stride_float * b, vertex_stride_float * b + 3);
            const p2 = vertex_positions.subarray(vertex_stride_float * c, vertex_stride_float * c + 3);

            const p10 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const p20 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

            const normalx = p10[1] * p20[2] - p10[2] * p20[1];
            const normaly = p10[2] * p20[0] - p10[0] * p20[2];
            const normalz = p10[0] * p20[1] - p10[1] * p20[0];

            const area = Math.sqrt(normalx * normalx + normaly * normaly + normalz * normalz);
            const invarea = area === 0.0 ? 0.0 : 1.0 / area;

            triangles[i] = new Cone(
                (p0[0] + p1[0] + p2[0]) / 3.0,
                (p0[1] + p1[1] + p2[1]) / 3.0,
                (p0[2] + p1[2] + p2[2]) / 3.0,
                normalx * invarea,
                normaly * invarea,
                normalz * invarea
            );

            mesh_area += area;
        }

        return mesh_area;
    }


    private static finishMeshlet(meshlet: MeshoptMeshlet, meshlet_triangles: Uint8Array): void {
        let offset: number = meshlet.triangle_offset + meshlet.triangle_count * 3;

        // fill 4b padding with 0
        while (offset & 3) {
            meshlet_triangles[offset++] = 0;
        }
    }

    private static appendMeshlet(meshlet: MeshoptMeshlet, a: number, b: number, c: number, used: Uint8Array, meshlets: MeshoptMeshlet[], meshlet_vertices: Uint32Array, meshlet_triangles: Uint8Array, meshlet_offset: number, max_vertices: number, max_triangles: number): boolean {
        let av: number = used[a];
        let bv: number = used[b];
        let cv: number = used[c];

        let result: boolean = false;

        let used_extra: number = (av === 0xff ? 1 : 0) + (bv === 0xff ? 1 : 0) + (cv === 0xff ? 1 : 0);

        if (meshlet.vertex_count + used_extra > max_vertices || meshlet.triangle_count >= max_triangles) {
            meshlets[meshlet_offset] = meshlet;

            for (let j: number = 0; j < meshlet.vertex_count; ++j) {
                used[meshlet_vertices[meshlet.vertex_offset + j]] = 0xff;
            }

            MeshletBuilder.finishMeshlet(meshlet, meshlet_triangles);

            meshlet.vertex_offset += meshlet.vertex_count;
            meshlet.triangle_offset += (meshlet.triangle_count * 3 + 3) & ~3; // 4b padding
            meshlet.vertex_count = 0;
            meshlet.triangle_count = 0;

            result = true;
        }

        if (av === 0xff) {
            av = meshlet.vertex_count;
            meshlet_vertices[meshlet.vertex_offset + meshlet.vertex_count++] = a;
            used[a] = av; // Update the used array with the new value
        }

        if (bv === 0xff) {
            bv = meshlet.vertex_count;
            meshlet_vertices[meshlet.vertex_offset + meshlet.vertex_count++] = b;
            used[b] = bv; // Update the used array with the new value
        }

        if (cv === 0xff) {
            cv = meshlet.vertex_count;
            meshlet_vertices[meshlet.vertex_offset + meshlet.vertex_count++] = c;
            used[c] = cv; // Update the used array with the new value
        }

        meshlet_triangles[meshlet.triangle_offset + meshlet.triangle_count * 3 + 0] = av;
        meshlet_triangles[meshlet.triangle_offset + meshlet.triangle_count * 3 + 1] = bv;
        meshlet_triangles[meshlet.triangle_offset + meshlet.triangle_count * 3 + 2] = cv;
        meshlet.triangle_count++;

        return result;
    }

    private static getNeighborTriangle(meshlet: MeshoptMeshlet, meshletCone: Cone | null, meshletVertices: Uint32Array, indices: Uint32Array, adjacency: TriangleAdjacency2, triangles: Cone[], liveTriangles: Uint32Array, used: Uint8Array, meshletExpectedRadius: number, coneWeight: number, outExtra: number[] | null): number {
        let bestTriangle = -1;
        let bestExtra = 5;
        let bestScore = Number.MAX_VALUE;

        for (let i = 0; i < meshlet.vertex_count; ++i) {
            let index = meshletVertices[meshlet.vertex_offset + i];
            let neighborsStartIndex = adjacency.offsets[index];
            let neighborsSize = adjacency.counts[index];

            for (let j = 0; j < neighborsSize; ++j) {
                let triangle = adjacency.data[neighborsStartIndex + j];
                let a = indices[triangle * 3 + 0], b = indices[triangle * 3 + 1], c = indices[triangle * 3 + 2];

                let extra = (used[a] === 0xff ? 1 : 0) + (used[b] === 0xff ? 1 : 0) + (used[c] === 0xff ? 1 : 0);

                if (extra !== 0) {
                    if (liveTriangles[a] === 1 || liveTriangles[b] === 1 || liveTriangles[c] === 1) {
                        extra = 0;
                    }

                    extra++;
                }

                if (extra > bestExtra) {
                    continue;
                }

                let score = 0;

                if (meshletCone) {
                    const triCone = triangles[triangle];
                    const distance2 = (triCone.px - meshletCone.px) ** 2 + (triCone.py - meshletCone.py) ** 2 + (triCone.pz - meshletCone.pz) ** 2;
                    const spread = triCone.nx * meshletCone.nx + triCone.ny * meshletCone.ny + triCone.nz * meshletCone.nz;
                    score = MeshletBuilder.getMeshletScore(distance2, spread, coneWeight, meshletExpectedRadius);
                } else {
                    score = liveTriangles[a] + liveTriangles[b] + liveTriangles[c] - 3;
                }

                if (extra < bestExtra || score < bestScore) {
                    bestTriangle = triangle;
                    bestExtra = extra;
                    bestScore = score;
                }
            }
        }

        if (outExtra !== null) {
            outExtra[0] = bestExtra;
        }

        return bestTriangle;
    }

    private static kdtreePartition(indices: Uint32Array, count: number, points: Float32Array, stride: number, axis: number, pivot: number): number {
        let m = 0;
        for (let i = 0; i < count; ++i) {
            const v = points[indices[i] * stride + axis];
            const t = indices[m];
            indices[m] = indices[i];
            indices[i] = t;
            m += v < pivot ? 1 : 0;
        }
        return m;
    }

    private static kdtreeBuildLeaf(offset: number, nodes: KDNode[], nodeCount: number, indices: Uint32Array, count: number): number {
        if (offset + count > nodeCount) throw new Error("Offset + count must not exceed node count");

        const result = nodes[offset];
        result.index = indices[0];
        result.axis = 3;
        result.children = count - 1;

        for (let i = 1; i < count; ++i) {
            const tail = nodes[offset + i];
            tail.index = indices[i];
            tail.axis = 3;
            tail.children = 0xFFFFFFFF >>> 2; // Equivalent to setting a large value for children
        }

        return offset + count;
    }

    private static kdtreeBuild(offset: number, nodes: KDNode[], nodeCount: number, points: Float32Array, stride: number, indices: Uint32Array, count: number, leafSize: number): number {
        if (count <= 0 || offset >= nodeCount) throw new Error("Invalid input parameters");

        if (count <= leafSize) return MeshletBuilder.kdtreeBuildLeaf(offset, nodes, nodeCount, indices, count);

        const mean = new Float32Array(3);
        const vars = new Float32Array(3);
        let runc = 1, runs = 1;

        for (let i = 0; i < count; ++i, runc += 1.0, runs = 1.0 / runc) {
            const point = points.subarray(indices[i] * stride, indices[i] * stride + 3);

            for (let k = 0; k < 3; ++k) {
                const delta = point[k] - mean[k];
                mean[k] += delta * runs;
                vars[k] += delta * (point[k] - mean[k]);
            }
        }

        let axis = vars[0] >= vars[1] && vars[0] >= vars[2] ? 0 : vars[1] >= vars[2] ? 1 : 2;

        const split = mean[axis];
        const middle = MeshletBuilder.kdtreePartition(indices, count, points, stride, axis, split);

        if (middle <= leafSize / 2 || middle >= count - leafSize / 2) {
            return MeshletBuilder.kdtreeBuildLeaf(offset, nodes, nodeCount, indices, count);
        }

        const result = nodes[offset];
        result.split = split;
        result.axis = axis;
        const nextOffset = MeshletBuilder.kdtreeBuild(offset + 1, nodes, nodeCount, points, stride, indices, middle, leafSize);
        result.children = nextOffset - offset - 1;

        return MeshletBuilder.kdtreeBuild(nextOffset, nodes, nodeCount, points, stride, indices.subarray(middle), count - middle, leafSize);
    }

    // Adapted for TypeScript. You might need to adjust how `emittedFlags` is passed and checked since TypeScript
    // doesn't have `unsigned char*`. You could use a `Uint8Array` or a boolean array depending on your use case.
    private static kdtreeNearest(nodes: KDNode[], root: number, points: Float32Array, stride: number, emittedFlags: Uint8Array, position: Float32Array, result: { index: number, limit: number }) {
        const node = nodes[root];

        if (node.axis === 3) {
            for (let i = 0; i <= node.children; ++i) {
                const index = nodes[root + i].index;

                if (emittedFlags[index]) continue;

                const point = points.subarray(index * stride, index * stride + 3);

                const distance2 =
			    (point[0] - position[0]) * (point[0] - position[0]) +
			    (point[1] - position[1]) * (point[1] - position[1]) +
			    (point[2] - position[2]) * (point[2] - position[2]);
                const distance = Math.sqrt(distance2);

                if (distance < result.limit) {
                    result.index = index;
                    result.limit = distance;
                }
            }
        } else {
            const delta = position[node.axis] - node.split;
            const first = delta <= 0 ? 0 : node.children;
            const second = first ^ node.children;

            MeshletBuilder.kdtreeNearest(nodes, root + 1 + first, points, stride, emittedFlags, position, result);

            if (Math.abs(delta) <= result.limit) {
                MeshletBuilder.kdtreeNearest(nodes, root + 1 + second, points, stride, emittedFlags, position, result);
            }
        }
    }





    public static meshopt_buildMeshlets(meshlets: MeshoptMeshlet[], meshlet_vertices: Uint32Array, meshlet_triangles: Uint8Array, indices: Uint32Array, index_count: number, vertex_positions: Float32Array, vertex_count: number, vertex_positions_stride: number, max_vertices: number, max_triangles: number, cone_weight: number) {
        assert(index_count % 3 == 0);
        assert(vertex_positions_stride >= 12 && vertex_positions_stride <= 256);
        // assert(vertex_positions_stride % sizeof(float) == 0);

        assert(max_vertices >= 3 && max_vertices <= MeshletBuilder.kMeshletMaxVertices);
        assert(max_triangles >= 1 && max_triangles <= MeshletBuilder.kMeshletMaxTriangles);
        assert(max_triangles % 4 == 0); // ensures the caller will compute output space properly as index data is 4b aligned

        assert(cone_weight >= 0 && cone_weight <= 1);

        // meshopt_Allocator allocator;

        const adjacency: TriangleAdjacency2 = {counts: new Uint32Array(0), offsets: new Uint32Array(0), data: new Uint32Array(0)};
        MeshletBuilder.buildTriangleAdjacency(adjacency, indices, index_count, vertex_count);

        let live_triangles: Uint32Array = adjacency.counts.slice();

        const face_count = index_count / 3;

        const emitted_flags: number[] = new Array(face_count).fill(0);

        // for each triangle, precompute centroid & normal to use for scoring
        const triangles: Cone[] = new Array<Cone>(face_count);
        const mesh_area = MeshletBuilder.computeTriangleCones(triangles, indices, index_count, vertex_positions, vertex_count, vertex_positions_stride);

        // assuming each meshlet is a square patch, expected radius is sqrt(expected area)
        const triangle_area_avg = face_count == 0 ? 0.0 : mesh_area / face_count * 0.5;
        const meshlet_expected_radius = Math.sqrt(triangle_area_avg * max_triangles) * 0.5;

        // build a kd-tree for nearest neighbor lookup
        const kdindices: number[] = new Array(face_count);
        for (let i = 0; i < face_count; ++i) {
            kdindices[i] = i;
        }

        const nodes: KDNode[] = new Array<KDNode>(face_count * 2);
        MeshletBuilder.kdtreeBuild(0, nodes, face_count * 2, triangles[0].px, sizeof(Cone) / sizeof(float), kdindices, face_count, /* leaf_size= */ 8);

        // index of the vertex in the meshlet, 0xff if the vertex isn't used
        const used: Uint8Array = new Uint8Array(vertex_count).fill(-1);

        const meshlet: MeshoptMeshlet = {triangle_offset: 0, triangle_count: 0, vertex_offset: 0, vertex_count: 0};
        let meshlet_offset = 0;

        let meshlet_cone_acc: Cone = new Cone(0,0,0,0,0,0);

        for (; ;) {
            const meshlet_cone: Cone = MeshletBuilder.getMeshletCone(meshlet_cone_acc, meshlet.triangle_count);

            let best_extra: number[] = [0];
            let best_triangle = MeshletBuilder.getNeighborTriangle(meshlet, meshlet_cone, meshlet_vertices, indices, adjacency, triangles, live_triangles, used, meshlet_expected_radius, cone_weight, best_extra);

            // if the best triangle doesn't fit into current meshlet, the spatial scoring we've used is not very meaningful, so we re-select using topological scoring
            if (best_triangle != ~0 && (meshlet.vertex_count + best_extra[0] > max_vertices || meshlet.triangle_count >= max_triangles)) {
                best_triangle = MeshletBuilder.getNeighborTriangle(meshlet, null, meshlet_vertices, indices, adjacency, triangles, live_triangles, used, meshlet_expected_radius, 0.0, null);
            }

            // when we run out of neighboring triangles we need to switch to spatial search; we currently just pick the closest triangle irrespective of connectivity
            if (best_triangle == ~0) {
                const position: number[] = [meshlet_cone.px, meshlet_cone.py, meshlet_cone.pz];
                const result = {index: ~0, limit: 20000000000};

                MeshletBuilder.kdtreeNearest(nodes, 0, triangles[0].px, sizeof(Cone) / sizeof(float), emitted_flags, position, result);

                best_triangle = result.index;
            }

            if (best_triangle == ~0)
                break;

            const a = indices[best_triangle * 3 + 0], b = indices[best_triangle * 3 + 1], c = indices[best_triangle * 3 + 2];
            assert(a < vertex_count && b < vertex_count && c < vertex_count);

            // add meshlet to the output; when the current meshlet is full we reset the accumulated bounds
            if (MeshletBuilder.appendMeshlet(meshlet, a, b, c, used, meshlets, meshlet_vertices, meshlet_triangles, meshlet_offset, max_vertices, max_triangles)) {
                meshlet_offset++;
                meshlet_cone_acc = new Cone(0,0,0,0,0,0);
            }

            live_triangles[a]--;
            live_triangles[b]--;
            live_triangles[c]--;

            // remove emitted triangle from adjacency data
            // this makes sure that we spend less time traversing these lists on subsequent iterations
            for (let k = 0; k < 3; ++k) {
                const index = indices[best_triangle * 3 + k];

                const neighbors: number = adjacency.data[0] + adjacency.offsets[index];
                const neighbors_size = adjacency.counts[index];

                for (let i = 0; i < neighbors_size; ++i) {
                    const tri = neighbors[i];

                    if (tri == best_triangle) {
                        neighbors[i] = neighbors[neighbors_size - 1];
                        adjacency.counts[index]--;
                        break;
                    }
                }
            }

            // update aggregated meshlet cone data for scoring subsequent triangles
            meshlet_cone_acc.px += triangles[best_triangle].px;
            meshlet_cone_acc.py += triangles[best_triangle].py;
            meshlet_cone_acc.pz += triangles[best_triangle].pz;
            meshlet_cone_acc.nx += triangles[best_triangle].nx;
            meshlet_cone_acc.ny += triangles[best_triangle].ny;
            meshlet_cone_acc.nz += triangles[best_triangle].nz;

            emitted_flags[best_triangle] = 1;
        }

        if (meshlet.triangle_count) {
            MeshletBuilder.finishMeshlet(meshlet, meshlet_triangles);

            meshlets[meshlet_offset++] = meshlet;
        }

        assert(meshlet_offset <= MeshletBuilder.meshopt_buildMeshletsBound(index_count, max_vertices, max_triangles));
        return meshlet_offset;
    }





    private static meshopt_buildMeshletsBound(index_count: number, max_vertices: number, max_triangles: number): number {
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

    public static meshopt_buildMeshletsScan(destination: meshopt_Meshlet[], indices: Uint16Array, index_count: number, vertex_count: number, max_vertices: number, max_triangles: number): number {
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

        for (let i = 0; i < index_count; i += 3) {
            const a = indices[i + 0], b = indices[i + 1], c = indices[i + 2];
            assert(a < vertex_count && b < vertex_count && c < vertex_count);

            let av = used[a]; // pointer
            let bv = used[b]; // pointer
            let cv = used[c]; // pointer

            const avCheck = (av == 0xff) ? 1 : 0;
            const bvCheck = (bv == 0xff) ? 1 : 0;
            const cvCheck = (cv == 0xff) ? 1 : 0;
            const used_extra = avCheck + bvCheck + cvCheck;

            if (meshlet.vertex_count + used_extra > max_vertices || meshlet.triangle_count >= max_triangles) {
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

            if (av == 0xff) {
                av = meshlet.vertex_count;
                meshlet.vertices[meshlet.vertex_count++] = a;
            }

            if (bv == 0xff) {
                bv = meshlet.vertex_count;
                meshlet.vertices[meshlet.vertex_count++] = b;
            }

            if (cv == 0xff) {
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