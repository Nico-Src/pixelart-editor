<script setup>
import draggable from 'vuedraggable';
import moment from 'moment';
const route = useRoute();
const router = useRouter();
const snackbar = useSnackbar();
const app = useNuxtApp();
const TOOLS = app.$data.TOOLS;
const HOTKEYS = app.$data.HOTKEYS;
import { useToast } from "primevue/usetoast";
const toast = useToast();
import Terminal from 'primevue/terminal';
import TerminalService from 'primevue/terminalservice'

const isMounted = ref(false);
const canvasEl = ref(null);
const gridCanvas = ref(null);
const mouseCanvas = ref(null);
const canvas = new app.$classes.Canvas();

const undoHistory = ref([]);
const redoHistory = ref([]);

const showCreateNew = ref(true);
const showTerminal = ref(false);

const menuItems = ref([
    {label: 'File', items: [
        {label: 'Open', icon: 'pi pi-fw pi-file', command: () => {canvas.open();}},
        {label: 'New', icon: 'pi pi-fw pi-file', command: () => {showCreateNew.value = true;}},
        {label: 'Export Image', icon: 'pi pi-fw pi-file-export', command: () => {canvas.export();}},
        {label: 'Save', icon: 'pi pi-fw pi-save', command: () => {canvas.save();}},
    ]},{
        label: 'View', items: [
            {label: computed(() => showTerminal.value ? 'Hide Terminal' : 'Show Terminal'), icon: 'pi pi-desktop', command: () => {showTerminal.value = !showTerminal.value;}},
        ]
    }
]);

const newCanvasWidth = ref(50);
const newCanvasHeight = ref(50);

useSeoMeta({
    // wrap title in computed function so title gets updated correctly
    title: () => `Pixelart-Editor`,
});

const undo = () => {
    if(undoHistory.value.length > 0){
        const action = undoHistory.value.pop();
        redoHistory.value.push({x: action.x, y: action.y, color: action.prevColor, prevColor: action.color});
        grid[action.x][action.y].color = action.prevColor;
        markCellDirty(action.x,action.y);
        render();
    }
}

const redo = () => {
    if(redoHistory.value.length > 0){
        const action = redoHistory.value.pop();
        undoHistory.value.push({x: action.x, y: action.y, color: action.prevColor, prevColor: action.color});
        grid[action.x][action.y].color = action.prevColor;
        markCellDirty(action.x,action.y);
        render();
    }
}

const createNewCanvas = () => {
    // clear history
    //undoHistory.value = [];
    //redoHistory.value = [];

    canvas.initGrid(newCanvasWidth.value, newCanvasHeight.value);
    canvas.layers.grid.needsRender = true;
    canvas.render();
    showCreateNew.value = false;
}

const gridUpdate = () => {
    canvas.layers.grid.needsRender = true;
    canvas.render();
}

const colorChange = (val) => {
    const rgb = canvas.hexToRgb(val);
    canvas.selectedColor.value = val.includes('#') ? val.replace('#', '') : val;
    canvas.selectedRgb = rgb;
}

const getHotkeyForKey = (key) => {
    const hotkey = HOTKEYS[key];
    return hotkey ? `${hotkey.ctrlKey ? 'Ctrl + ' : ''}${hotkey.key.toUpperCase()}` : '';
}

