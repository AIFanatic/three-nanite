#include <stdio.h>
#include <vector>

#include "../src/meshoptimizer.h"

int main() {

    std::vector<float> vertices = {
        165, 224, 0, // 0
        220, 190, 0, // 1
        240, 270, 0, // 2
        293, 260, 0, // 3
        279, 318, 0, // 4
        347, 287, 0, // 5
        346, 344, 0, // 6
        280, 407, 0, // 7
        213, 355, 0, // 8
        203, 427, 0, // 9
        277, 473, 0, // 10
        145, 404, 0, // 11
        165, 295, 0, // 12
        105, 324, 0, // 13
    };

    std::vector<unsigned int> indices = {
        0, 1, 2,
        1, 3, 2,
        2, 3, 4,
        4, 3, 5,
        4, 5, 6,
        4, 6, 7,
        4, 7, 8,
        4, 8, 2,
        2, 8, 12, 
        2, 12, 0,
        0, 12, 13,
        12, 11, 13,
        12, 8, 11,
        8, 9, 11,
        8, 7, 9,
        9, 7, 10
    };

    size_t vertex_count = vertices.size() / 3;
    size_t index_count = indices.size();


    float threshold = 0.5f;
    size_t target_index_count = size_t(index_count * threshold);
    float target_error = 1e-2f;
    unsigned int options = 0; // meshopt_SimplifyX flags, 0 is a safe default

    std::vector<unsigned int> simplified(index_count);
    float simplified_error = 0.f;
    size_t ret = meshopt_simplify(
        &simplified[0],
        indices.data(),
        index_count,
        vertices.data(),
        vertex_count,
        sizeof(float) * 3,
        target_index_count,
        target_error,
        options,
        &simplified_error
    );

    printf("target_index_count: %zu, simplified_size: %zu, ret: %zu, simplified_error: %f\n", target_index_count, simplified.size(), ret, simplified_error);
    simplified.resize(ret);

    for (size_t i = 0; i < simplified.size(); i+=3)
    {
        printf("%u, %u, %u\n", simplified[i + 0], simplified[i + 1], simplified[i + 2]);
    }
    

    return 0;
}