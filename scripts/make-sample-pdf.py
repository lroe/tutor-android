#!/usr/bin/env python3
"""Create a small, synthetic dental textbook sample for testing Cove."""

from __future__ import annotations

from pathlib import Path

from PIL import Image as PILImage, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "sample" / "tooth-anatomy-sample.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A5
MARGIN = 17 * mm
SAGE = colors.HexColor("#5c7a6b")
SAGE_DEEP = colors.HexColor("#3f5a4c")
INK = colors.HexColor("#2f2a24")
MUTED = colors.HexColor("#8d8375")
PAPER = colors.HexColor("#f7f3ec")

FONT_SERIF = "Times-Roman"
FONT_SERIF_BOLD = "Times-Bold"
FONT_SANS = "Helvetica"
FONT_SANS_BOLD = "Helvetica-Bold"

font_dir = Path("/usr/share/fonts/truetype/dejavu")
if (font_dir / "DejaVuSerif.ttf").exists():
    pdfmetrics.registerFont(TTFont("DejaVuSerif", font_dir / "DejaVuSerif.ttf"))
    pdfmetrics.registerFont(
        TTFont("DejaVuSerif-Bold", font_dir / "DejaVuSerif-Bold.ttf")
    )
    pdfmetrics.registerFont(TTFont("DejaVuSans", font_dir / "DejaVuSans.ttf"))
    pdfmetrics.registerFont(
        TTFont("DejaVuSans-Bold", font_dir / "DejaVuSans-Bold.ttf")
    )
    FONT_SERIF = "DejaVuSerif"
    FONT_SERIF_BOLD = "DejaVuSerif-Bold"
    FONT_SANS = "DejaVuSans"
    FONT_SANS_BOLD = "DejaVuSans-Bold"

body = ParagraphStyle(
    "body",
    fontName=FONT_SERIF,
    fontSize=10.2,
    leading=15.4,
    textColor=INK,
    alignment=TA_JUSTIFY,
    spaceAfter=7,
)
bullet = ParagraphStyle(
    "bullet",
    parent=body,
    leftIndent=12,
    firstLineIndent=-8,
    spaceAfter=3,
    alignment=0,
)
lede = ParagraphStyle(
    "lede",
    fontName=FONT_SERIF,
    fontSize=11.4,
    leading=17,
    textColor=colors.HexColor("#5f574c"),
    spaceAfter=12,
)
chapter_title = ParagraphStyle(
    "chapter_title",
    fontName=FONT_SERIF_BOLD,
    fontSize=23,
    leading=27,
    textColor=INK,
    spaceAfter=4,
)
chapter_number = ParagraphStyle(
    "chapter_number",
    fontName=FONT_SANS_BOLD,
    fontSize=8,
    leading=11,
    textColor=SAGE,
    spaceBefore=3,
    spaceAfter=6,
)
subhead = ParagraphStyle(
    "subhead",
    fontName=FONT_SANS_BOLD,
    fontSize=10.6,
    leading=14,
    textColor=SAGE_DEEP,
    spaceBefore=11,
    spaceAfter=4,
)
caption = ParagraphStyle(
    "caption",
    fontName=FONT_SANS,
    fontSize=7.6,
    leading=10.5,
    textColor=MUTED,
)


class Bookmark(Paragraph):
    def __init__(self, text, style, key, level, title):
        super().__init__(text, style)
        self.bookmark_key = key
        self.bookmark_level = level
        self.bookmark_title = title