const handleCommand = (text) => {
    let response;
    const argsIndex = text.indexOf(' ');
    const command = argsIndex !== -1 ? text.substring(0, argsIndex) : text;
    const args = argsIndex !== -1 ? text.substring(argsIndex + 1).split(' ') : '';
    console.log(args)

    switch(command) {
        case "date":
            response = 'Today is ' + new Date().toDateString();
            break;

        case "color-pick":
            if(args.length < 2){
                response = 'Invalid arguments. Usage: color-pick <x> <y>';
                break;
            }
            const x = parseInt(args[0]);
            const y = parseInt(args[1]);
            if(isNaN(x) || isNaN(y)){
                response = 'Invalid arguments. Usage: color-pick <x> <y>';
                break;
            }
            if(x < 0 || x >= canvas.grid.length || y < 0 || y >= canvas.grid[0].length){
                response = `Arguments out of bounds. Usage: color-pick <x> <y>, x and y must be between 0 and the width and height of the grid (${canvas.grid.length}x${canvas.grid[0].length})`;
                break;
            }
            response = `Color picked at ${args[0]} ${args[1]} is ${canvas.grid[args[0]][args[1]].color}`;
            break;

        case "paint": 
            if(args.length < 3){
                response = 'Invalid arguments. Usage: paint <color> <x> <y>';
                break;
            }
            const color = args[0];
            const px = parseInt(args[1]);
            const py = parseInt(args[2]);
            if(isNaN(px) || isNaN(py)){
                response = 'Invalid arguments. Usage: paint <color> <x> <y>';
                break;
            }
            if(px < 0 || px >= canvas.grid.length || py < 0 || py >= canvas.grid[0].length){
                response = `Arguments out of bounds. Usage: paint <color> <x> <y>, x and y must be between 0 and the width and height of the grid (${canvas.grid.length}x${canvas.grid[0].length})`;
                break;
            }

            canvas.grid[px][py].color = color;
            canvas.markCellDirty(px,py);
            canvas.render();

            response = `Painted ${args[0]} at ${args[1]} ${args[2]}`;
            break;

        case "paint-rect":
            if(args.length < 6){
                response = 'Invalid arguments. Usage: paint-rect <color> <x> <y> <width> <height> <filled | outline>';
                break;
            }
            const rectColor = args[0];
            const rectX = parseInt(args[1]);
            const rectY = parseInt(args[2]);
            const rectWidth = parseInt(args[3]);
            const rectHeight = parseInt(args[4]);
            const rectStyle = args[5];
            if(rectStyle !== 'filled' && rectStyle !== 'outline'){
                response = 'Invalid arguments. Usage: paint-rect <color> <x> <y> <width> <height> <filled | outline>';
                break;
            }
            if(isNaN(rectX) || isNaN(rectY) || isNaN(rectWidth) || isNaN(rectHeight)){
                response = 'Invalid arguments. Usage: paint-rect <color> <x> <y> <width> <height> <filled | outline>';
                break;
            }

            if(rectX < 0 || rectX >= canvas.grid.length || rectY < 0 || rectY >= canvas.grid[0].length){
                response = `Arguments out of bounds. Usage: paint-rect <color> <x> <y> <width> <height> <filled | outline>, x and y must be between 0 and the width and height of the grid (${canvas.grid.length}x${canvas.grid[0].length})`;
                break;
            }

            for(let x = rectX; x < rectX + rectWidth; x++){
                for(let y = rectY; y < rectY + rectHeight; y++){
                    if(x < 0 || x >= canvas.grid.length || y < 0 || y >= canvas.grid[0].length){
                        continue;
                    }

                    if(rectStyle === 'outline'){
                        if(x === rectX || x === rectX + rectWidth - 1 || y === rectY || y === rectY + rectHeight - 1){
                            canvas.grid[x][y].color = rectColor;
                            canvas.markCellDirty(x,y);
                        } else continue;
                    } else {
                        canvas.grid[x][y].color = rectColor;
                        canvas.markCellDirty(x,y);
                    }
                }
            }
            canvas.render();

            response = `Painted ${args[0]} at ${args[1]} ${args[2]} with width ${args[3]} and height ${args[4]}`;
            break;

        case "random":
            response = Math.floor(Math.random() * 100);
            break;

        default:
            response = "Unknown command: " + command;
    }

    TerminalService.emit('response', response);
};

onMounted(() => {
    // init canvas
    canvas.initClass(canvasEl, gridCanvas, mouseCanvas, window, toast);
    isMounted.value = true;

    TerminalService.on('command', handleCommand);
});

