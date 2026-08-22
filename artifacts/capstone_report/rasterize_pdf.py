from pathlib import Path
import fitz

root = Path(__file__).resolve().parent
pdf = fitz.open(root / "rendered" / "BuildMate_Ghana_Capstone_Report.pdf")
for index, page in enumerate(pdf):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pix.save(root / "rendered" / f"page-{index + 1}.png")
print(len(pdf))
