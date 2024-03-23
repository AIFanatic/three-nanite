# THREE-Nanite
### Note: The code is a mess at the moment.

[Live demo](https://aifanatic.github.io/three-nanite/dist/index.html)
<p align=center>
<img src="./screenshots/showcase.gif">
</p>

Note: This project is not finished and the code is not particularly clean or performant.

## Description
An attempt at reproducing a dynamic LOD in threejs similarly to unreal's nanite.
Very far from it but nonetheless a start.
<br>
For now it clusters triangles into a "Cluster hierarchy" and performs merge and simplify (page 46 of Nanite - A Deep Dive).

## References
[Nanite - A Deep Dive](https://advances.realtimerendering.com/s2021/Karis_Nanite_SIGGRAPH_Advances_2021_final.pdf)


## TODO:
- Make last step (Split simplified triangle list into clusters (128 tris))
(page 52 - nanite).
- Port everything into separate methods, so it can be called cleanly.
- Get rid of threejs in mergeBufferGeometries.
- Add Metis to perform grouping (uses MeshletEdgeFinder.getBoundary, needs metis port).
- SimplifyModifierV4 pass vertices and indices directly so it doesn't rely on threejs OBJExported and OBJLoader.