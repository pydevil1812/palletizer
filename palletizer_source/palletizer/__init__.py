from .models import (AdditionalElements, Box, OrientationFlags, Pallet,
                      StackingConfig, StackingResult)
from .packer import stack_layers
from .variants import generate_variants

# visualization/report pull in matplotlib/numpy/pandas, which only the
# desktop app (gui.py/cli.py) needs. The lightweight web API server
# (server.py) only needs models/packer/variants, so these are optional here
# to keep `import palletizer.packer` working in a server-only venv that
# doesn't have the heavy deps installed.
try:
    from .visualization import generate_all_visuals
    from .report import boxes_dataframe, export_excel, export_html, export_pdf, layers_dataframe, summary_dict
except ImportError:
    generate_all_visuals = None
    boxes_dataframe = layers_dataframe = summary_dict = None
    export_excel = export_pdf = export_html = None

__all__ = [
    "Box", "Pallet", "OrientationFlags", "AdditionalElements", "StackingConfig", "StackingResult",
    "stack_layers", "generate_variants", "generate_all_visuals",
    "boxes_dataframe", "layers_dataframe", "summary_dict",
    "export_excel", "export_pdf", "export_html",
]
