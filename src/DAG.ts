interface Node {
    id: string;
    tag: string;
    data: any;
}

export class DAG {
    private nodes: { [key: string]: Node };
    private parentToChild: { [key: string]: string[] };
    private childToParent: { [key: string]: string[] };
    private tagToNode: { [key: string]: string[] };

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

    private addNode(node: Node) {
        if (!this.nodes[node.id]) this.nodes[node.id] = node;
    }

    public add(parent: Node, child: Node) {
        this.addNode(parent);
        this.addNode(child);

        this.addRelationship(this.parentToChild, parent.id, parent.id, child.id);
        this.addRelationship(this.childToParent, child.id, child.id, parent.id);

        this.addRelationship(this.tagToNode, parent.tag, parent.id, parent.id);
        this.addRelationship(this.tagToNode, child.tag, child.id, child.id);
    }

    public toDot() {
        let dotviz = `digraph G {\n`;
        for (let child in this.childToParent) {
            for (let parentNode of this.childToParent[child]) {
                dotviz += `\t"${parentNode}\n${this.nodes[parentNode].tag}" -> "${child}\n${this.nodes[child].tag}"\n`
            }
        }
        dotviz += "}";
        return dotviz;
    }
}