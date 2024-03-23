import { Meshlet } from "./App"

export class MeshletGrouper {
    public indexed_by_vertex_id: Map<string, Meshlet[]>;

    constructor() {
        this.indexed_by_vertex_id = new Map();
    }

    private static rand(co: number[]) {
        function fract(n) {
            return n % 1;
        }

        function dot(v1: number[], v2: number[]) {
            return v1[0] * v2[0] + v1[1] * v2[1];
        }

        return fract(Math.sin(dot(co, [12.9898, 78.233])) * 43758.5453);
    }

    public static getVertexKey(x: number, y: number, z: number): string {
        // const xid = MeshletGrouper.rand([x, 1.121]);
        // const yid = MeshletGrouper.rand([y, 2.121]);
        // const zid = MeshletGrouper.rand([z, 3.121]);
        // let vertex_id = Math.floor((xid + yid + zid) * 100000);
        // return vertex_id;
        return `${x},${y},${z}`;
    }

    public addMeshlet(meshlet: Meshlet) {
        for (let i = 0; i < meshlet.vertices.length; i+=3) {
            const vertex_id = MeshletGrouper.getVertexKey(meshlet.vertices[i + 0], meshlet.vertices[i + 1], meshlet.vertices[i + 2]);

            let index_array = this.indexed_by_vertex_id.get(vertex_id);
            if (!index_array) {
                index_array = [];
            }

            if (index_array.indexOf(meshlet) === -1) {
                index_array.push(meshlet);
                this.indexed_by_vertex_id.set(vertex_id, index_array);
            }
        }
    }

    public getBorderVertices(meshlet: Meshlet): number[] {
        let borderVertexIds: number[] = [];
        for (let i = 0; i < meshlet.vertices.length; i+=3) {
            const vertex_id = MeshletGrouper.getVertexKey(meshlet.vertices[i + 0], meshlet.vertices[i + 1], meshlet.vertices[i + 2]);

            const adjacentMeshlets = this.indexed_by_vertex_id.get(vertex_id);
            if (adjacentMeshlets && adjacentMeshlets.length > 1) {
                borderVertexIds.push(i);
            }
        }
        return borderVertexIds;
    }

    public getAdjacentMeshlets(meshlet: Meshlet): Meshlet[] {
        let adjacentMeshlets: Meshlet[] = [];
        
        const borderVertexIds = this.getBorderVertices(meshlet);
        
        for (let i = 0; i < borderVertexIds.length; i++) {
            const vertex_id = borderVertexIds[i];
            const vertex_key = MeshletGrouper.getVertexKey(meshlet.vertices[vertex_id + 0], meshlet.vertices[vertex_id + 1], meshlet.vertices[vertex_id + 2]);
            
            const vertexAdjacentMeshlets = this.indexed_by_vertex_id.get(vertex_key);
            if (vertexAdjacentMeshlets && vertexAdjacentMeshlets.length > 1) {
                for (let j = 0; j < vertexAdjacentMeshlets.length; j++) {
                    const adjacentMeshlet = vertexAdjacentMeshlets[j];
                    
                    if (adjacentMeshlet === meshlet) continue;
                    if (adjacentMeshlets.indexOf(adjacentMeshlet) !== -1) continue;

                    adjacentMeshlets.push(adjacentMeshlet);
                }
            }
        }

        return adjacentMeshlets;
    }

    public buildAdjacentMeshletList(meshlets: Meshlet[]): Map<number, number[]> {
        let adjacencyList: Map<number, number[]> = new Map();

        for (let meshletId = 0; meshletId < meshlets.length; meshletId++) {
            const meshlet = meshlets[meshletId];
            const adjacentMeshlets = this.getAdjacentMeshlets(meshlet);
            let adjacencyArray = adjacencyList.get(meshletId);
            if (!adjacencyArray) adjacencyArray = [];

            for (let j = 0; j < adjacentMeshlets.length; j++) {
                const adjacentMeshlet = adjacentMeshlets[j];
                const adjacentMeshletId = meshlets.indexOf(adjacentMeshlet);

                if (adjacentMeshletId === -1) throw Error("Could not find adjacentMeshletId in meshlets, shouldn't happen");
                if (meshletId === adjacentMeshletId) continue;
                if (adjacencyArray.indexOf(adjacentMeshletId) !== -1) continue;

                adjacencyArray.push(adjacentMeshletId);
            }

            adjacencyList.set(meshletId, adjacencyArray);
        }
        return adjacencyList;
    }
}