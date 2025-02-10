const log = console.log;
import { ref } from 'vue';

export default defineNuxtPlugin(() => {
    return {
        provide: {
            classes: {
                Canvas,
                Action
            },
            data: {
                TOOLS,
                CELL_WIDTH,
                HOTKEYS
            }
        }
    }
});

const CELL_WIDTH = 20;
const TOOLS = Object.freeze({MOVE: -1,PENCIL: 0, ERASER: 1, PICKER: 2});
const LOCK_STATE = Object.freeze({NONE: 0, VERTICAL: 1, HORIZONTAL: 2});
const HOTKEYS = {
    MOVE: {ctrlKey: true, key: 'm', action: (canvas) => {canvas.tool.value = TOOLS.MOVE;}},
    PENCIL: {ctrlKey: true, key: 'p', action: (canvas) => {canvas.tool.value = TOOLS.PENCIL;}},
    ERASER: {ctrlKey: true, key: 'e', action: (canvas) => {canvas.tool.value = TOOLS.ERASER;}},
    PICKER: {ctrlKey: true, key: 'i', action: (canvas) => {canvas.tool.value = TOOLS.PICKER;}},
    SAVE: {ctrlKey: true, key: 's', action: (canvas) => {canvas.save();}},
    OPEN: {ctrlKey: true, key: 'o', action: (canvas) => {canvas.open();}},
    TOGGLE_GRID: {ctrlKey: true, key: 'g', action: (canvas) => {canvas.showGrid.value = !canvas.showGrid.value;}},
};

class Canvas{
    constructor(){
        this.transform = {x:0,y:0,scale:1,scaleRatio:1,w:0,h:0};
        this.mouse = {down:false, x: 0, y: 0, prev: { x: 0, y: 0 }, lock: ref(LOCK_STATE.NONE)};
        this.tool = ref(TOOLS.PENCIL);
        this.toolSize = ref(1);
        this.bg = ref('ffffff');
        this.gridColor = ref('cccccc')
        this.selectedColor = ref('000000');
        this.selectedRgb = {r: 0, g: 0, b: 0};
        this.dirtyCells = new Set();
        this.showGrid = ref(true);
        this.projectName = ref('untitled');
    }

    initClass(element, gridCanvas, mouseCanvas, window, toast){
        this.window = window;
        this.toast = toast;
        this.layers = {
            main: { el: element, ctx: element.value.getContext('2d'), needsRender: true },
            grid: { el: gridCanvas, ctx: gridCanvas.value.getContext('2d'), needsRender: true },
            mouse: { el: mouseCanvas, ctx: mouseCanvas.value.getContext('2d'), needsRender: true }
        };

        this.init();
    }

