// Simple wrapper for Sven Forstmann's mesh simplification tool
//
// Loads a OBJ format mesh, decimates mesh, saves decimated mesh as OBJ format
// http://voxels.blogspot.com/2014/05/quadric-mesh-simplification-with-source.html
// https://github.com/sp4cerat/Fast-Quadric-Mesh-Simplification
//To compile for Linux/OSX (GCC/LLVM)
//  g++ Main.cpp -O3 -o simplify
//To compile for Windows (Visual Studio)
// vcvarsall amd64
// cl /EHsc Main.cpp /osimplify
//To execute
//  ./simplify wall.obj out.obj 0.04
//
// Pascal Version by Chris Roden:
// https://github.com/neurolabusc/Fast-Quadric-Mesh-Simplification-Pascal-
//

#include "Simplify.h"
#include <stdio.h>

extern "C" {
bool is_extension(const char* file_path, const char* extension) {
    char file_extension[3];

    file_extension[0] = file_path[strlen(file_path)-3];
    file_extension[1] = file_path[strlen(file_path)-2];
    file_extension[2] = file_path[strlen(file_path)-1];

    return (file_extension[0] == extension[0]
            and file_extension[1] == extension[1]
            and file_extension[2] == extension[2]);
}

bool is_obj(const char* file_path) {
    return is_extension(file_path, "obj");
}

int simplify_obj(const char* file_path, const char* export_path, float reduceFraction, float agressiveness) {
    if (is_obj(file_path)) {
        Simplify::load_obj(file_path);
    }
    else {
        printf("file is not obj or stl %s\n", file_path);
        return EXIT_FAILURE;
    }

    if ((Simplify::triangles.size() < 3) || (Simplify::vertices.size() < 3)) {
        printf("triangles size or vertices size less than 3\n");
        return EXIT_FAILURE;
    }

    int target_count =  Simplify::triangles.size() >> 1;

    if (reduceFraction > 1.0) reduceFraction = 1.0; //lossless only
    if (reduceFraction <= 0.0) {
        printf("Ratio must be BETWEEN zero and one.\n");
        return EXIT_FAILURE;
    }
    target_count = round((float)Simplify::triangles.size() * reduceFraction);

    if (target_count < 4) {
        printf("Object will not survive such extreme decimation\n");
        return EXIT_FAILURE;
    }
    int startSize = Simplify::triangles.size();

    int update_rate = 5;
    // double agressiveness = 7;
    bool verbose = false;
    int max_iterations = 100;
    double alpha = 0.000000001;
    int K = 3;
    bool lossless = false;
    double threshold_lossless = 0.0001;
    bool preserve_border = true;
    
    Simplify::simplify_mesh(target_count, update_rate, agressiveness,
					   verbose, max_iterations, alpha,
					   K, lossless, threshold_lossless,
					   preserve_border);
    //Simplify::simplify_mesh_lossless( false);
    if ( Simplify::triangles.size() >= startSize) {
        printf("Unable to reduce mesh.\n");
        return EXIT_FAILURE;
    }

    if (is_obj(export_path)) {
        Simplify::write_obj(export_path);
    }
    else {
        printf("export file is not obj or stl %s\n", export_path);
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}

int simplify(float *vertices, int vertex_count, int *faces, int face_count, float reduceFraction, float agressiveness, float *vertices_output, unsigned int *faces_output) {

    Simplify::vertices.clear();
    // std::vector<std::vector<double> > _vertices;

    for (size_t i = 0; i < vertex_count; i+=3)
    {
        // std::vector<double> vertex;
        // vertex.push_back(vertices[i + 0]);
        // vertex.push_back(vertices[i + 1]);
        // vertex.push_back(vertices[i + 2]);
        // _vertices.push_back(vertex);


        Simplify::Vertex v;
        v.p.x = vertices[i + 0];
        v.p.y = vertices[i + 1];
        v.p.z = vertices[i + 2];
        Simplify::vertices.push_back(v);
        // printf("raw v[%i]: x: %f, y: %f, z: %f\n", i, vertex[0], vertex[1], vertex[2]);
        // printf("v %f %f %f\n", vertex[0], vertex[1], vertex[2]);
    }

    Simplify::triangles.clear();
    // std::vector<std::vector<int> > _faces;

    for (size_t i = 0; i < face_count; i+=3)
    {
        // std::vector<int> face;
        // face.push_back(faces[i + 0]);
        // face.push_back(faces[i + 1]);
        // face.push_back(faces[i + 2]);
        // _faces.push_back(face);


        Simplify::Triangle t;
        t.attr = 0;
        t.material = -1;
        t.v[0] = faces[i + 0];
        t.v[1] = faces[i + 1];
        t.v[2] = faces[i + 2];

        Simplify::triangles.push_back(t);

        // printf("f %i %i %i\n", face[0], face[1], face[2]);
    }
    

    // Simplify::setMeshFromExt(_vertices, _faces);

    if ((Simplify::triangles.size() < 3) || (Simplify::vertices.size() < 3)) {
        printf("triangles size or vertices size less than 3\n");
        return EXIT_FAILURE;
    }

    int target_count =  Simplify::triangles.size() >> 1;

    if (reduceFraction > 1.0) reduceFraction = 1.0; //lossless only
    if (reduceFraction <= 0.0) {
        printf("Ratio must be BETWEEN zero and one.\n");
        return EXIT_FAILURE;
    }
    target_count = round((float)Simplify::triangles.size() * reduceFraction);

    if (target_count < 4) {
        printf("Object will not survive such extreme decimation\n");
        return EXIT_FAILURE;
    }
    int startSize = Simplify::triangles.size();

    int update_rate = 5;
    // double agressiveness = 7;
    bool verbose = false;
    int max_iterations = 100;
    double alpha = 0.000000001;
    int K = 3;
    bool lossless = false;
    double threshold_lossless = 0.0001;
    bool preserve_border = true;
    
    Simplify::simplify_mesh(target_count, update_rate, agressiveness,
					   verbose, max_iterations, alpha,
					   K, lossless, threshold_lossless,
					   preserve_border);
    //Simplify::simplify_mesh_lossless( false);
    if ( Simplify::triangles.size() >= startSize) {
        printf("Unable to reduce mesh.\n");
        return EXIT_FAILURE;
    }


    for (size_t i = 0, j = 0; i < Simplify::vertices.size(); i++, j+=3) {
        vertices_output[j + 0] = Simplify::vertices[i].p.x;
        vertices_output[j + 1] = Simplify::vertices[i].p.y;
        vertices_output[j + 2] = Simplify::vertices[i].p.z;
        // printf("v %g %g %g\n", Simplify::vertices[i].p.x, Simplify::vertices[i].p.y, Simplify::vertices[i].p.z);
    }
    
    for (size_t i = 0, j = 0; i < Simplify::triangles.size(); i++, j+=3) {
        if (Simplify::triangles[i].deleted) continue;

        faces_output[j + 0] = Simplify::triangles[i].v[0];
        faces_output[j + 1] = Simplify::triangles[i].v[1];
        faces_output[j + 2] = Simplify::triangles[i].v[2];
        // printf("f %d %d %d\n", Simplify::triangles[i].v[0], Simplify::triangles[i].v[1], Simplify::triangles[i].v[2]);
    }



    return EXIT_SUCCESS;


    // // if (is_obj(export_path)) {
    // //     Simplify::write_obj(export_path);
    // // }
    // // else {
    // //     printf("export file is not obj or stl %s\n", export_path);
    // //     return EXIT_FAILURE;
    // // }

    // return EXIT_SUCCESS;
}

size_t get_simplified_vertex_count() {
    return Simplify::vertices.size();
}

size_t get_simplified_triangle_count() {
    return Simplify::triangles.size();
}
}

// #ifdef __EMSCRIPTEN__

// extern "C" {
// int simplify(const char* file_path, float reduceFraction, const char* export_path) {
//     return simplify(file_path, export_path, reduceFraction, 7.0);// aggressive
// }
// }

// #else

// int main(int argc, const char * argv[]) {
//     if (argc < 3) {
//         printf("Need to provide at least 2 args")
//         return EXIT_SUCCESS;
//     }

//     const char* file_path = argv[1];
//     const char* export_path = argv[2];
//     float reduceFraction = 0.5;
//     if (argc > 3) {
//         reduceFraction = atof(argv[3]);
//     }

//     float agressiveness = 7.0;
//     if (argc > 4) {
//         agressiveness = atof(argv[4]);
//     }
//     return simplify(file_path, export_path, reduceFraction, agressiveness);
// }

// #endif