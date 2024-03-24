#include "emscripten.h"
#include "include/metis.h"
#include <stdlib.h> // required for malloc definition
#include <stdio.h>


/**
 */
EMSCRIPTEN_KEEPALIVE
int metis_part_graph_kway(
    idx_t nvtxs,    // number of vertices
    idx_t ncon,     // number of constraints
    idx_t *xadj,    // Pointers to the locally stored vertices
    idx_t *adjncy,  // Array that stores the adjacency lists of nvtxs
    idx_t *vwgt,    // Vertex weights
    idx_t *vsize,   // Vertex sizes for min-volume formulation
    idx_t *adjwgt,  // Array that stores the weights of the adjacency lists
    idx_t nparts,   // The number of partitions
    real_t *tpwgts, // The target partition weights
    real_t *ubvec,  // ??
    idx_t *options, // options vector with pointers to relevant things
    idx_t *objval,  // Objective value will be written here
    idx_t *part     // where partitions should be written to, size equal to number of vertices
)
{

    int status = METIS_PartGraphKway(
        &nvtxs,
        &ncon,
        xadj,
        adjncy,
        vwgt,
        vsize,
        adjwgt,
        &nparts,
        tpwgts,
        ubvec,
        options,
        objval,
        part);

    return status;
}

EMSCRIPTEN_KEEPALIVE
int metis_part_graph_kway_v2(
    idx_t nvtxs,   // number of vertices
    idx_t *xadj,   // Pointers to the locally stored vertices
    idx_t *adjncy, // Array that stores the adjacency lists of nvtxs
    idx_t nparts,  // The number of partitions
    idx_t *objval, // Objective value will be written here
    idx_t *part    // where partitions should be written to, size equal to number of vertices
)
{

    // idx_t ncon = 1;

    // int status = METIS_PartGraphKway(
    //     &nvtxs,
    //     &ncon,
    //     xadj,
    //     adjncy,
    //     NULL,
    //     NULL,
    //     NULL,
    //     &nparts,
    //     NULL,
    //     NULL,
    //     NULL,
    //     objval,
    //     part);

    // printf("objval: %i\n", *objval);






    idx_t nVertices = 39;
    idx_t nWeights = 1;
    idx_t nParts = 10;

    idx_t objval2;
    idx_t part2[nVertices];

    // Indexes of starting points in adjacent array
    idx_t xadj2[] = {0, 5, 11, 15, 22, 27, 33, 40, 45, 52, 56, 62, 67, 71, 77, 83, 88, 94, 100, 106, 111, 116, 123, 128, 135, 140, 147, 151, 160, 165, 171, 179, 188, 202, 213, 217, 219, 223, 226, 228};

    // Adjacent vertices in consecutive index order
    idx_t adjncy2[] = {6,1,11,8,10,0,6,4,2,12,32,1,4,3,32,2,32,5,29,4,28,33,2,3,1,5,6,4,6,3,29,31,7,4,5,1,7,8,0,31,6,5,31,8,32,7,6,0,9,32,31,10,8,32,10,18,9,8,0,11,18,16,0,10,12,16,13,11,1,13,32,12,11,32,16,14,15,13,32,15,21,27,22,14,13,21,16,17,15,13,11,17,18,10,16,15,21,18,20,19,16,17,10,9,19,32,17,18,32,20,31,17,19,21,30,31,20,17,15,14,30,22,23,14,21,27,23,26,22,21,27,24,30,34,33,23,27,26,33,25,24,33,30,29,26,28,27,25,24,22,27,26,22,24,23,14,28,32,25,33,27,25,33,3,29,28,3,5,25,30,31,29,20,31,21,25,23,33,34,29,30,20,5,7,19,6,32,8,31,19,18,7,8,9,12,14,13,1,2,3,27,33,32,3,27,28,30,25,24,36,34,37,23,33,23,30,35,34,36,35,37,38,33,36,33,38,37,36};

    // int ret = METIS_PartGraphRecursive(&nVertices,& nWeights, xadj2, adjncy2,
    // 				       NULL, NULL, NULL, &nParts, NULL,
    // 				       NULL, NULL, &objval2, part);

    int status = METIS_PartGraphKway(&nVertices, &nWeights, xadj2, adjncy2,
                                  NULL, NULL, NULL, &nParts, NULL,
                                  NULL, NULL, &objval2, part2);

    printf("status: %i\n", status);
    printf("objval: %i\n", objval2);

    for (unsigned part_i = 0; part_i < nVertices; part_i++)
    {
        printf("%i %i\n", part_i, part2[part_i]);
    }

    return status;
}

EMSCRIPTEN_KEEPALIVE
int metis_part_graph_recursive(
    idx_t nvtxs,    // number of vertices
    idx_t ncon,     // number of constraints
    idx_t *xadj,    // Pointers to the locally stored vertices
    idx_t *adjncy,  // Array that stores the adjacency lists of nvtxs
    idx_t *vwgt,    // Vertex weights
    idx_t *vsize,   // Vertex sizes for min-volume formulation
    idx_t *adjwgt,  // Array that stores the weights of the adjacency lists
    idx_t nparts,   // The number of partitions
    real_t *tpwgts, // The target partition weights
    real_t *ubvec,  // ??
    idx_t *options, // options vector with pointers to relevant things
    idx_t *objval,  // Objective value will be written here
    idx_t *part     // where partitions should be written to, size equal to number of vertices
)
{

    int status = METIS_PartGraphRecursive(
        &nvtxs,
        &ncon,
        xadj,
        adjncy,
        vwgt,
        vsize,
        adjwgt,
        &nparts,
        tpwgts,
        ubvec,
        options,
        objval,
        part);

    return status;
}

EMSCRIPTEN_KEEPALIVE
uint8_t *create_buffer(int byte_size)
{
    return malloc(byte_size);
}

EMSCRIPTEN_KEEPALIVE
void destroy_buffer(uint8_t *p)
{
    free(p);
}