    init(){
        // setup layers
        for(const key of Object.keys(this.layers)){
            this.layers[key].el.value.width = this.window.innerWidth;
            this.layers[key].el.value.height = this.window.innerHeight;
            this.layers[key].ctx.imageSmoothingEnabled = false;
            this.layers[key].ctx.webkitImageSmoothingEnabled = false;
            this.layers[key].ctx.mozImageSmoothingEnabled = false;
        }

        // mouse down listener
        this.layers.main.el.value.addEventListener("mousedown", (e) => {
            if(this.mouse.lock !== LOCK_STATE.NONE){
                this.mouse.down = true;
                return;
            }

            switch(this.tool.value){
                case TOOLS.PENCIL:
                case TOOLS.ERASER:
                    // round to the nearest cell
                    const cellX = Math.floor(e.offsetX / CELL_WIDTH * this.transform.scaleRatio);
                    const cellY = Math.floor(e.offsetY / CELL_WIDTH * this.transform.scaleRatio);
                    // choose color based on tool (eraser, or pencil)
                    const newColor = this.tool.value === TOOLS.PENCIL ? `#${this.selectedColor.value}` : `#${this.bg.value}`;
                    this.paint(newColor, cellX, cellY, this.toolSize.value);
                    this.mouse.down = true;
                    this.render();
                    break;
                case TOOLS.PICKER:
                    // round to the nearest cell
                    const pickedX = Math.floor(e.offsetX / CELL_WIDTH * this.transform.scaleRatio);
                    const pickedY = Math.floor(e.offsetY / CELL_WIDTH * this.transform.scaleRatio);
                    // get color at given position
                    this.selectedColor.value = this.grid[pickedX][pickedY].color.replace('#', '');
                    this.selectedRgb = this.hexToRgb(this.selectedColor.value);
                    break;
                case TOOLS.MOVE:
                    this.mouse.down = true;
                    break;
            }
        });

        this.layers.main.el.value.addEventListener("mouseup", (e) => {
            this.mouse.down = false;
            this.render();
        });

        this.layers.main.el.value.addEventListener("mousemove", (e)=>{
            const currentX = Math.floor(e.offsetX / CELL_WIDTH * this.transform.scaleRatio);
            const currentY = Math.floor(e.offsetY / CELL_WIDTH * this.transform.scaleRatio);

            // Lock x axis if Alt is held
            if (e.altKey && this.mouse.lock.value === LOCK_STATE.NONE) this.mouse.lock.value = LOCK_STATE.VERTICAL;
            // lock y axis if Shift is held
            if (e.shiftKey && this.mouse.lock.value === LOCK_STATE.NONE) this.mouse.lock.value = LOCK_STATE.HORIZONTAL;

            if(!e.shiftKey && !e.altKey) this.mouse.lock.value = LOCK_STATE.NONE;

            // Update previous mouse position *after* calculations
            this.mouse.prev.x = this.mouse.x;
            this.mouse.prev.y = this.mouse.y;

            // Set new mouse position
            if (this.mouse.lock.value !== LOCK_STATE.VERTICAL) this.mouse.x = currentX;
            if (this.mouse.lock.value !== LOCK_STATE.HORIZONTAL) this.mouse.y = currentY;

            if(this.mouse.down){
                // choose color based on tool (eraser, or pencil)
                const newColor = this.tool.value === TOOLS.PENCIL ? `#${this.selectedColor.value}` : `#${this.bg.value}`;
                this.paint(newColor, this.mouse.x, this.mouse.y, this.toolSize.value);
                this.render();
            }
        });

        this.layers.main.el.value.addEventListener("mouseleave", (e)=>{
            // move mouse pos out of bounds (to hide renderer cursor)
            this.mouse.x = -100;
            this.mouse.y = -100;
        });

        this.window.onkeydown = (e) => {
            for(const key of Object.keys(HOTKEYS)){
                if(HOTKEYS[key].ctrlKey === e.ctrlKey && HOTKEYS[key].key === e.key){
                    e.preventDefault();
                    HOTKEYS[key].action(this);
                }
            }

            // Lock x axis if Alt is held
            if (e.altKey && this.mouse.lock.value === LOCK_STATE.NONE) this.mouse.lock.value = LOCK_STATE.VERTICAL;
            // lock y axis if Shift is held
            if (e.shiftKey && this.mouse.lock.value === LOCK_STATE.NONE) this.mouse.lock.value = LOCK_STATE.HORIZONTAL;
        };
    
        this.window.onmouseup = (e) => {
            this.mouse.down = false;
        }
    
        this.window.onresize = () => {
            // calc ratio of width of window vs canvas
            this.transform.scaleRatio = this.el.value.width / this.el.value.getBoundingClientRect().width;
            // rerender every cell
            this.markAllDirty();
        }

        // init grid and render
        this.initGrid(50,50);
        this.render();
        this.renderMouse();
    }

    initGrid(width, height){
        this.transform.w = width;
        this.transform.h = height;

        // calc canvas size
        const canvasWidth = width * CELL_WIDTH;
        const canvasHeight = height * CELL_WIDTH;
        // setup each layer
        for(const key of Object.keys(this.layers)){
            this.layers[key].el.value.width = canvasWidth;
            this.layers[key].el.value.height = canvasHeight;
        }

        // calc ratio of width of window vs canvas
        this.transform.scaleRatio = this.layers.main.el.value.width / this.layers.main.el.value.getBoundingClientRect().width;

        // init grid
        this.grid = [];
        for(let x = 0; x < width; x++){
            this.grid[x] = [];
            for(let y = 0; y < height; y++){
                this.grid[x][y] = {
                    x: x * CELL_WIDTH,
                    y: y * CELL_WIDTH,
                    color: `#${this.bg.value}`,
                    dirty: true
                }
                this.markCellDirty(x,y);
            }
        }
    }