onBeforeUnmount(() => {
    TerminalService.off('command', handleCommand);
});
</script>
<template>
    <div class="content">
        <Toast/>
        <Menubar style="border: none !important; width: 100%;" :model="menuItems">
            <template #start>
                {{ canvas.projectName.value }}
            </template>
        </Menubar>

        <Terminal :class="`terminal ${showTerminal ? 'active' : ''}`" welcomeMessage="Welcome to Pixel-Editor" prompt="pxl $" aria-label="Pixel-Editor Terminal Service"/>

        <div class="content-wrapper">
            <div id="tools">
                <ToggleButton class="full-input" v-model="canvas.showGrid.value" onLabel="Hide Grid" offLabel="Show Grid" @update:model-value="gridUpdate"/>
                <InputNumber style="width: 100%;" v-model="canvas.toolSize.value" showButtons inputId="integeronly" id="brush-size" :min="1" :max="20"/>
                <div class="two-row">
                    <Button v-tooltip.right="`MOVE (${getHotkeyForKey('MOVE')})`" :class="`${canvas.tool.value === TOOLS.MOVE ? 'active' : ''} input tool`" @click="canvas.tool.value = TOOLS.MOVE"><Icon name="humbleicons:arrows"/></Button>
                    <Button v-tooltip.right="`Pencil (${getHotkeyForKey('PENCIL')})`" :class="`${canvas.tool.value === TOOLS.PENCIL ? 'active' : ''} input tool`" @click="canvas.tool.value = TOOLS.PENCIL;"><Icon name="material-symbols:brush"/></Button>
                </div>
                <div class="two-row">
                    <Button v-tooltip.right="`Eraser (${getHotkeyForKey('ERASER')})`" :class="`${canvas.tool.value === TOOLS.ERASER ? 'active' : ''} input tool`" @click="canvas.tool.value = TOOLS.ERASER"><Icon name="material-symbols:ink-eraser"/></Button>
                    <Button v-tooltip.right="`Color Picker (${getHotkeyForKey('PICKER')})`" :class="`${canvas.tool.value === TOOLS.PICKER ? 'active' : ''} input tool`" @click="canvas.tool.value = TOOLS.PICKER;"><Icon name="mingcute:color-picker-fill"/></Button>
                </div>
                <div class="two-row">
                    <Button class="input" :disabled="undoHistory.length === 0" @click="undo"><Icon name="material-symbols:undo"/></Button>
                    <Button class="input" :disabled="redoHistory.length === 0" @click="redo"><Icon name="material-symbols:redo"/></Button>
                </div>
            </div>

            <div class="canvas-wrapper">
                <canvas ref="mouseCanvas" id="mouseCanvas"></canvas>
                <canvas ref="gridCanvas" id="gridCanvas"></canvas>
                <canvas ref="canvasEl" id="canvas"></canvas>
            </div>

            <div id="palette">
                <div class="color-wrapper" v-auto-animate>
                    <div class="color" v-for="color in canvas.colorPalette.value" :key="color" :style="`background-color: ${color};`" @click="colorChange(color)"></div>
                    <div class="color" style="background-color: #505050;" v-if="canvas.colorPalette.value.length === 0"></div>
                </div>
                <ColorPicker style="margin-top: 10px;" v-model="canvas.selectedColor.value" inputId="cp-hex" format="hex" class="mb-4" @update:model-value="colorChange"/>
                <div class="mouse-coords" style="margin-top: auto; color: #ccc; width: 100%; font-size: 10px; text-align: end;">{{ canvas.mouse.x }}, {{ canvas.mouse.y }}</div>
            </div>
        </div>

        <Dialog v-model:visible="showCreateNew" modal header="New Canvas" :style="{width: '25rem'}" :closable="false">
            <div style="gap: 20px; display:flex; justify-content: center; align-items: center; flex-direction: column;">
                <InputGroup>
                    <InputGroupAddon>&nbsp;&nbsp;Name&nbsp;&nbsp;</InputGroupAddon>
                    <FloatLabel variant="on">
                        <InputText v-model="canvas.projectName.value"/>
                    </FloatLabel>
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon>&nbsp;&nbsp;Width&nbsp;&nbsp;</InputGroupAddon>
                    <FloatLabel variant="on">
                        <InputNumber v-model="newCanvasWidth" inputId="integeronly" :min="5" :max="256"/>
                    </FloatLabel>
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon>&nbsp;&nbsp;Height&nbsp;&nbsp;</InputGroupAddon>
                    <FloatLabel variant="on">
                        <InputNumber v-model="newCanvasHeight" inputId="integeronly" :min="5" :max="256"/>
                    </FloatLabel>
                </InputGroup>
                <div style="width: 100%;">
                    <InputGroup class="color-wrapper" style="margin-bottom: 5px;">
                        <span class="input">Canvas Color</span>
                        <span class="input">Grid Color</span>
                    </InputGroup>
                    <InputGroup class="color-wrapper">
                        <ColorPicker v-model="canvas.bg.value" inputId="cp-hex" format="hex" class="input" v-if="isMounted"/>
                        <ColorPicker v-model="canvas.gridColor.value" inputId="cp-hex" format="hex" class="input" v-if="isMounted"/>
                    </InputGroup>
                </div>
                <div class="grid-preview" :style="`background-color: #${canvas.bg.value}; background-size: 30px 30px; background-position: -15px -10px; background-image: linear-gradient(to right, #${canvas.gridColor.value} 1px, transparent 1px),linear-gradient(to bottom, #${canvas.gridColor.value} 1px, transparent 1px);`"></div>
            </div>
            <div style="gap: 20px; display:flex; justify-content: flex-end; align-items: center; margin-top: 20px;">
                <Button type="button" label="Cancel" severity="secondary" @click="showCreateNew = false;"></Button>
                <Button type="button" label="Create" @click="createNewCanvas"></Button>
            </div>
        </Dialog>
    </div>
