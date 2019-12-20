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
  public getState: any
  public setState: any
  public registerArray: any
    
  initialize(): void {
      console.log('initialize');
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
      this.setState = (v: any) => {
	  console.log('setState', v)
	  this._state = v;
      };
      this.getState = () => this._state;
      this.registerArray = (hash: string, array: any) =>
	  {
	      console.log('registerArray', hash);
	      this._arrays[hash] = array;
	  };
      window.addEventListener("resize", this.resize);
  }

  after_layout(): void {
      console.log('after_layout');
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
	
	this._plot()
	this._key_binding()
    }
  }
  
  connect_signals(): void {
      console.log('connect_signals');
    super.connect_signals()
    this.connect(this.model.properties.data.change, () => this._plot())
    this.connect(this.model.properties.enable_keybindings.change, () => this._key_binding())
  }
  
  _key_binding(): void {
      console.log('_key_binding');
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
      console.log('render');
    super.render()
  }
      
  _load_zip_content(zipContent: any): void {
      console.log('_load_zip_content');
    const JSZip: any = this._jszip
    const renderWindow = this._renderWindow;
    const { getState, setState, registerArray } = this;
    
    const jszip = new JSZip();
    jszip.loadAsync(zipContent).then(function(zip: any) {
      let workLoad: number = 0;
    
      function done(): void {
        if (workLoad !== 0) {
            return;
        }
        renderWindow.synchronize(getState());
      }
    
      zip.forEach(function (relativePath: string, zipEntry: any) {
        const fileName: any = relativePath.split('/').pop();
    
        if (fileName === 'index.json') {
          workLoad++;
          zipEntry.async('string').then(function (txt: string) {
            setState(JSON.parse(txt));
            workLoad--;
            done();
          });
        }
    
        if (typeof fileName === "string" && fileName.length === 32) {
          workLoad++;
          const hash = fileName;
          zipEntry.async('arraybuffer').then(function (arraybuffer: any) {
            registerArray(hash, arraybuffer);
            workLoad--;
            done();
          });
        }
      });
    });
  }
  
  _plot(): void{
      console.log('_plot');
    if (!this.model.data) {
      this._renderWindow.render()
      return
    }
      console.log('model.data', this.model.data);
      this._load_zip_content(atob(this.model.data));
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
