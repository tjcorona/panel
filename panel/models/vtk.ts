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
 	this.registerArray = (hash: string, array: any) =>
	    {
		this._arrays[hash] = array;
                return true;
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
	const JSZip: any = this._jszip;
	const jszip = new JSZip();
        const renderWindow = this._renderWindow;
        const interactor = this._interactor;
        const scene = this.model.scene;
        const vtk: any = this._vtk;
	const { registerArray } = this;

        function load(key: string) {
            return jszip.loadAsync(atob(arrays[key]))
                .then((zip: any) => zip.file('data/' + key))
                .then((zipEntry: any) => zipEntry.async('arraybuffer'))
                .then((arraybuffer: any) => registerArray(key, arraybuffer));
        }

        let promises: any = [];
        Object.keys(arrays).forEach((key: string) => {
            promises.push(load(key));
        })

        Promise.all(promises).then(() => {
            renderWindow.synchronize(JSON.parse(scene));
            	    
        renderWindow.render();

            const renderer: any = renderWindow.getRenderers()[0];

            const useHardwareSelector: any = false;

        if (useHardwareSelector) {
        // Add a hardware selector for point picking
            const sel: any = vtk.Rendering.OpenGL.vtkHardwareSelector.newInstance();
        sel.setFieldAssociation(vtk.Common.DataModel.DataSet.Constants.FieldAssociations.FIELD_ASSOCIATION_POINTS);
        sel.attach(this._openGLRenderWindow, renderer);

        // Pick on mouse right click
            interactor.onRightButtonPress((callData: any) => {
          if (renderer !== callData.pokedRenderer) {
            return;
          }

            const pos: any = callData.position;
            const point: any = [pos.x, pos.y, 0.0];
          console.log(`Select at: ${point}`);

          sel.setArea(pos.x, pos.y, pos.x, pos.y);
          const selection = sel.select(pos.x, pos.y, pos.x, pos.y);
          if (selection.length !== 0) {
            console.log('converted to', selection[0].getSelectionList()[0]);
          }

          renderWindow.render();
        });
      } else {
        // ----------------------------------------------------------------------------
        // Setup picking interaction
        // ----------------------------------------------------------------------------
        // Only try to pick cone points
          const picker: any = vtk.Rendering.Core.vtkPointPicker.newInstance();

        // Pick on mouse right click
          console.log('Setting right button event')
          console.log(renderWindow)
          interactor.onRightButtonPress((callData: any) => {
          if (renderer !== callData.pokedRenderer) {
            return;
          }

            const pos: any = callData.position;
            const point: any = [pos.x, pos.y, 0.0];
          console.log(`Pick at: ${point}`);
          picker.pick(point, renderer);

          if (picker.getActors().length === 0) {
              const pickedPoint: any = picker.getPickPosition();
            console.log(`No point picked, default: ${pickedPoint}`);
              const sphere: any = vtk.Filters.Sources.vtkSphereSource.newInstance();
            sphere.setCenter(pickedPoint);
            sphere.setRadius(0.01);
              const sphereMapper: any = vtk.Rendering.Core.vtkMapper.newInstance();
            sphereMapper.setInputData(sphere.getOutputData());
              const sphereActor: any = vtk.Rendering.Core.vtkActor.newInstance();
            sphereActor.setMapper(sphereMapper);
            sphereActor.getProperty().setColor(1.0, 0.0, 0.0);
            renderer.addActor(sphereActor);
          } else {
              const pickedPointId: any = picker.getPointId();
            console.log('Picked point: ', pickedPointId);

              const pickedPoints: any = picker.getPickedPositions();
            for (let i = 0; i < pickedPoints.length; i++) {
                const pickedPoint: any = pickedPoints[i];
              console.log(`Picked: ${pickedPoint}`);
                console.log(vtk)
                const sphere: any = vtk.Filters.Sources.vtkSphereSource.newInstance();
              sphere.setCenter(pickedPoint);
              sphere.setRadius(0.01);
                const sphereMapper: any = vtk.Rendering.Core.vtkMapper.newInstance();
              sphereMapper.setInputData(sphere.getOutputData());
                const sphereActor: any = vtk.Rendering.Core.vtkActor.newInstance();
              sphereActor.setMapper(sphereMapper);
              sphereActor.getProperty().setColor(0.0, 1.0, 0.0);
              renderer.addActor(sphereActor);
            }
          }
          renderWindow.render();
        });
      }

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