    render(){
        // MAIN PASS
        for (const key of this.dirtyCells) {
            const [x, y] = key.split(',').map(Number); // decode the key into coordinates
            const cell = this.grid[x][y];
            this.layers.main.ctx.fillStyle = cell.color;
            this.layers.main.ctx.beginPath();
            this.layers.main.ctx.rect(cell.x, cell.y, CELL_WIDTH, CELL_WIDTH);
            this.layers.main.ctx.fill();

            // mark the cell as clean
            cell.dirty = false;
        }
        this.dirtyCells.clear(); // clear the set of dirty cells after rendering

        // GRID PASS
        if(this.layers.grid.needsRender){
            if(this.showGrid.value){
                this.layers.grid.ctx.clearRect(0, 0, this.layers.grid.el.value.width, this.layers.grid.el.value.height);
                this.layers.grid.ctx.strokeStyle = `#${this.gridColor.value}`;
                this.layers.grid.ctx.lineWidth = 1;
                for(let x = 0; x < this.grid.length; x++){
                    for(let y = 0; y < this.grid[x].length; y++){
                        this.layers.grid.ctx.beginPath();
                        this.layers.grid.ctx.rect(this.grid[x][y].x, this.grid[x][y].y, CELL_WIDTH, CELL_WIDTH);
                        this.layers.grid.ctx.stroke();
                    }
                }
            } else this.layers.grid.ctx.clearRect(0, 0, this.layers.grid.el.value.width, this.layers.grid.el.value.height);

            this.layers.grid.needsRender = false;
        }

        // check if undo and redo history need to be cleared (max length of 100 and the newest 100 actions should stay)
        // if (undoHistory.value.length > 100) undoHistory.value.splice(0, undoHistory.value.length - 100);
        // if (redoHistory.value.length > 100) redoHistory.value.splice(0, redoHistory.value.length - 100);
    }


    renderMouse(){
        requestAnimationFrame(() => this.renderMouse());
        this.layers.mouse.ctx.clearRect(0, 0, this.layers.mouse.el.value.width, this.layers.mouse.el.value.height);
        if(this.tool.value === TOOLS.ERASER) this.layers.mouse.ctx.fillStyle = `rgba(255, 0, 0, .5)`;
        else this.layers.mouse.ctx.fillStyle = `rgba(${this.selectedRgb.r}, ${this.selectedRgb.g}, ${this.selectedRgb.b}, .5)`;
        this.layers.mouse.ctx.beginPath();
        // the rect should be the size of the brush (but in a circle like when painting)
        if(this.toolSize.value === 1) this.layers.mouse.ctx.rect(this.mouse.x * CELL_WIDTH, this.mouse.y * CELL_WIDTH, CELL_WIDTH, CELL_WIDTH);
        else this.layers.mouse.ctx.ellipse((this.mouse.x * CELL_WIDTH) + (CELL_WIDTH / 2), (this.mouse.y * CELL_WIDTH) + (CELL_WIDTH / 2), (this.toolSize.value - .5) * CELL_WIDTH, (this.toolSize.value - .5) * CELL_WIDTH, 0, 0, Math.PI*2);
        this.layers.mouse.ctx.fill();

        // if mouse is locked draw a vertical or horizontal line at the locked axis
        if(this.mouse.lock.value !== LOCK_STATE.NONE){
            // aqua
            this.layers.mouse.ctx.strokeStyle = `aqua`;
            this.layers.mouse.ctx.beginPath();
            if(this.mouse.lock.value === LOCK_STATE.VERTICAL) this.layers.mouse.ctx.moveTo((this.mouse.x * CELL_WIDTH) + (CELL_WIDTH / 2), 0);
            else this.layers.mouse.ctx.moveTo(0, (this.mouse.y * CELL_WIDTH) + (CELL_WIDTH / 2));
            if(this.mouse.lock.value === LOCK_STATE.VERTICAL) this.layers.mouse.ctx.lineTo((this.mouse.x * CELL_WIDTH) + (CELL_WIDTH / 2), this.layers.mouse.el.value.height);
            else this.layers.mouse.ctx.lineTo(this.layers.mouse.el.value.width, (this.mouse.y * CELL_WIDTH) + (CELL_WIDTH / 2));
            this.layers.mouse.ctx.lineWidth = 2;
            this.layers.mouse.ctx.stroke();
        }
    }

