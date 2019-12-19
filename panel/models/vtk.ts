import * as p from "core/properties"
import {clone} from "core/util/object";
import {HTMLBox, HTMLBoxView} from "models/layouts/html_box";
import {div} from "core/dom";

export class VTKPlotView extends HTMLBoxView {
    model: VTKPlot
    protected _vtk: any
    protected _jszip: any
    protected _container: HTMLDivElement
    protected _rendererEl: any
    protected _renderer: any
    protected _camera: any
    protected _interactor: any
    protected _setting: boolean = false
    
    initialize(): void {
	super.initialize()
	this._vtk = (window as any).vtk
	this._jszip = (window as any).JSZip
	this._container = div({
	    style: {
		width: "100%",
		height: "100%"
	    }
	});
    }
    
    after_layout(): void {
	super.after_layout()
	if (!this._rendererEl) {
	    this._rendererEl = this._vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
		rootContainer: this.el,
		container: this._container
	    });
	    this._renderer = this._rendererEl.getRenderer()
	    this._interactor = this._rendererEl.getInteractor()
	    this._camera = this._renderer.getActiveCamera()
	    this._plot()
	    this._camera.onModified(() => this._get_camera_state())
	    this._key_binding()
	}
    }

    connect_signals(): void {
	super.connect_signals()
	this.connect(this.model.properties.data.change, () => this._plot())
	this.connect(this.model.properties.camera.change, () => this._set_camera_state())
	this.connect(this.model.properties.enable_keybindings.change, () => this._key_binding())
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
	if (!(this._container === this.el.childNodes[0]))
	    this.el.appendChild(this._container)
    }
    
    _get_camera_state(): void {
	if (!this._setting) {
	    this._setting = true;
	    const state = clone(this._camera.get());
	    delete state.classHierarchy;
	    delete state.vtkObject;
	    delete state.vtkCamera;
	    delete state.viewPlaneNormal;
	    this.model.camera = state;
	    this._setting = false;
	}
    }
    
    _set_camera_state(): void {
	if (!this._setting) {
	    this._setting = true;
	    try {
		this._camera.set(this.model.camera);
	    } finally {
		this._setting = false;
	    }
	    this._rendererEl.getRenderWindow().render();
	}
    }
    
    _load_zip_content(zipContent: string, container: HTMLDivElement): void {
	const fileContents: any = { state: null, arrays: {} };
	
	function getArray(hash: string, _1: any): Promise<string> {
	    return Promise.resolve(fileContents.arrays[hash]);
	}

	let vtk: any = this._vtk;
	let JSZip: any = this._jszip
  
	const jszip = new JSZip();
	jszip.loadAsync(zipContent).then(function(zip: any) {
	    let workLoad: number = 0;
  
	    function done(): void {
		if (workLoad !== 0) {
		    return;
		}
		
		// Synchronize context
		const synchronizerContext = vtk.Rendering.Misc.vtkSynchronizableRenderWindow.getSynchronizerContext(
		    "__zipFileContent__"
		);
		synchronizerContext.setFetchArrayFunction(getArray);
		
		// openGLRenderWindow
		const openGLRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
		openGLRenderWindow.setContainer(container);
		
		// RenderWindow (synchronizable)
		const renderWindow = vtk.Rendering.Misc.vtkSynchronizableRenderWindow.newInstance({
		    synchronizerContext,
		});
		renderWindow.addView(openGLRenderWindow);
		
		// Size handling
		function resize(): void {
		    const dims = container.getBoundingClientRect();
		    const devicePixelRatio = window.devicePixelRatio || 1;
		    openGLRenderWindow.setSize(
			Math.floor(dims.width * devicePixelRatio),
			Math.floor(dims.height * devicePixelRatio)
		    );
		    renderWindow.render();
		}
		window.addEventListener("resize", resize);
		resize();

		// Interactor
		const interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
		interactor.setInteractorStyle(
		    vtk.Interaction.Style.vtkInteractorStyleTrackballCamera.newInstance()
		);
		interactor.setView(openGLRenderWindow);
		interactor.initialize();
		interactor.bindEvents(container);
		
		// Load the scene
		renderWindow.synchronize(fileContents.state);
	    }
  
	    zip.forEach(function (relativePath: string, zipEntry: any) {
		
		const fileName: any = relativePath.split('/').pop();

		if (fileName === 'index.json') {
		    workLoad++;
		    zipEntry.async('string').then(function (txt: string) {
			fileContents.state = JSON.parse(txt);
			workLoad--;
			done();
		    });
		}

		if (typeof fileName === "string" && fileName.length === 32) {
		    workLoad++;
		    const hash = fileName;
		    zipEntry.async('arraybuffer').then(function (arraybuffer: any) {
			fileContents.arrays[hash] = arraybuffer;
			workLoad--;
			done();
		    });
		}
	    });
	});
    }

    _plot(): void{
	if (!this.model.append) {
	    this._delete_all_actors()
	}
	if (!this.model.data) {
	    this._rendererEl.getRenderWindow().render()
	    return
	}
	this._load_zip_content(atob(this.model.data), this._container);
    }

    _delete_all_actors(): void{
	this._renderer.getActors().map((actor: unknown) => this._renderer.removeActor(actor))
    }
}


export namespace VTKPlot {
  export type Attrs = p.AttrsOf<Props>
  export type Props = HTMLBox.Props & {
    data: p.Property<string>
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
      data:               [ p.String         ],
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
