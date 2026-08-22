from pathlib import Path
import fitz

root = Path(__file__).resolve().parent
pdf_path = root / "regent-rendered" / "BuildMate_Ghana_Regent_Capstone_Report_Final.pdf"
output_dir = root / "regent-rendered" / "qa-final"
output_dir.mkdir(parents=True, exist_ok=True)

with fitz.open(pdf_path) as pdf:
    for index, page in enumerate(pdf, start=1):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        pixmap.save(output_dir / f"page-{index}.png")
    print(len(pdf))
