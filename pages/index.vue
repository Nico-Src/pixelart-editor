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

const isMounted = ref(false);
const canvasEl = ref(null);
const gridCanvas = ref(null);
const mouseCanvas = ref(null);
const canvas = new app.$classes.Canvas();

const undoHistory = ref([]);
const redoHistory = ref([]);

const showCreateNew = ref(true);

const menuItems = ref([
    {label: 'File', items: [
        {label: 'Open', icon: 'pi pi-fw pi-file', command: () => {canvas.open();}},
        {label: 'New', icon: 'pi pi-fw pi-file', command: () => {showCreateNew.value = true;}},
        {label: 'Export Image', icon: 'pi pi-fw pi-file-export', command: () => {canvas.export();}},
        {label: 'Save', icon: 'pi pi-fw pi-save', command: () => {canvas.save();}},
    ]},
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
    canvas.selectedRgb = rgb;
}

const getHotkeyForKey = (key) => {
    const hotkey = HOTKEYS[key];
    return hotkey ? `${hotkey.ctrlKey ? 'Ctrl + ' : ''}${hotkey.key.toUpperCase()}` : '';
}

onMounted(() => {
    // init canvas
    canvas.initClass(canvasEl, gridCanvas, mouseCanvas, window, toast);
    isMounted.value = true;
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
                <ColorPicker v-model="canvas.selectedColor.value" inputId="cp-hex" format="hex" class="mb-4" v-if="isMounted" @update:model-value="colorChange"/>
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
        justify-content: center;
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
        height: 100%;
        margin: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: #303030;
        padding: 10px;
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