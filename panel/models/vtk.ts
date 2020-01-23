import * as p from "core/properties"
import {HTMLBox, HTMLBoxView} from "models/layouts/html_box";

const CONTEXT_NAME = '__zipFileContent__';

export class VTKPlotView extends HTMLBoxView {
    model: VTKPlot
    protected _vtk: any
    protected _jszip: any
    protected _synchContext: any
    protected _openGLRenderWindow: any
    protected _renderWindow: any
    protected _renderer: any
    protected _interactor: any
    protected _state: any
    protected _arrays: any
    public getArray: any
    public resize: any
    public registerArray: any
    
    initialize(): void {
	super.initialize();
	this._vtk = (window as any).vtk;
	this._jszip = (window as any).JSZip;
	this._arrays = {};
	// Internal closures
//	this.getArray = (hash: string) => Promise.resolve(this._arrays[hash]);
	this.getArray = (hash: string) => {
            console.log('getArray:', hash)
            return Promise.resolve(this._arrays[hash]);
        };
	this.resize = () => {
	    if (this.el && this._openGLRenderWindow) {
		const dims = this.el.getBoundingClientRect();
		const devicePixelRatio = window.devicePixelRatio || 1;
		this._openGLRenderWindow.setSize(
		    Math.floor(dims.width * devicePixelRatio),
		    Math.floor(dims.height * devicePixelRatio)
		);
		this._renderWindow.render();
	    }
	};
 	this.registerArray = (hash: string, array: any) =>
	    {
                console.log('registerArray:', hash)
		this._arrays[hash] = array;
                return true;
	    };
	window.addEventListener("resize", this.resize);
    }
    
    after_layout(): void {
	if (!this._synchContext) {
	    const container = this.el;
	    
	    const vtk: any = this._vtk;
	    
	    this._synchContext = vtk.Rendering.Misc.vtkSynchronizableRenderWindow.getSynchronizerContext(
		CONTEXT_NAME
	    );
	    this._synchContext.setFetchArrayFunction(this.getArray);
	    
	    // openGLRenderWindow
	    this._openGLRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
	    this._openGLRenderWindow.setContainer(container);
	    
	    // RenderWindow (synchronizable)
	    this._renderWindow = vtk.Rendering.Misc.vtkSynchronizableRenderWindow.newInstance({
		synchronizerContext: this._synchContext,
	    });
	    this._renderWindow.addView(this._openGLRenderWindow);
	    
	    // Size handling
	    this.resize();
	    
	    // Interactor
	    this._interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
	    this._interactor.setInteractorStyle(
		vtk.Interaction.Style.vtkInteractorStyleTrackballCamera.newInstance()
	    );
	    this._interactor.setView(this._openGLRenderWindow);
	    this._interactor.initialize();
	    this._interactor.bindEvents(container);
	    
	    this._plot();
	    this._key_binding();

            // Can return undefined before synchronization
            const getRenderer = () => this._renderWindow.getRenderers()[0];
            const getRenderWindow = () => this._renderWindow;
            
            this.model.renderer_el = {
                getRenderer,
                getRenderWindow,
            };
	}
	super.after_layout();
    }

    _convert_arrays(arrays: any): void {
        if (this._arrays[Object.keys(arrays)[0]]) {
            return;
        }
//	this._arrays = {};
	const JSZip: any = this._jszip;
	const jszip = new JSZip();
        const renderWindow = this._renderWindow;
        const scene = this.model.scene;
        console.log('in convert arrays')
	const { registerArray } = this;

        function load(key: string) {
            return jszip.loadAsync(atob(arrays[key]))
                .then((zip: any) => zip.file('data/' + key))
                .then((zipEntry: any) => zipEntry.async('arraybuffer'))
                .then((arraybuffer: any) => registerArray(key, arraybuffer));
        }

        let promises: any = [];
        Object.keys(arrays).forEach((key: string) => {
            console.log('start decoding', key)
            promises.push(load(key));
        })

        Promise.all(promises).then(() => {
            console.log('Synchronizing the scene')
            renderWindow.synchronize(JSON.parse(scene));
            console.log(JSON.parse(scene))

            renderWindow.render();
        });
    }
    
    _plot(): void{
	if (this.model.arrays) {
	    this._convert_arrays(this.model.arrays);
	}
    }

    _key_binding(): void {
	if (this.model.enable_keybindings) {
	    document.querySelector('body')!.addEventListener('keypress',this._interactor.handleKeyPress)
	    document.querySelector('body')!.addEventListener('keydown',this._interactor.handleKeyDown)
	    document.querySelector('body')!.addEventListener('keyup',this._interactor.handleKeyUp)
	} else {
	    document.querySelector('body')!.removeEventListener('keypress',this._interactor.handleKeyPress)
	    document.querySelector('body')!.removeEventListener('keydown',this._interactor.handleKeyDown)
	    document.querySelector('body')!.removeEventListener('keyup',this._interactor.handleKeyUp)
	}
    }
    
    render() {
	super.render()
    }

    connect_signals(): void {
	super.connect_signals()
	this.connect(this.model.properties.scene.change, () => this._plot())
	this.connect(this.model.properties.enable_keybindings.change, () => this._key_binding())
    }
}


export namespace VTKPlot {
  export type Attrs = p.AttrsOf<Props>
  export type Props = HTMLBox.Props & {
    scene: p.Property<string>
    arrays: p.Property<any>
    append: p.Property<boolean>
    camera: p.Property<any>
    selection: p.Property<any>
    enable_keybindings: p.Property<boolean>
  }
}

export interface VTKPlot extends VTKPlot.Attrs {}

export class VTKPlot extends HTMLBox {
  properties: VTKPlot.Props
    renderer_el: any

  constructor(attrs?: Partial<VTKPlot.Attrs>) {
    super(attrs)
      this.renderer_el = null
  }

  getActors() : [any] {
    return this.renderer_el.getRenderer().getActors()
  }

  static initClass(): void {
    this.prototype.type = "VTKPlot"
    this.prototype.default_view = VTKPlotView

    this.define<VTKPlot.Props>({
      scene:              [ p.String         ],
      arrays:             [ p.Any, {}        ],
      append:             [ p.Boolean, false ],
      camera:             [ p.Any            ],
      selection:          [ p.Any            ],
      enable_keybindings: [ p.Boolean, false ],
    })

    this.override({
      height: 300,
      width: 300
    });
  }
}
VTKPlot.initClass()
