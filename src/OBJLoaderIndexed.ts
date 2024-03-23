// From: https://github.com/frenchtoast747/webgl-obj-loader/blob/master/src/mesh.ts
// This method is needed because THREE.OBJLoader creates a triangle soup instead of
// shared vertices. This screws up the mesh for the simplifier.
// Even when using mergeVertices, duplicate vertices are still present even though
// indices are created.
// Note that this method doesn't support uvs, normals, tangents, etc.

interface UnpackedAttrs {
    verts: number[];
    hashindices: { [k: string]: number };
    indices: number[][];
    index: number;
}

export interface OBJMesh {
    vertices: Float32Array,
    indices: Uint32Array
};

export class OBJLoaderIndexed {
    public static* triangulate(elements: string[]) {
        if (elements.length <= 3) {
            yield elements;
        } else if (elements.length === 4) {
            yield [elements[0], elements[1], elements[2]];
            yield [elements[2], elements[3], elements[0]];
        } else {
            for (let i = 1; i < elements.length - 1; i++) {
                yield [elements[0], elements[i], elements[i + 1]];
            }
        }
    }

    public static load(url: string, callback: (contents: OBJMesh) => void) {
        fetch(url).then(response => response.text()).then(contents => callback(OBJLoaderIndexed.parse(contents)));
    }

    public static parse(contents: string): OBJMesh {
        const indices = [];

        const verts: string[] = [];
        let currentMaterialIndex = -1;
        let currentObjectByMaterialIndex = 0;
        // unpacking stuff
        const unpacked: UnpackedAttrs = {
            verts: [],
            hashindices: {},
            indices: [[]],
            index: 0,
        };

        const VERTEX_RE = /^v\s/;
        const FACE_RE = /^f\s/;
        const WHITESPACE_RE = /\s+/;

        // array of lines separated by the newline
        const lines = contents.split("\n");

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith("#")) {
                continue;
            }
            const elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) {
                verts.push(...elements);
            } else if (FACE_RE.test(line)) {
                const triangles = OBJLoaderIndexed.triangulate(elements);
                for (const triangle of triangles) {
                    for (let j = 0, eleLen = triangle.length; j < eleLen; j++) {
                        const hash = triangle[j] + "," + currentMaterialIndex;
                        if (hash in unpacked.hashindices) {
                            unpacked.indices[currentObjectByMaterialIndex].push(unpacked.hashindices[hash]);
                        } else {
                            const vertex = triangle[j].split("/");
                            
                            // Vertex position
                            unpacked.verts.push(+verts[(+vertex[0] - 1) * 3 + 0]);
                            unpacked.verts.push(+verts[(+vertex[0] - 1) * 3 + 1]);
                            unpacked.verts.push(+verts[(+vertex[0] - 1) * 3 + 2]);
                            // add the newly created Vertex to the list of indices
                            unpacked.hashindices[hash] = unpacked.index;
                            unpacked.indices[currentObjectByMaterialIndex].push(unpacked.hashindices[hash]);
                            // increment the counter
                            unpacked.index += 1;
                        }
                    }
                }
            }
        }

        return {
            vertices: new Float32Array(unpacked.verts),
            indices: new Uint32Array(unpacked.indices[currentObjectByMaterialIndex])
        };
    }
}