class SampleDoc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        key = getattr(flowable, "bookmark_key", None)
        if key:
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(
                getattr(flowable, "bookmark_title", key),
                key,
                getattr(flowable, "bookmark_level", 0),
                closed=False,
            )

    def on_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT_SANS, 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN, 9 * mm, "The Anatomy of a Tooth")
        canvas.drawRightString(PAGE_W - MARGIN, 9 * mm, str(canvas.getPageNumber()))
        canvas.setStrokeColor(colors.HexColor("#e3dacb"))
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, 13 * mm, PAGE_W - MARGIN, 13 * mm)
        canvas.restoreState()


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(SAGE)
    canvas.rect(0, PAGE_H - 58 * mm, PAGE_W, 58 * mm, fill=1, stroke=0)
    canvas.setFillColor(PAPER)
    canvas.circle(PAGE_W / 2, PAGE_H - 32 * mm, 15 * mm, fill=1, stroke=0)
    canvas.setFillColor(SAGE_DEEP)
    canvas.setFont(FONT_SERIF_BOLD, 28)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 41.5 * mm, "A")

    canvas.setFillColor(INK)
    canvas.setFont(FONT_SANS_BOLD, 7.5)
    canvas.drawString(MARGIN, PAGE_H - 78 * mm, "A GUIDED SAMPLE  ·  COVE")
    canvas.setFont(FONT_SERIF_BOLD, 27)
    canvas.drawString(MARGIN, PAGE_H - 94 * mm, "The Anatomy")
    canvas.drawString(MARGIN, PAGE_H - 105 * mm, "of a Tooth")
    canvas.setFont(FONT_SERIF, 12.5)
    canvas.setFillColor(colors.HexColor("#5f574c"))
    canvas.drawString(MARGIN, PAGE_H - 117 * mm, "Structure, support, and the stories teeth tell")

    canvas.setFont(FONT_SANS, 8.2)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 34 * mm, "Synthetic text for trying out Cove.")
    canvas.drawString(MARGIN, 29 * mm, "No clinical decisions should be made from it.")
    canvas.restoreState()


def heading(number, title, key):
    return [
        Paragraph(f"CHAPTER {number}", chapter_number),
        Bookmark(
            title,
            chapter_title,
            key=key,
            level=0,
            title=f"{number}. {title}",
        ),
        Spacer(1, 2),
        Paragraph(
            "A guided reading sample. Read slowly; the details are meant to connect.",
            caption,
        ),
        Spacer(1, 11),
    ]


def sub(text, key, parent):
    return Bookmark(
        text,
        subhead,
        key=key,
        level=1,
        title=f"{parent} · {text}",
    )


def make_tooth_figure() -> Path:
    figure_dir = ROOT / "sample" / "figures"
    figure_dir.mkdir(parents=True, exist_ok=True)
    path = figure_dir / "tooth-layers.png"
    width, height = 1000, 640
    image = PILImage.new("RGB", (width, height), "#fbf7ef")
    draw = ImageDraw.Draw(image)
    ink = "#2f2a24"
    enamel = "#fdf9ef"
    dentin = "#e7d3b4"
    pulp = "#c98372"
    root = "#d9c6a8"
    sage = "#5c7a6b"
    muted = "#8a8072"

    font_regular = ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 25
    )
    font_bold = ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 27
    )
    font_small = ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20
    )

    draw.rounded_rectangle(
        (14, 14, width - 14, height - 14),
        radius=26,
        fill="#f8f2e8",
        outline="#e3d8c7",
        width=2,
    )

    # Crown and roots.
    draw.rounded_rectangle(
        (250, 95, 750, 350), radius=92, fill=enamel, outline=ink, width=5
    )
    draw.polygon(
        [(335, 330), (475, 330), (470, 560), (400, 600), (330, 530)],
        fill=enamel,
        outline=ink,
    )
    draw.polygon(
        [(525, 330), (665, 330), (670, 530), (600, 600), (530, 560)],
        fill=enamel,
        outline=ink,
    )

    # Dentin.
    draw.rounded_rectangle(
        (320, 135, 680, 345), radius=70, fill=dentin, outline=muted, width=3
    )
    draw.polygon(
        [(380, 330), (465, 330), (455, 520), (400, 548), (365, 500)],
        fill=dentin,
        outline=muted,
    )
    draw.polygon(
        [(535, 330), (620, 330), (635, 500), (600, 548), (545, 520)],
        fill=dentin,
        outline=muted,
    )

    # Pulp chamber and canals.
    draw.rounded_rectangle(
        (425, 190, 575, 360), radius=45, fill=pulp, outline="#9a5b4b", width=3
    )
    draw.polygon(
        [(455, 350), (490, 350), (478, 525), (460, 535)],
        fill=pulp,
        outline="#9a5b4b",
    )
    draw.polygon(
        [(510, 350), (545, 350), (540, 535), (522, 525)],
        fill=pulp,
        outline="#9a5b4b",
    )

    # CEJ line.
    draw.line([(305, 345), (695, 345)], fill=sage, width=3)
    draw.line([(735, 370), (690, 345)], fill=sage, width=2)
    draw.text((745, 370), "CEJ", font=font_small, fill=sage, anchor="lm")

    def label(text, xy, target, side):
        x, y = xy
        anchor = "lm" if side == "left" else "rm"
        draw.text((x, y), text, font=font_bold, fill=ink, anchor=anchor)
        text_width = draw.textlength(text, font=font_bold)
        start_x = x + text_width + 10 if side == "left" else x - text_width - 10
        draw.line([(start_x, y), target], fill=sage, width=2)
        draw.ellipse(
            (target[0] - 4, target[1] - 4, target[0] + 4, target[1] + 4),
            fill=sage,
        )

    label("enamel", (64, 148), (300, 160), "left")
    label("dentin", (936, 225), (682, 225), "right")
    label("pulp", (936, 425), (585, 345), "right")
    label("cementum", (936, 520), (672, 458), "right")
    label("root", (64, 548), (326, 535), "left")

    draw.text(
        (46, 44),
        "The layers of a tooth",
        font=ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 30
        ),
        fill=ink,
    )
    draw.text(
        (46, 84),
        "A cross-section through a single-rooted tooth",
        font=font_small,
        fill=muted,
    )
    draw.text(
        (46, 596),
        "Enamel is the outer shell; dentin is the living middle; the pulp carries vessels and nerves.",
        font=font_small,
        fill=muted,
    )

    image.save(path, quality=94)
    return path


