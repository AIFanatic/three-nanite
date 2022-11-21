import { BufferGeometry, Triangle, Vector3 } from "three";

interface ITriangle {
    triangle: Triangle;
    midpoint: Vector3;
    index: number;
    used: boolean;
}

export class GeometryCluster {
    public static Vector3Equal(a: Vector3, b: Vector3) {
        const EPSILON = 0.001;
        return Math.abs(a.x - b.x) < EPSILON &&
        Math.abs(a.y - b.y) < EPSILON && 
        Math.abs(a.z - b.z) < EPSILON;
    }

    public static GetNeighbouringTriangles(triangle: ITriangle, triangles: ITriangle[]): ITriangle[] {
        let neighbours = [];

        for (let neighbourTriangle of triangles) {
            if (neighbourTriangle.index === triangle.index) continue;

            let sharedVertices = 0;
            sharedVertices += this.Vector3Equal(triangle.triangle.a, neighbourTriangle.triangle.a) ? 1 : 0;
            sharedVertices += this.Vector3Equal(triangle.triangle.a, neighbourTriangle.triangle.b) ? 1 : 0;
            sharedVertices += this.Vector3Equal(triangle.triangle.a, neighbourTriangle.triangle.c) ? 1 : 0;

            sharedVertices += this.Vector3Equal(triangle.triangle.b, neighbourTriangle.triangle.a) ? 1 : 0;
            sharedVertices += this.Vector3Equal(triangle.triangle.b, neighbourTriangle.triangle.b) ? 1 : 0;
            sharedVertices += this.Vector3Equal(triangle.triangle.b, neighbourTriangle.triangle.c) ? 1 : 0;

            sharedVertices += this.Vector3Equal(triangle.triangle.c, neighbourTriangle.triangle.a) ? 1 : 0;
            sharedVertices += this.Vector3Equal(triangle.triangle.c, neighbourTriangle.triangle.b) ? 1 : 0;
            sharedVertices += this.Vector3Equal(triangle.triangle.c, neighbourTriangle.triangle.c) ? 1 : 0;

            if (sharedVertices >= 2) {
                neighbours.push(neighbourTriangle);
            }
        }

        return neighbours;
    }

    public static GetTrianglesForGeometry(_geometry: BufferGeometry): ITriangle[] {
        let triangles: ITriangle[] = [];

        const geometry = _geometry.clone().toNonIndexed();
        const positions = geometry.getAttribute("position").array;

        // Get triangles
        let triangleIndex = 0;
        for (let i = 0; i < positions.length; i+=9) {
            const a = new Vector3(positions[i+0], positions[i+1], positions[i+2]);
            const b = new Vector3(positions[i+3], positions[i+4], positions[i+5]);
            const c = new Vector3(positions[i+6], positions[i+7], positions[i+8]);
        
            const triangle = new Triangle(a, b, c);
            const midpoint = new Vector3();
            triangle.getMidpoint(midpoint);

            triangles.push({
                triangle: triangle,
                index: triangleIndex,
                midpoint: midpoint,
                used: false
            });
            triangleIndex++;
        }
        return triangles;
    }

