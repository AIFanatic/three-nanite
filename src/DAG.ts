interface Node<T> {
    id: string;
    tag: string;
    data: T;
}

export class DAG<T> {
    public nodes: { [key: string]: Node<T> };
    public parentToChild: { [key: string]: string[] };
    public childToParent: { [key: string]: string[] };
    public tagToNode: { [key: string]: string[] };
    
    constructor() {
        this.nodes = {};
        this.parentToChild = {};
        this.childToParent = {};
        this.tagToNode = {};
    }
    
    private addRelationship(map: { [key: string]: string[] }, queryKey: string, from: string, to: string) {
        let mapArray = map[queryKey] ? map[queryKey] : [];
        if (mapArray.indexOf(to) === -1) mapArray.push(to);
        map[queryKey] = mapArray;
    }

    private addNode(node: Node<T>) {
        if (!this.nodes[node.id]) this.nodes[node.id] = node;
    }

    public add(parent: Node<T>, child: Node<T>) {
        this.addNode(parent);
        this.addNode(child);

        this.addRelationship(this.parentToChild, parent.id, parent.id, child.id);
        this.addRelationship(this.childToParent, child.id, child.id, parent.id);

        this.addRelationship(this.tagToNode, parent.tag, parent.id, parent.id);
        this.addRelationship(this.tagToNode, child.tag, child.id, child.id);
    }

    public toDot() {
        let dotviz = `digraph G {\n splines=true; overlap=false \n graph [pad="0.5", nodesep="1", ranksep="2"];`;
        for (let child in this.childToParent) {
            for (let parentNode of this.childToParent[child]) {
                dotviz += `\t"${parentNode}\n${this.nodes[parentNode].tag}" -> "${child}\n${this.nodes[child].tag}"\n`
                // dotviz += `\t"${parentNode}\n${this.nodes[parentNode].tag}\n${this.nodes[parentNode].data.result_error.toFixed(5)}" -> "${child}\n${this.nodes[child].tag}\n${this.nodes[child].data.result_error.toFixed(5)}"\n`
            }
        }
        dotviz += "}";
        return dotviz;
    }
}