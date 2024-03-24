
adjacency_list = [
    [6, 1, 11, 8, 10],
    [0, 6, 4, 2, 12, 32],
    [1, 4, 3, 32],
    [2, 32, 5, 29, 4, 28, 33],
    [2, 3, 1, 5, 6],
    [4, 6, 3, 29, 31, 7],
    [4, 5, 1, 7, 8, 0, 31],
    [6, 5, 31, 8, 32],
    [7, 6, 0, 9, 32, 31, 10],
    [8, 32, 10, 18],
    [9, 8, 0, 11, 18, 16],
    [0, 10, 12, 16, 13],
    [11, 1, 13, 32],
    [12, 11, 32, 16, 14, 15],
    [13, 32, 15, 21, 27, 22],
    [14, 13, 21, 16, 17],
    [15, 13, 11, 17, 18, 10],
    [16, 15, 21, 18, 20, 19],
    [17, 16, 10, 9, 19, 32],
    [17, 18, 32, 20, 31],
    [17, 19, 21, 30, 31],
    [17, 20, 15, 14, 30, 22, 23],
    [14, 21, 27, 23, 26],
    [22, 21, 27, 24, 30, 34, 33],
    [23, 27, 26, 33, 25],
    [24, 33, 30, 29, 26, 28, 27],
    [25, 24, 22, 27],
    [26, 22, 24, 23, 14, 28, 32, 25, 33],
    [27, 25, 33, 3, 29],
    [28, 3, 5, 25, 30, 31],
    [29, 20, 31, 21, 25, 23, 33, 34],
    [29, 30, 20, 5, 7, 19, 6, 32, 8],
    [31, 19, 18, 7, 8, 9, 12, 14, 13, 1, 2, 3, 27, 33],
    [32, 3, 27, 28, 30, 25, 24, 36, 34, 37, 23],
    [23, 33, 30, 35],
    [34, 36],
    [35, 37, 38, 33],
    [33, 36, 38],
    [37, 36]
]


def _prepare_graph(adjacency, xadj, adjncy):
    if adjacency is not None:
        assert xadj is None
        assert adjncy is None

        xadj = [0]
        adjncy = []

        for i in range(len(adjacency)):
            adj = adjacency[i]
            if adj is not None and len(adj):
                assert max(adj) < len(adjacency)
            adjncy += list(map(int, adj))
            xadj.append(len(adjncy))
    else:
        assert xadj is not None
        assert adjncy is not None

    return xadj, adjncy

xadj, adjncy = _prepare_graph(adjacency_list, None, None)
print(xadj)
print(adjncy)