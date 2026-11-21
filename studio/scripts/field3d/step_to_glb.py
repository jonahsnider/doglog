# Converts a STEP file into a GLB with native OpenCascade, one node for each part, named after it, with its faces'
# colors. Run by `scripts/field-model.ts`: `uv run --project scripts/field3d scripts/field3d/step_to_glb.py <step> <glb>`.
import sys

from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.collections import (
    IndexedDataMap_TCollection_AsciiString_TCollection_AsciiString as FileInfo,
)
from OCP.IFSelect import IFSelect_RetDone
from OCP.Message import Message_ProgressRange
from OCP.RWGltf import RWGltf_CafWriter
from OCP.RWMesh import RWMesh_CoordinateSystem
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_AsciiString, TCollection_ExtendedString
from OCP.TDocStd import TDocStd_Document
from OCP.XCAFDoc import XCAFDoc_DocumentTool

# Triangles can be this far from the CAD's surfaces, as a share of the model's size
deflection_ratio = 0.001

source, output = sys.argv[1], sys.argv[2]

document = TDocStd_Document(TCollection_ExtendedString("field"))
reader = STEPCAFControl_Reader()
reader.SetNameMode(True)
reader.SetColorMode(True)
if reader.ReadFile(source) != IFSelect_RetDone or not reader.Transfer(document):
    raise SystemExit(f"Couldn't read {source}")

shape = XCAFDoc_DocumentTool.ShapeTool_s(document.Main()).GetOneShape()
box = Bnd_Box()
BRepBndLib.Add_s(shape, box)
diagonal = box.CornerMin().Distance(box.CornerMax())
BRepMesh_IncrementalMesh(shape, diagonal * deflection_ratio, False, 0.5, True)

writer = RWGltf_CafWriter(TCollection_AsciiString(output), True)
converter = writer.ChangeCoordinateSystemConverter()
# OpenCascade works in millimeters, glTF in meters
converter.SetInputLengthUnit(0.001)
# Keeps the CAD's +Z up, the cleanup in `field-model.ts` expects it
converter.SetOutputCoordinateSystem(RWMesh_CoordinateSystem.RWMesh_CoordinateSystem_Zup)
writer.SetMergeFaces(True)
if not writer.Perform(document, FileInfo(), Message_ProgressRange()):
    raise SystemExit(f"Couldn't write {output}")
