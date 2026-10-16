"""The heading list inlined in spec-authoring/SKILL.md must match the bundled template.

The skill carries a copy so a spec comes out right when the session may not read files inside the
installed plugin (found installing 1.0.0 into a fresh repository). A copy can drift; this keeps it honest.
"""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / "plugins/sdd-engineering/skills/spec-authoring/SKILL.md"
sys.path.insert(0, str(ROOT / "plugins/sdd-engineering/scripts"))
import check_specs  # noqa: E402


class SkillHeadingsTest(unittest.TestCase):
    def test_inline_headings_match_the_template(self):
        text = SKILL.read_text(encoding="utf-8")
        block = text.split("<!-- headings:", 1)[1].split("\n\n", 1)[0]
        inline = re.findall(r"`## ([^`]+)`", block)
        template = check_specs.sections_from(check_specs.BUNDLED_TEMPLATE.read_text(encoding="utf-8"))
        self.assertEqual(inline, template)


if __name__ == "__main__":
    unittest.main()