TOOTH_FIGURE = make_tooth_figure()


story = []

# ---------- inside ----------
story.append(Spacer(1, 2))
story.append(Paragraph("What's inside", chapter_title))
story.append(
    Paragraph(
        "Six short chapters that move from the hard outer shell of a tooth to the living "
        "tissues that hold it in place, then out to the way we name, use, and sometimes "
        "misread teeth.",
        lede,
    )
)
for number, title in [
    ("01", "The architecture of a tooth"),
    ("02", "The periodontium"),
    ("03", "Naming and numbering teeth"),
    ("04", "Occlusion and contact"),
    ("05", "Eruption and the mixed dentition"),
    ("06", "When development goes off-script"),
]:
    story.append(
        Paragraph(
            f"<font color='#5c7a6b'>{number}</font>&nbsp;&nbsp; {title}",
            ParagraphStyle(
                "tocline",
                fontName=FONT_SERIF,
                fontSize=11,
                leading=20,
                textColor=INK,
            ),
        )
    )
story.append(Spacer(1, 12))
story.append(
    Paragraph(
        "This booklet is deliberately short. Its purpose is to give you a real PDF with a "
        "table of contents, headings, and enough text to test a study app.",
        caption,
    )
)
story.append(PageBreak())

# ---------- chapter 1 ----------
story += heading("01", "The architecture of a tooth", "ch1")
story.append(
    Paragraph(
        "A tooth looks like a single object. In reality it is a layered structure in which "
        "four tissues meet, each with a different job. The layers are easiest to remember if "
        "you follow the path of an outside force: a bite first meets enamel, then spreads "
        "through dentin, and finally reaches the pulp. The same path explains why a small "
        "cavity can be silent while a deep one hurts.",
        lede,
    )
)
story.append(sub("The crown and the root", "ch1-crown", "Chapter 01"))
story.append(
    Paragraph(
        "The crown is the part of the tooth covered by enamel. The root is the part covered "
        "by cementum. The boundary between them is the cementoenamel junction, usually called "
        "the CEJ. In health it sits just below the gingival margin, but its position changes "
        "with age, recession, and years of brushing. When you see a root surface in the mouth, "
        "that is a clinical observation, not just an anatomical one.",
        body,
    )
)
story.append(sub("Enamel: hard, brittle, and unreplaceable", "ch1-enamel", "Chapter 01"))
story.append(
    Paragraph(
        "Enamel is the hardest tissue in the body, but hardness is not toughness. It is about "
        "96 percent mineral by weight, with very little water and no living cells. Once enamel "
        "is lost, it does not regenerate. Its rods are arranged in bundles that run from the "
        "dentinoenamel junction toward the surface, giving it direction and explaining why "
        "cracks and wear patterns have a preferred path. The surface is richest in fluoride, "
        "which is one reason a small amount of fluoride changes how the surface behaves.",
        body,
    )
)
story.append(
    Paragraph(
        "The dentinoenamel junction is a scalloped boundary, not a straight line. That "
        "scalloping increases the surface area of the join and helps distribute load. When "
        "dentists talk about the strength of a bonded restoration, they are often talking "
        "about what happens at this boundary and not only at the outer surface.",
        body,
    )
)
story.append(sub("Dentin: the living middle", "ch1-dentin", "Chapter 01"))
story.append(
    Paragraph(
        "Dentin forms the bulk of the tooth. It is a hydrated composite of collagen and "
        "hydroxyapatite, roughly 70 percent mineral by weight. Its features are the dentinal "
        "tubules: millions of microscopic channels that run from the pulp to the dentinoenamel "
        "junction. The tubules contain odontoblast processes and fluid. When dentin is exposed, "
        "that fluid can move, and movement is what the nerve endings near the pulp detect. This "
        "is the hydrodynamic explanation for sensitivity.",
        body,
    )
)
story.append(
    Paragraph(
        "Dentin comes in primary, secondary, and tertiary forms. Primary dentin is laid down "
        "before the tooth erupts. Secondary dentin forms slowly throughout life and gradually "
        "narrows the pulp chamber. Tertiary dentin is a local response to injury, produced by "
        "the odontoblasts beneath the damaged area. A radiograph that shows a small pulp chamber "
        "in an older patient is often showing a lifetime of secondary dentin.",
        body,
    )
)
story.append(Spacer(1, 8))
story.append(Image(str(TOOTH_FIGURE), width=300, height=192))
story.append(
    Paragraph(
        "Figure 1.1 The layers of a tooth. Enamel covers the crown, dentin forms the "
        "living middle, and the pulp carries the blood supply and nerves.",
        caption,
    )
)
story.append(Spacer(1, 4))
story.append(sub("The pulp: not just a nerve", "ch1-pulp", "Chapter 01"))
story.append(
    Paragraph(
        "The pulp is soft connective tissue inside the pulp chamber and root canals. It "
        "contains vessels, nerves, fibroblasts, and immune cells. It also contains the "
        "odontoblasts that maintain dentin. The pulp is often described as the tooth's alarm "
        "system, but it is also a repair system. Inflammation in a confined space is painful "
        "because there is little room to swell, which is why pulpitis can escalate quickly.",
        body,
    )
)
story.append(
    Paragraph("Remember the sequence", subhead)
)
for line in [
    "• Enamel is mineral-rich and cannot rebuild itself.",
    "• Dentin is living, tubular, and sensitive when exposed.",
    "• The pulp carries the blood supply and the nerve endings.",
    "• The CEJ marks the crown-root boundary; its position is clinically meaningful.",
]:
    story.append(Paragraph(line, bullet))
