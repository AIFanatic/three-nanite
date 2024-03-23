import * as SimplifyModifierModule from "./qms/qms.js";

import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OBJLoaderIndexed } from "./OBJLoaderIndexed.js";

export class SimplifyModifierV4 {
    private static SimplifyModifier;

    public static async load() {
        if (!SimplifyModifierV4.SimplifyModifier) {
            SimplifyModifierV4.SimplifyModifier = await SimplifyModifierModule.default();
        }
    }

    public static async simplify(obj: THREE.Mesh, percentage: number) {
        await SimplifyModifierV4.load();

        try {
            this.SimplifyModifier.FS_unlink("test.obj");
        } catch (error) {}

        const exporter = new OBJExporter();
        const objString = exporter.parse(obj);

        const enc = new TextEncoder(); // always utf-8
        const data = enc.encode(objString);

        // var data = new Uint8Array(fr.result);
        this.SimplifyModifier.FS_createDataFile(".", "test.obj", data, true, true);

        this.SimplifyModifier.ccall("simplify", // c function name
            undefined, // return
            ["string", "number", "string"], // param
            ["test.obj", percentage, "simplify_test.obj"]
        );

        let out_bin = this.SimplifyModifier.FS_readFile("simplify_test.obj");
        let file = new Blob([out_bin], {type: 'application/sla'});
        const outputObjString = await file.text();

        const objLoader = new OBJLoader();
        const outputObj2 = objLoader.parse(outputObjString).children[0];
        return outputObj2;

        // const outputObj = OBJLoaderIndexed.parse(outputObjString);
        // const g = new THREE.BufferGeometry();
        // g.setAttribute("position", new THREE.Float32BufferAttribute(outputObj.vertices, 3));
        // g.setIndex(new THREE.Uint32BufferAttribute(outputObj.indices, 1));
        // const mat = new THREE.MeshBasicMaterial();
        // const mesh = new THREE.Mesh(g, mat);
    }
}