</template>
<style scoped>
.content{
    width: 100%;
    height: fit-content;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;

    .content-wrapper{
        width: 100%;
        flex: 1;
        display:flex;
        justify-content: center;
        align-items: center;
    }

    .canvas-wrapper{
        position: relative;
        flex: 1;
        flex-shrink: 1;
        height: 100%;

        canvas{
            max-width: calc(100% - 50px);
            max-height: calc(100% - 50px);
            aspect-ratio: 1;
            position: absolute;
            inset: 0;
            margin: auto;
        }

        #canvas{
            background-color: #202020;
            z-index: 1;
        }

        #gridCanvas{
            z-index: 2;
            pointer-events: none;
        }

        #mouseCanvas{
            z-index: 3;
            pointer-events: none;
        }
    }

    #tools{
        height: 100%;
        width: 160px;
        margin: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        background-color: #303030;
        padding: 10px;
        gap: 10px;
        flex-shrink: 0;

        .full-input{
            width: 100%;
        }

        .two-row{
            width: 100%;
            display: flex;
            display:flex;
            justify-content: center;
            align-items: center;
            gap: 10px;

            .input{
                flex: 1;
            }

            .tool:not(.active){
                opacity: .5;
            }
        }
    }

    #palette{
        width: 150px;
        height: 100%;
        margin: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        background-color: #303030;
        padding: 10px;
        padding: 10px;

        .color-wrapper{
            width: 100%;
            background-color: #505050;
            border-radius: 6px;
            display:flex;
            justify-content: flex-start;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 5px;
            padding: 5px;

            .color{
                padding: 5px;
                width: calc(20% - 4px);
                aspect-ratio: 1;
                border-radius: 6px;
                cursor: pointer;
                will-change: transform;
                transition: transform var(--transition-duration) ease, border-radius var(--transition-duration) ease;

                &:hover{
                    transform: scale(.9);
                    border-radius: 50%;
                }
            }
        }
    }

    .terminal{
        width: 100%;
        height: 30%;
        position: fixed;
        z-index: 200;
        bottom: 0;
        left: 0;
        border-radius: 10px 10px 0 0;
        transition: transform var(--transition-duration) ease;
        transform: translateY(100%);
        pointer-events: none;

        &.active{
            transform: translateY(0);
            pointer-events: all;
        }
    }
}

@media screen and ((max-width: 900px) and (min-width: 0px)) {
    
}
</style>
<style>
#brush-size .p-inputtext{
    width: 100%;
}

.p-tooltip-text{
    font-size: 12px !important;
    --p-tooltip-padding: 4px 5px !important;
}

.color-wrapper{
    width: 100%;
    display: flex;
    display:flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
}

.grid-preview{
    width: 100%;
    height: 100px;
    background-color: #404040;
    border-radius: 12px;
}
</style>