story.append(PageBreak())

# ---------- chapter 2 ----------
story += heading("02", "The periodontium", "ch2")
story.append(
    Paragraph(
        "A tooth is not glued into the jaw. It is suspended in a living socket by a small "
        "group of tissues that together are called the periodontium: the gingiva, the "
        "periodontal ligament, the cementum, and the alveolar bone. Each is small, and each "
        "matters. Damage to the group is what we call periodontal disease.",
        lede,
    )
)
story.append(sub("Gingiva: the visible border", "ch2-gingiva", "Chapter 02"))
story.append(
    Paragraph(
        "The gingiva is the mucosal tissue that surrounds the tooth and covers the alveolar "
        "bone. The attached gingiva is firm and bound to the underlying periosteum; the free "
        "gingiva forms the collar around the tooth. Between them is the gingival sulcus, a "
        "shallow space whose depth is measured during a periodontal examination. Healthy "
        "gingiva is not simply pink; it is also firm, stippled, and resistant to bleeding on "
        "gentle probing.",
        body,
    )
)
story.append(sub("The periodontal ligament", "ch2-pdl", "Chapter 02"))
story.append(
    Paragraph(
        "The periodontal ligament is a thin layer of fibrous connective tissue between the "
        "cementum and the alveolar bone. It is only about 0.2 mm wide, but it does three large "
        "jobs. It attaches the tooth to bone, it cushions occlusal forces, and it carries "
        "sensory information about pressure. Its principal fibers are arranged in groups that "
        "resist different directions of force: the crestal fibers resist tilting, the oblique "
        "fibers resist vertical loading, and the apical fibers resist extraction forces.",
        body,
    )
)
story.append(
    Paragraph(
        "The ligament is also the reason a tooth can move orthodontically. Sustained pressure "
        "creates a region of compression and a region of tension. Bone is removed on the "
        "compressed side and added on the tension side. That is not a passive mechanical "
        "process; it is a biological remodeling process with a blood supply and a cellular "
        "response. This is why orthodontic movement needs healthy supporting tissues.",
        body,
    )
)
story.append(sub("Cementum and alveolar bone", "ch2-bone", "Chapter 02"))
story.append(
    Paragraph(
        "Cementum covers the root. It is similar to bone in its mineral content but lacks "
        "Haversian systems and does not remodel in the same way. Its incremental lines record "
        "episodes of deposition across a lifetime. The alveolar bone is the part of the jaw "
        "that forms the socket. It is constantly remodeling and responds to the presence or "
        "absence of a functioning tooth: without stimulation, it resorbs.",
        body,
    )
)
story.append(
    Paragraph(
        "A clinically useful way to think about the periodontium is as a suspension system. "
        "The tooth is the mass, the ligament is the spring, and the bone is the frame. Disease "
        "can attack the spring, the frame, or the seal. A periapical problem and a periodontal "
        "problem can produce pain in the same region, but they are not the same disease.",
        body,
    )
)
story.append(Paragraph("Check your mental model", subhead))
for line in [
    "• What are the four tissues of the periodontium?",
    "• Why can a tooth move under orthodontic force without being extracted?",
    "• What is the difference between the gingival sulcus and a periodontal pocket?",
]:
    story.append(Paragraph(line, bullet))
