# THREE-Nanite
### Note: The code is a mess at the moment.

[Live demo](https://aifanatic.github.io/three-nanite/dist/index.html)
<p align=center>
<img src="./screenshots/showcase.png">
</p>

Photo description:
- 1: Original object.
- 2: Meshletized/Clustered: Using [meshoptimizer](https://github.com/zeux/meshoptimizer).
- 3: Grouped meshlets: Partitions adjacent meshlets into groups using [METIS](https://github.com/KarypisLab/METIS).
- 4: Merged grouped meshlets: Simply merges meshlets using THREE.js mergeGeometries.
- 5: Simplification: Simplify the mesh using [quadric mesh simplification](https://github.com/jannessm/quadric-mesh-simplification) (Garland 1997).
- 6: Split: Similar to step 2.

## Description
An attempt at reproducing a dynamic LOD in threejs similarly to unreal's nanite.
Very far from it but nonetheless a start.
<br>
For now it clusters triangles into a "Cluster hierarchy" and performs merge and simplify (page 46 of Nanite - A Deep Dive).

## References
[Nanite - A Deep Dive](https://advances.realtimerendering.com/s2021/Karis_Nanite_SIGGRAPH_Advances_2021_final.pdf)
<br />
[The Nanite System in Unreal Engine 5](https://www.medien.ifi.lmu.de/lehre/ws2122/gp/slides/gp-ws2122-extra-nanite.pdf)


## TODO:
- Build DAG and perform cuts
- Stream geometry to GPU