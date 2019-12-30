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
    
    initialize(): void {
	super.initialize();
	this._vtk = (window as any).vtk;
	this._jszip = (window as any).JSZip;
	this._arrays = {};
	// Internal closures
	this.getArray = (hash: string) => Promise.resolve(this._arrays[hash]);
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
	window.addEventListener("resize", this.resize);
    }
    
    after_layout(): void {
	super.after_layout()
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
	}
    }

    _convert_arrays(arrays: any): void {
	this._arrays = {};
	Object.keys(arrays).forEach((path: string) => {
	    const fileName: any = path.split('/').pop();
	    if (typeof fileName === "string") {
		const hash: string = fileName;
		this._arrays[hash] = this._vtk.Common.Core.vtkBase64.toArrayBuffer(arrays[hash]);
	    }
	});
    }
    
    _plot(): void{
	if (this.model.arrays) {
	    this._convert_arrays(this.model.arrays);
	}
	this._renderWindow.synchronize(JSON.parse(this.model.scene));
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
    enable_keybindings: p.Property<boolean>
  }
}

export interface VTKPlot extends VTKPlot.Attrs {}

export class VTKPlot extends HTMLBox {
  properties: VTKPlot.Props

  constructor(attrs?: Partial<VTKPlot.Attrs>) {
    super(attrs)
  }

  static initClass(): void {
    this.prototype.type = "VTKPlot"
    this.prototype.default_view = VTKPlotView

    this.define<VTKPlot.Props>({
      scene:              [ p.String         ],
      arrays:             [ p.Any, {}        ],
      append:             [ p.Boolean, false ],
      camera:             [ p.Any            ],
      enable_keybindings: [ p.Boolean, false ]
    })

    this.override({
      height: 300,
      width: 300
    });
  }
}
VTKPlot.initClass()
