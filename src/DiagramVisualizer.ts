interface Node {
    id: string;
    lod: string;
    data: any;
}

export class DAG {
    public nodes: { [key: string]: Node };
    public parentToChild: { [key: string]: string[] };
    public childToParent: { [key: string]: string[] };
    public lodToNode: { [key: string]: string[] };

    constructor() {
        this.nodes = {};
        this.parentToChild = {};
        this.childToParent = {};
        this.lodToNode = {};
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

        this.addRelationship(this.lodToNode, parent.lod, parent.id, parent.id);
        this.addRelationship(this.lodToNode, child.lod, child.id, child.id);
    }

    public toDot() {
        let dotviz = `digraph G {\n`;
        for (let child in this.childToParent) {
            for (let parentNode of this.childToParent[child]) {
                dotviz += `\t"${parentNode}\n${this.nodes[parentNode].lod}" -> "${child}\n${this.nodes[child].lod}"\n`
            }
        }
        dotviz += "}";
        return dotviz;
    }
}


interface Point {
    x: number;
    y: number;
}

export class DiagramVisualizer {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;

    private dag: DAG;

    private nodeStatus: {[key: string]: boolean};

    constructor(width: number, height: number) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = width * window.devicePixelRatio // Hack for HDPI
        this.canvas.height = height * window.devicePixelRatio; // Hack for HDPI
        this.canvas.style.position = "absolute";
        this.canvas.style.top = "5px";
        this.canvas.style.left = "5px";
        this.canvas.style.backgroundColor = "#222222";
        this.canvas.style.border = "1px solid #ffffff";
        this.canvas.style.borderRadius = "5px";
        this.canvas.style.zoom = (1/window.devicePixelRatio).toString(); // Hack for HDPI
        this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        document.body.appendChild(this.canvas);

        this.nodeStatus = {}
        this.dag = new DAG();
    }

    public add(parent: Node, child: Node) {
        this.dag.add(parent, child);
        this.nodeStatus[parent.id] = false;
        this.nodeStatus[child.id] = false;
    }

    public setNodeStatus(nodeId: string, enabled: boolean) {
        if (this.nodeStatus[nodeId] === undefined) {
            console.warn("Could not find node, need to add it first");
            return;
        }
        this.nodeStatus[nodeId] = enabled;
    }

    private drawLine(from: Point, to: Point, color: string) {
        this.context.strokeStyle = color;
        this.context.beginPath();
        this.context.moveTo(from.x, from.y);
        this.context.lineTo(to.x, to.y);
        this.context.closePath();
        this.context.stroke();
    }

    private drawCircle(position: Point, radius: number, color: string) {
        this.context.fillStyle = color;
        this.context.beginPath();
        this.context.arc(position.x, position.y, radius, 0, 180 / Math.PI);
        this.context.closePath();
        this.context.fill();
    }

    public render() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        function sortByLOD(dag: DAG) {
            let lodNodesArray: string[][] = [];
            for (let l in dag.lodToNode) lodNodesArray[l] = dag.lodToNode[l];
            return lodNodesArray.sort();
        }

        const sortedLods = sortByLOD(this.dag);
        const sortedLODKeys = Object.keys(sortedLods).reverse();

        const nodePositions: Map<string, {x: number, y: number}> = new Map();
        
        const yStep = this.canvas.height / sortedLODKeys.length;
        let y = yStep * 0.5;
        for (let l = 0; l < sortedLODKeys.length; l++) {
            const lod = sortedLODKeys[l];
            const nodes = this.dag.lodToNode[lod];

            // Draw lods
            this.drawLine({x: 0, y: y + yStep * 0.5}, {x: this.canvas.width, y: y + yStep * 0.5}, "#ffffff20");

            let x = this.canvas.width * 0.5 / nodes.length;
            for (let i = 0; i < nodes.length; i++) {
                const pos = {x: x, y: y};
                x += this.canvas.width / nodes.length;

                nodePositions.set(nodes[i], pos);
            }
            y += yStep;

        }

        // Make connections
        for (let p in this.dag.parentToChild) {
            const ppos = nodePositions.get(p);
            for (let c of this.dag.parentToChild[p]) {
                const cpos = nodePositions.get(c);
                this.drawLine(ppos, cpos, "gray")
            }
        }

        for (let [id, position] of nodePositions) {
            const color = this.nodeStatus[id] ? "green" : "white";
            this.drawCircle(position, 3, color);
        }
    }

}