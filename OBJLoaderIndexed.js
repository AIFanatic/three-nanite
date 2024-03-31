;
export class OBJLoaderIndexed {
    static *triangulate(elements) {
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
    static load(url, callback) {
        fetch(url).then((response) => response.text()).then((contents) => callback(OBJLoaderIndexed.parse(contents)));
    }
    static parse(contents) {
        const indices = [];
        const verts = [];
        let currentMaterialIndex = -1;
        let currentObjectByMaterialIndex = 0;
        const unpacked = {
            verts: [],
            hashindices: {},
            indices: [[]],
            index: 0
        };
        const VERTEX_RE = /^v\s/;
        const FACE_RE = /^f\s/;
        const WHITESPACE_RE = /\s+/;
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
                            unpacked.verts.push(+verts[(+vertex[0] - 1) * 3 + 0]);
                            unpacked.verts.push(+verts[(+vertex[0] - 1) * 3 + 1]);
                            unpacked.verts.push(+verts[(+vertex[0] - 1) * 3 + 2]);
                            unpacked.hashindices[hash] = unpacked.index;
                            unpacked.indices[currentObjectByMaterialIndex].push(unpacked.hashindices[hash]);
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
