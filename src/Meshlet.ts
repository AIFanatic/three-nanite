function hash(co: number) {
    function fract(n) {
        return n % 1;
    }

    return fract(Math.sin((co + 1) * 12.9898) * 43758.5453);
}

let seed = 0;
function seedRandom() {
    return Math.abs(hash(seed+=1));
}

export class Vertex {
    public x: number;
    public y: number;
    public z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
};

export class Triangle {
    public a: number;
    public b: number;
    public c: number;

    constructor(a: number, b: number, c: number) {
        this.a = a;
        this.b = b;
        this.c = c;
    }
}

export class Edge {
    public fromIndex: number;
    public toIndex: number;

    constructor(fromIndex: number, toIndex: number) {
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
    }

    public equal(other: Edge): boolean {
        return this.fromIndex === other.fromIndex && this.toIndex === other.toIndex;
    }

    public isAdjacent(other: Edge): boolean {
        return this.fromIndex === other.fromIndex ||
            this.fromIndex === other.toIndex ||
            this.toIndex === other.fromIndex ||
            this.toIndex === other.toIndex;
    }
};

export class Meshlet {
    public vertices_raw: Float32Array;
    public indices_raw: Uint32Array;

    public vertices: Vertex[];
    public triangles: Triangle[];
    public edges: Edge[];

    public boundaryEdges: Edge[];

    public id: number;

    constructor(vertices: Float32Array, indices: Uint32Array) {
        this.vertices_raw = vertices;
        this.indices_raw = indices;

        this.vertices = this.buildVertexMap(vertices);
        this.triangles = this.buildTriangleMap(indices);
        this.edges = this.buildEdgeMap(this.triangles);
        this.boundaryEdges = this.getBoundary(this.edges);

        this.id = Math.floor(seedRandom() * 10000000);
    }

    private buildVertexMap(vertices: Float32Array): Vertex[] {
        let vertex: Vertex[] = [];
        for (let i = 0; i < vertices.length; i += 3) {
            vertex.push(new Vertex(vertices[i + 0], vertices[i + 1], vertices[i + 2]));
        }
        return vertex;
    }

    private buildTriangleMap(indices: Uint32Array): Triangle[] {
        let triangles: Triangle[] = [];
        for (let i = 0; i < indices.length; i += 3) {
            triangles.push(new Triangle(indices[i + 0], indices[i + 1], indices[i + 2]));
        }
        return triangles;
    }

    private buildEdgeMap(triangles: Triangle[]): Edge[] {
        let edges: Edge[] = [];
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];

            const face = [triangle.a, triangle.b, triangle.c];

            for (let i = 0; i < 3; i++) {
                const startIndex = face[i];
                const endIndex = face[(i + 1) % 3];

                edges.push(new Edge(
                    Math.min(startIndex, endIndex),
                    Math.max(startIndex, endIndex)
                ))
            }
        }
        return edges;
    }

    private getBoundary(edges: Edge[]): Edge[] {
        let counts = new Array(edges.length).fill(0);

        for (let i = 0; i < edges.length; i++) {

            const a = edges[i];
            for (let j = 0; j < edges.length; j++) {
                const b = edges[j];

                if (a.fromIndex === b.fromIndex && a.toIndex === b.toIndex) {
                    counts[i]++;
                }
            }
        }

        let boundaryEdges: Edge[] = [];
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] == 1) {
                boundaryEdges.push(edges[i]);
            }
        }
        return boundaryEdges;
    }

    public getEdgeVertices(edge: Edge): Vertex[] {
        const from = edge.fromIndex;
        const to = edge.toIndex;
        return [this.vertices[from], this.vertices[to]];
    }

    // TODO: Clean this
    public getEdgeHash(edge: Edge): string {
        function hashVertex(vertex: Vertex): string {
            // const xh = hash(vertex.x + 11.1212);
            // const yh = hash(vertex.y + 23.5412);
            // const zh = hash(vertex.z + 34.7732);

            // const vertexHash = xh + yh + zh;
            // return Math.abs(Math.round(vertexHash * 1000000));

            // const xh = `${vertex.x}`;
            // const yh = `${vertex.x}`;
            // const zh = `${vertex.x}`;
            return `${vertex.x},${vertex.y},${vertex.z}`;
        }

        const edgeVertices = this.getEdgeVertices(edge);

        const fromVertexHash = hashVertex(edgeVertices[0]);
        const toVertexHash = hashVertex(edgeVertices[1]);
        // const edgeHash = fromVertexHash + toVertexHash;
        const edgeHash = `${fromVertexHash}:${toVertexHash}`;
        return edgeHash;
    }
}