import { LOD, Mesh } from "three";
import { MeshletMesh } from "./MeshletMesh";

export class MeshletLOD extends LOD {
    constructor(meshes: MeshletMesh[]) {
        super();

        const factorStep = 100;
        let factor = 0;
        for (let i = 0; i < meshes.length; i++) {
            const mesh = new Mesh(meshes[i].geometry, meshes[i].material);
            this.addLevel(mesh, factor);
            factor += factorStep;
        }
    }
}