    markCellDirty(x, y){
        this.grid[x][y].dirty = true;
        this.dirtyCells.add(`${x},${y}`); // Add the cell to the dirty set using a unique key
    }

    
    markAllDirty(){
        for(let x = 0; x < this.grid.length; x++){
            for(let y = 0; y < this.grid[x].length; y++){
                this.markCellDirty(x,y);
            }
        }
        this.render();
    }

    paint(color, x, y, radius){
        const centerX = x;
        const centerY = y;
    
        if(radius === 1){
            const cellX = centerX;
            const cellY = centerY;
    
            // Ensure cell is within grid bounds
            if (cellX >= 0 && cellX < this.grid.length && cellY >= 0 && cellY < this.grid[cellX].length) {
                const prevColor = this.grid[cellX][cellY].color;
                const newColor = color;
    
                if (prevColor !== newColor) {
                    // Save to undo history
                    //undoHistory.value.push({ x: cellX, y: cellY, color: newColor, prevColor });
    
                    // Update cell color
                    this.grid[cellX][cellY].color = newColor;
    
                    // Mark cell as dirty
                    this.markCellDirty(cellX, cellY);
                }
            }
            return;
        }
    
        const actualRadius = radius-1;
        for (let iX = -actualRadius; iX <= actualRadius; iX++) {
            for (let iY = -actualRadius; iY <= actualRadius; iY++) {
                const dist = Math.sqrt(iX ** 2 + iY ** 2); // Calculate distance from the center
                if (dist <= actualRadius) {
                    const cellX = centerX + iX;
                    const cellY = centerY + iY;
    
                    // Ensure cell is within grid bounds
                    if (cellX >= 0 && cellX < this.grid.length && cellY >= 0 && cellY < this.grid[cellX].length) {
                        const prevColor = this.grid[cellX][cellY].color;
                        const newColor = color;
    
                        if (prevColor !== newColor) {
                            // Save to undo history
                            //undoHistory.value.push({ x: cellX, y: cellY, color: newColor, prevColor });
    
                            // Update cell color
                            this.grid[cellX][cellY].color = newColor;
    
                            // Mark cell as dirty
                            this.markCellDirty(cellX, cellY);
                        }
                    }
                }
            }
        }
    }

    export(){
        // download image of canvas
        const link = document.createElement('a');
        link.download = 'canvas.png';
        link.href = this.el.value.toDataURL('image/png');
        link.click();
    }

    open(){
        const input = document.createElement('input');
        input.type = 'file';
        // only accept files with .pxl extension
        input.accept = '.pxl';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const json = reader.result;
                const obj = JSON.parse(json);
                this.initGrid(obj.grid.width, obj.grid.height);
                this.projectName.value = obj.name;
                this.selectedRgb = obj.selectedRgb;
                this.selectedColor.value = obj.selectedColor;
                this.bg.value = obj.bg;
                this.grid = JSON.parse(obj.grid.cells);
                this.gridColor.value = obj.grid.color;
                this.showGrid.value = obj.showGrid;
                this.layers.grid.needsRender = true;
                this.tool.value = obj.tool;
                this.toolSize.value = parseInt(obj.toolSize);
                this.undoHistory = JSON.parse(obj.undoHistory);
                this.redoHistory = JSON.parse(obj.redoHistory);
                this.markAllDirty();
                this.render();
                this.toast.add({ severity: 'success', summary: 'Project opened successfully', detail: `Project "${this.projectName.value}" has successfully been opened.`, life: 3000 });
            };
            reader.readAsText(file);
        };
        input.click();
    }

    save(){
        const obj = {
            name: this.projectName.value, 
            selectedColor: this.selectedColor.value,
            selectedRgb: this.selectedRgb,
            bg: this.bg.value,
            grid: {width: this.transform.w, height: this.transform.h, cells: JSON.stringify(this.grid), color: this.gridColor.value}, 
            showGrid: this.showGrid.value, 
            tool: this.tool.value, 
            toolSize: this.toolSize.value, 
            undoHistory: JSON.stringify(this.undoHistory || []), 
            redoHistory: JSON.stringify(this.redoHistory || [])
        };
        const json = JSON.stringify(obj);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.projectName.value}.pxl`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.add({ severity: 'success', summary: 'Project saved successfully', detail: `Project "${this.projectName.value}" has successfully been saved.`, life: 3000 });
    }

    hexToRgb(hex){
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}

class Action{
    constructor(x,y,color,prevColor){
        this.x = x;
        this.y = y;
        this.color = color;
        this.prevColor = prevColor;
    }
}