story.append(PageBreak())

# ---------- chapter 3 ----------
story += heading("03", "Naming and numbering teeth", "ch3")
story.append(
    Paragraph(
        "Dentistry runs on names and numbers. A clear system prevents a conversation about "
        "tooth 26 from becoming a conversation about two different teeth. The two systems you "
        "will meet most often are the FDI system, which is international, and the Universal "
        "system, which is common in the United States.",
        lede,
    )
)
story.append(sub("Four dentitions, one mouth", "ch3-dentitions", "Chapter 03"))
story.append(
    Paragraph(
        "Humans have a primary dentition, a mixed dentition, and a permanent dentition. The "
        "primary dentition has 20 teeth: two incisors, one canine, and two molars per quadrant. "
        "The permanent dentition has 32 teeth when all third molars are present: two incisors, "
        "one canine, two premolars, and three molars per quadrant. The mixed dentition is the "
        "transition period in which both are present.",
        body,
    )
)
story.append(sub("FDI and Universal", "ch3-systems", "Chapter 03"))
story.append(
    Paragraph(
        "FDI numbering uses two digits. The first digit identifies the quadrant, and the "
        "second identifies the tooth within that quadrant. Permanent quadrants are numbered 1 "
        "to 4; primary quadrants are 5 to 8. Universal numbering uses a single number from 1 "
        "to 32 for permanent teeth, beginning with the maxillary right third molar and moving "
        "around the arch, then continuing with the mandibular teeth. Primary teeth use letters "
        "A through T.",
        body,
    )
)
story.append(Paragraph("A quick comparison", subhead))
for line in [
    "• FDI 11 is the maxillary right central incisor.",
    "• Universal 8 is the maxillary right central incisor.",
    "• FDI 36 is the mandibular left first molar.",
    "• Universal 19 is the mandibular left first molar.",
]:
    story.append(Paragraph(line, bullet))