    public static Cluster(_geometry: BufferGeometry, numOfClusters: number): ITriangle[][] {
        const geometry = _geometry.clone().toNonIndexed();
        const positions = geometry.getAttribute("position").array;

        // Get triangles
        let triangles: ITriangle[] = [];
        let triangleIndex = 0;
        for (let i = 0; i < positions.length; i+=9) {
            const a = new Vector3(positions[i+0], positions[i+1], positions[i+2]);
            const b = new Vector3(positions[i+3], positions[i+4], positions[i+5]);
            const c = new Vector3(positions[i+6], positions[i+7], positions[i+8]);
        
            const triangle = new Triangle(a, b, c);
            const midpoint = new Vector3();
            triangle.getMidpoint(midpoint);

            triangles.push({
                triangle: triangle,
                midpoint: midpoint,
                index: triangleIndex,
                used: false
            });

            triangleIndex++;
        }

        // Calculate clusters
        let clusterTriangles: ITriangle[][] = [];
        const trianglesPerCluster = Math.floor(triangles.length / numOfClusters);
        // console.log(triangles)
        // console.log(trianglesPerCluster)
        for (let clusterIndex = 0; clusterIndex < numOfClusters; clusterIndex++) {
            clusterTriangles[clusterIndex] = [];

            for (let triangleI of triangles) {
                if (triangleI.used) continue;

                if (clusterTriangles[clusterIndex].length >= trianglesPerCluster) {
                    // console.log("broke1", clusterTriangles[clusterIndex].length);
                    break;
                }
                clusterTriangles[clusterIndex].push(triangleI);
                triangleI.used = true;


                let closestTriangle: ITriangle = null;
                let closestDistance = Infinity;

                for (let triangleJ of triangles) {
                    if (triangleJ.used) continue;
                    if (triangleI === triangleJ) continue;

                    const dist = triangleI.midpoint.distanceTo(triangleJ.midpoint);
                    if (dist < closestDistance) {
                        closestDistance = dist;
                        closestTriangle = triangleJ;
                    }
                }

                if (closestTriangle !== null) {
                    if (clusterTriangles[clusterIndex].length >= trianglesPerCluster) {
                        // console.log("broke2");
                        break;
                    }
                    clusterTriangles[clusterIndex].push(closestTriangle);
                    closestTriangle.used = true;
                    // console.log(triangleI.index, closestTriangle.index);
                }
            }
        }

        // console.log(triangles)
        // console.log(clusterTriangles);
        return clusterTriangles;
    }
    constructor(_geometry: BufferGeometry, numOfClusters: number) {
        const geometry = _geometry.clone().toNonIndexed();
        const positions = geometry.getAttribute("position").array;

        // Get triangles
        let triangles: ITriangle[] = [];
        let triangleIndex = 0;
        for (let i = 0; i < positions.length; i+=9) {
            const a = new Vector3(positions[i+0], positions[i+1], positions[i+2]);
            const b = new Vector3(positions[i+3], positions[i+4], positions[i+5]);
            const c = new Vector3(positions[i+6], positions[i+7], positions[i+8]);
        
            const triangle = new Triangle(a, b, c);
            const midpoint = new Vector3();
            triangle.getMidpoint(midpoint);

            triangles.push({
                triangle: triangle,
                midpoint: midpoint,
                index: triangleIndex,
                used: false
            });

            triangleIndex++;
        }

        // Calculate clusters
        let clusterTriangles = [];
        const trianglesPerCluster = Math.floor(triangles.length / numOfClusters);
        console.log(triangles)
        console.log(trianglesPerCluster)
        for (let clusterIndex = 0; clusterIndex < numOfClusters; clusterIndex++) {
            clusterTriangles[clusterIndex] = [];

            for (let triangleI of triangles) {
                if (triangleI.used) continue;

                if (clusterTriangles[clusterIndex].length >= trianglesPerCluster) {
                    console.log("broke1", clusterTriangles[clusterIndex].length);
                    break;
                }
                clusterTriangles[clusterIndex].push(triangleI);
                triangleI.used = true;


                let closestTriangle: ITriangle = null;
                let closestDistance = Infinity;

                for (let triangleJ of triangles) {
                    if (triangleJ.used) continue;
                    if (triangleI === triangleJ) continue;

                    const dist = triangleI.midpoint.distanceTo(triangleJ.midpoint);
                    if (dist < closestDistance) {
                        closestDistance = dist;
                        closestTriangle = triangleJ;
                    }
                }

                if (closestTriangle !== null) {
                    if (clusterTriangles[clusterIndex].length >= trianglesPerCluster) {
                        console.log("broke2");
                        break;
                    }
                    clusterTriangles[clusterIndex].push(closestTriangle);
                    closestTriangle.used = true;
                    console.log(triangleI.index, closestTriangle.index);
                }
            }
        }

        console.log(triangles)
        console.log(clusterTriangles);
    }
}