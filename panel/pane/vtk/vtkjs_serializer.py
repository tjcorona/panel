# coding: utf-8
"""
Serializer of vtk render windows
Adpation from :
https://kitware.github.io/vtk-js/examples/SceneExplorer.html
https://raw.githubusercontent.com/Kitware/vtk-js/master/Utilities/ParaView/export-scene-macro.py
Licence :
https://github.com/Kitware/vtk-js/blob/master/LICENSE
"""

import vtk
import base64, ctypes, io, json, os, sys, zipfile

if sys.version_info >= (2, 7):
    base64encode = lambda x: base64.b64encode(x).decode('utf-8')
else:
    base64encode = lambda x: x.encode('base64')

def render_window_serializer(render_window):
    """
    Function to convert a vtk render window in a vtk-js scene.
    """
    render_window.OffScreenRenderingOn()
    render_window.Render()

    buffered_exporter = vtk.vtkVtkJSSceneExporter()
    buffered_archiver = vtk.vtkVtkJSBufferedArchiver()
    buffered_exporter.SetArchiver(buffered_archiver)
    buffered_exporter.SetRenderWindow(render_window)
    buffered_exporter.Write()

    ptr = buffered_archiver.GetBufferAddress()
    address = int(ptr[1:-7], 16)
    ArrayType = ctypes.c_byte*buffered_archiver.GetBufferSize()
    b = ArrayType.from_address(address)

    stream = io.BytesIO(b)

    arrays = {}
    scene = None

    with zipfile.ZipFile(stream) as zf:
        for info in zf.infolist(): 
            filename = os.path.split(info.filename)[-1]
            if len(filename) != 32:
                scene = zf.read(info.filename).decode("utf-8")
            else:
                arrays[filename] = base64encode(zf.read(info.filename))

    return (arrays, scene)
