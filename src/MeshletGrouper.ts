import { Meshlet } from "./Meshlet"

export class MeshletGrouper {
    public static buildFacesFromIndices(indices: number[]): number[][] {
        const faces: number[][] = [];

        for (let j = 0; j < indices.length; j += 3) {
            const f0 = indices[j];
            const f1 = indices[j + 1];
            const f2 = indices[j + 2];
            faces.push([f0, f1, f2]);
        }
        return faces;
    }

    public static getFacesFromIndices(faceIndices: number[], faces: number[][]): number[][] {
        return faceIndices.map(faceIndex => faces[faceIndex]);
    }

    public static buildFaceAdjacencyMatrix(faces: number[][]): number[][] {
        // Map to track which faces are connected to which edges
        const edgeToFaceMap = new Map<string, number[]>();

        // Populate edgeToFaceMap
        for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
            const face = faces[faceIndex];

            for (let i = 0; i < 3; i++) {
                const startIndex = face[i];
                const endIndex = face[(i + 1) % 3];
                const edgeKey = `${Math.min(startIndex, endIndex)}:${Math.max(startIndex, endIndex)}`;

                let edgeArray = edgeToFaceMap.get(edgeKey);
                if (!edgeArray) edgeArray = [];
                edgeArray.push(faceIndex);
                edgeToFaceMap.set(edgeKey, edgeArray);
            }
        }

        // Adjacency list for faces, initially no faces are connected
        const faceAdjacencyList: number[][] = faces.map(() => []);

        // Fill faceAdjacencyList based on shared edges
        for (let [_, connectedFaces] of edgeToFaceMap) {
            if (connectedFaces.length !== 2) continue;
            const [faceA, faceB] = connectedFaces;
            faceAdjacencyList[faceA].push(faceB);
            faceAdjacencyList[faceB].push(faceA);
        }

        return faceAdjacencyList;
    }

    public static cleanOrphanedVertices(_vertices: number[], _faces: number[]): { cleanedVertices: number[], cleanedFaces: number[] } {
        const vertices = MeshletGrouper.buildFacesFromIndices(_vertices);
        const faces = MeshletGrouper.buildFacesFromIndices(_faces);

        const vertexMap = new Map<number, number>(); // Maps old vertex indices to new
        let cleanedVertices: number[][] = [];
        let cleanedFaces: number[][] = faces.map(face => {
            return face.map(vertexIndex => {
                // Check if we already have this vertex in the cleaned list
                if (vertexMap.has(vertexIndex)) {
                    return vertexMap.get(vertexIndex);
                } else {
                    // Add new vertex to the cleaned list and update the mapping
                    const newVertexIndex = cleanedVertices.length;
                    if (vertices[vertexIndex]) {
                        cleanedVertices.push(vertices[vertexIndex]);
                        vertexMap.set(vertexIndex, newVertexIndex);
                        return newVertexIndex;
                    }
                }
            });
        });

        return {
            cleanedVertices: cleanedVertices.flat(),
            cleanedFaces: cleanedFaces.flat()
        };
    }

    public static rebuildMeshletsFromGroupIndices(vertices: Float32Array, faces: number[][], groups: number[][]) {
        let groupsByFaces: number[][] = new Array(groups.length);

        for (let i = 0; i < groups.length; i++) {
            groupsByFaces[i] = MeshletGrouper.getFacesFromIndices(groups[i], faces).flat();
        }

        let groupedMeshlets: Meshlet[] = [];

        for (let i = 0; i < groupsByFaces.length; i++) {

            const { cleanedVertices, cleanedFaces } = MeshletGrouper.cleanOrphanedVertices(vertices, groupsByFaces[i]);

            const meshlet = new Meshlet(Float32Array.from(cleanedVertices), Uint32Array.from(cleanedFaces));

            groupedMeshlets.push(meshlet);
        }

        return groupedMeshlets;
    }


}