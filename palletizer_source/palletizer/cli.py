"""
CLI entry point.

Usage:
    python -m palletizer.cli --config example_input.json --outdir output

The JSON config schema is shown in `example_input.json`. `additional_elements`
is fully optional — omit it (or set "enabled": false) to ignore spacers/
corner posts/film entirely.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from .models import AdditionalElements, Box, OrientationFlags, Pallet, StackingConfig
from .packer import stack_layers
from .visualization import generate_all_visuals
from .report import export_excel, export_html, export_pdf, summary_dict


def load_config(config_path: str) -> StackingConfig:
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    box = Box(**data["box"])
    pallet = Pallet(**data["pallet"])
    flags = OrientationFlags(**data.get("orientation_flags", {}))

    additional = None
    add_data = data.get("additional_elements")
    if add_data:
        additional = AdditionalElements(**add_data)

    return StackingConfig(
        box=box,
        pallet=pallet,
        max_stack_height=data["max_stack_height"],
        orientation_flags=flags,
        additional=additional,
    )


def run(config: StackingConfig, outdir: str) -> dict:
    os.makedirs(outdir, exist_ok=True)
    result = stack_layers(config)
    images = generate_all_visuals(result, outdir)
    excel_path = export_excel(result, os.path.join(outdir, "report.xlsx"))
    pdf_path = export_pdf(result, images, os.path.join(outdir, "report.pdf"))
    html_path = export_html(result, images, os.path.join(outdir, "report.html"))
    return {
        "result": result,
        "images": images,
        "excel": excel_path,
        "pdf": pdf_path,
        "html": html_path,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Stack boxes on pallets.")
    parser.add_argument("--config", required=True, help="Path to a JSON config file.")
    parser.add_argument("--outdir", default="output", help="Directory to write outputs to.")
    args = parser.parse_args(argv)

    config = load_config(args.config)
    outputs = run(config, args.outdir)
    result = outputs["result"]

    print("\n=== Pallet Loading Summary ===")
    for k, v in summary_dict(result).items():
        print(f"{k:38s}: {v}")

    if result.recommendations:
        print("\n=== Recommendations ===")
        for r in result.recommendations:
            print(f"- {r}")

    print(f"\nExcel report : {outputs['excel']}")
    print(f"PDF report   : {outputs['pdf']}")
    print(f"HTML report  : {outputs['html']}")
    print(f"Images       : {', '.join(outputs['images'].values())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
