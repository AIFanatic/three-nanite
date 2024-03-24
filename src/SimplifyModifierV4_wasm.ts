import * as SimplifyModifierModule from "./qms/qms.js";

import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OBJLoaderIndexed } from "./OBJLoaderIndexed.js";

export class SimplifyModifierV4_wasm {
    private static SimplifyModifier;

    public static async load() {
        if (!SimplifyModifierV4_wasm.SimplifyModifier) {
            SimplifyModifierV4_wasm.SimplifyModifier = await SimplifyModifierModule.default();
        }
    }

    public static async simplify(obj: THREE.Mesh, percentage: number) {
        await SimplifyModifierV4_wasm.load();

        try {
            this.SimplifyModifier.FS_unlink("test.obj");
        } catch (error) {}

        const exporter = new OBJExporter();
        const objString = exporter.parse(obj);

        const enc = new TextEncoder(); // always utf-8
        const data = enc.encode(objString);

        // var data = new Uint8Array(fr.result);
        this.SimplifyModifier.FS_createDataFile(".", "test.obj", data, true, true);

        // int simplify_obj(const char* file_path, const char* export_path, float reduceFraction, float agressiveness) {
        this.SimplifyModifier.ccall("simplify_obj", // c function name
            undefined, // return
            ["string", "string", "number", "number"], // param
            ["test.obj", "simplify_test.obj", percentage, 7]
        );

        let out_bin = this.SimplifyModifier.FS_readFile("simplify_test.obj");
        let file = new Blob([out_bin], {type: 'application/sla'});
        const outputObjString = await file.text();

        // const objLoader = new OBJLoader();
        // const outputObj2 = objLoader.parse(outputObjString).children[0];

        // return outputObj2;

        const outputObj = OBJLoaderIndexed.parse(outputObjString);

        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(outputObj.vertices, 3));
        g.setIndex(new THREE.Uint32BufferAttribute(outputObj.indices, 1));
        const mat = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(g, mat);
        return mesh;
    }
}