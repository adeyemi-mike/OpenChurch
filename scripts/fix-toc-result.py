#!/usr/bin/env python3
"""Remove docx-js's built-in sample TOC result entry.

docx-js's TableOfContents emits begin + instrText + separate + a sample
hyperlink entry inside the SAME paragraph. add_toc_placeholders.py inserts
the real placeholder entries after that paragraph, so the sample entry
renders as a duplicate first line with no page number until the user
updates the field. This script strips any <w:hyperlink> that follows the
'separate' fldChar inside the paragraph carrying the TOC instruction.
"""
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

def fix(path: str) -> None:
    src = Path(path)
    with zipfile.ZipFile(src) as zin:
        names = zin.namelist()
        doc = zin.read("word/document.xml").decode("utf-8")

        # Find the paragraph containing the TOC instrText.
        para_re = re.compile(r"<w:p\b.*?</w:p>", re.S)
        changed = 0
        out = []
        last = 0
        for m in para_re.finditer(doc):
            p = m.group(0)
            if "<w:instrText" in p and re.search(r">\s*TOC\s+\\", p):
                # Drop hyperlinks inside this field paragraph (sample result).
                new_p, n = re.subn(r"<w:hyperlink\b.*?</w:hyperlink>", "", p, flags=re.S)
                if n:
                    changed += n
                    p = new_p
            out.append(doc[last:m.start()])
            out.append(p)
            last = m.end()
        out.append(doc[last:])
        doc = "".join(out)

        if changed == 0:
            print("no sample TOC result found; nothing changed")
            return

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            tmp_path = tmp.name
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for name in names:
                if name == "word/document.xml":
                    zout.writestr(name, doc)
                else:
                    zout.writestr(name, zin.read(name))
    shutil.move(tmp_path, src)
    print(f"removed {changed} sample TOC result hyperlink(s) from {src.name}")

if __name__ == "__main__":
    fix(sys.argv[1])