story.append(sub("Morphology in one pass", "ch3-morph", "Chapter 03"))
story.append(
    Paragraph(
        "Incisors are adapted for cutting. They have a relatively thin incisal edge and a "
        "single root. Canines are adapted for tearing and for guiding the jaw; they have a "
        "prominent cusp and a long root. Premolars are transitional teeth, with two cusps in "
        "the first maxillary premolar and usually two in the second. Molars are the grinding "
        "teeth, with a broader occlusal table and multiple roots.",
        body,
    )
)
story.append(
    Paragraph(
        "Every general rule has exceptions. The maxillary first molar typically has three "
        "roots, while the mandibular first molar typically has two. The maxillary first "
        "premolar usually has two roots, which is one reason it can be a difficult extraction. "
        "Learning morphology is not learning a list of roots; it is learning to predict what "
        "you will see before you see it.",
        body,
    )
)
story.append(PageBreak())

# ---------- chapter 4 ----------
story += heading("04", "Occlusion and contact", "ch4")
story.append(
    Paragraph(
        "Occlusion is the relationship between the teeth when the jaws close. It is both a "
        "static arrangement and a dynamic event. A bite that looks acceptable on a model can "
        "still be uncomfortable in a patient if the contacts do not guide forces sensibly.",
        lede,
    )
)
story.append(sub("Centric occlusion and maximum intercuspation", "ch4-co", "Chapter 04"))
story.append(
    Paragraph(
        "Maximum intercuspation is the position in which the teeth have the greatest contact. "
        "Centric occlusion is a term used for the occlusion of the teeth when the condyles are "
        "in a particular seated position. In many people these coincide; in others they do not. "
        "The difference matters when you are planning a restoration or looking for a premature "
        "contact.",
        body,
    )
)
story.append(sub("Overjet, overbite, and guidance", "ch4-guide", "Chapter 04"))
story.append(
    Paragraph(
        "Overjet is horizontal overlap; overbite is vertical overlap. An increased overjet can "
        "predispose to trauma. A deep overbite can load the palatal gingiva or the incisors. "
        "During lateral movements, the canines often guide the jaw apart, protecting the "
        "posterior teeth from horizontal forces. This is canine guidance. Group function is a "
        "different pattern in which several teeth share the load.",
        body,
    )
)
story.append(
    Paragraph(
        "The curve of Spee describes the anteroposterior curvature of the occlusal plane; the "
        "curve of Wilson describes the mediolateral curvature. These are not decorative "
        "geometry. They help explain how forces travel through the arch and why restoring a "
        "single tooth to the wrong height can change several contacts.",
        body,
    )
)
story.append(PageBreak())

# ---------- chapter 5 ----------
story += heading("05", "Eruption and the mixed dentition", "ch5")
story.append(
    Paragraph(
        "Eruption is a journey through bone and soft tissue, not a single event. The tooth "
        "moves, the root lengthens, the bone remodels, and the surrounding tissues change. "
        "Knowing the usual sequence helps you recognise when something is early, late, or "
        "simply different.",
        lede,
    )
)
story.append(sub("The primary years", "ch5-primary", "Chapter 05"))
story.append(
    Paragraph(
        "Primary teeth usually begin to erupt around six months of age, starting with the "
        "mandibular central incisors. Most children have a full primary dentition by about "
        "two and a half to three years. The primary molars are not miniature permanent "
        "molars: their enamel is thinner, their pulp is proportionally larger, and their "
        "roots are more flared to make room for the developing permanent tooth beneath them.",
        body,
    )
)
story.append(sub("The exchange", "ch5-exchange", "Chapter 05"))
story.append(
    Paragraph(
        "The mixed dentition begins around six years with the eruption of the first permanent "
        "molars and the loss of the primary central incisors. It ends in the early teens, when "
        "the last primary tooth is shed. The leeway space is the difference in size between the "
        "primary canine and molars and their permanent successors. It gives the permanent "
        "dentition room to settle into a stable arch.",
        body,
    )
)
story.append(
    Paragraph(
        "Not every delay is a problem. Eruption timing varies with genetics, nutrition, and "
        "local factors. But a significant asymmetry, a retained primary tooth with no "
        "successor visible, or a tooth that fails to erupt after its root is complete deserves "
        "a closer look. The question is not only 'when?' but 'why?'.",
        body,
    )
)
story.append(PageBreak())

# ---------- chapter 6 ----------
story += heading("06", "When development goes off-script", "ch6")
story.append(
    Paragraph(
        "Developmental anomalies are not rare curiosities. They change the shape of a tooth, "
        "the number of teeth, or the timing of eruption, and each change can affect hygiene, "
        "occlusion, and treatment planning. The useful skill is to recognise the pattern "
        "before you reach for a bur.",
        lede,
    )
)
story.append(sub("Shape and number", "ch6-shape", "Chapter 06"))
story.append(
    Paragraph(
        "Gemination is an attempt by a single tooth germ to divide, producing a partially "
        "cleft crown but usually a single root and pulp. Fusion is the union of two separate "
        "germs; the result may have one fewer tooth in the arch. Dens invaginatus is an "
        "infolding of enamel and dentin into the pulp, most often in a maxillary lateral "
        "incisor. Taurodontism is an enlarged pulp chamber with apically displaced furcation, "
        "more common in certain syndromes but also seen in isolated teeth.",
        body,
    )
)
story.append(
    Paragraph(
        "Supernumerary teeth are extra teeth, most often a mesiodens between the maxillary "
        "central incisors. Hypodontia is the absence of one or more teeth, most often the "
        "third molars, second premolars, or maxillary lateral incisors. A retained primary "
        "tooth can be the first clue to a missing permanent successor.",
        body,
    )
)
story.append(sub("Enamel defects", "ch6-enamel", "Chapter 06"))
story.append(
    Paragraph(
        "Enamel hypoplasia is a quantitative defect: less enamel than expected. It can appear "
        "as pits, grooves, or a missing band, depending on when the disturbance occurred. "
        "Fluorosis is a qualitative defect associated with excessive fluoride during "
        "development, ranging from faint white lines to marked opacity. Molar-incisor "
        "hypomineralisation affects specific teeth with soft, porous enamel and often produces "
        "rapid breakdown after eruption.",
        body,
    )
)
story.append(
    Paragraph(
        "An anomaly is a piece of history written in a tooth. The location and pattern tell "
        "you when something happened; the clinical behaviour tells you what to do next. Before "
        "you plan a restoration, ask whether the problem is shape, number, structure, or "
        "position. The answer changes the treatment.",
        body,
    )
)
story.append(Spacer(1, 14))
story.append(
    Paragraph(
        "End of sample · Cove",
        ParagraphStyle(
            "end",
            fontName=FONT_SANS,
            fontSize=7.5,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    )
)

doc = SampleDoc(
    str(OUT),
    pagesize=A5,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=MARGIN,
    bottomMargin=18 * mm,
    title="The Anatomy of a Tooth — A Guided Sample",
    author="Cove Sample Library",
    subject="A synthetic dental anatomy reading sample for testing Cove.",
)

frame = Frame(
    MARGIN,
    18 * mm,
    PAGE_W - 2 * MARGIN,
    PAGE_H - MARGIN - 18 * mm,
    id="body",
    leftPadding=0,
    rightPadding=0,
    topPadding=0,
    bottomPadding=0,
)

doc.addPageTemplates(
    [
        PageTemplate(
            id="cover",
            frames=[Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)],
            onPage=cover,
            autoNextPageTemplate="body",
        ),
        PageTemplate(id="body", frames=[frame], onPage=doc.on_page),
    ]
)

doc.build([PageBreak()] + story)
print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
