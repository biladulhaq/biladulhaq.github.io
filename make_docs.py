"""
make_docs.py — Ammunition layer.

Renders an ATS-friendly CV and a matched cover letter as PDFs from a single
JSON "tailoring" file. The daily pipeline writes that JSON per shortlisted job
(rewritten summary, reordered bullets, keyword-mirrored skills), then calls:

    python make_docs.py <tailoring.json> <output_dir>

Produces:  <output_dir>/CV_<Company>.pdf  and  <output_dir>/CoverLetter_<Company>.pdf

The base profile is embedded below so the CV is always complete even if the
tailoring JSON only overrides a few fields. Design mirrors the candidate's
existing single-column, ATS-parseable layout (no tables, no columns, no images).
"""

import json
import re
import sys
from pathlib import Path

from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, ListFlowable, ListItem,
)

# --- BASE PROFILE (source of truth; tailoring JSON overrides summary/order) ---
BASE = {
    "name": "MUHAMMAD BILAD UL HAQ",
    "headline": "IT Support Specialist  |  Software Deployment & License Management",
    "contact": "bilad900@gmail.com  |  +966 56 277 5409  |  Dammam, Eastern Province, Saudi Arabia",
    "contact2": "linkedin.com/in/bilad-ul-haq-8737a3341  |  biladulhaq.github.io  |  Transferable Iqama",
    "summary": (
        "IT Support Specialist with 3+ years of experience in IT support, software "
        "deployment, and software license management, currently supervising IT "
        "support staff on a Sinopec Petroleum site. Skilled in Microsoft 365 and "
        "Active Directory administration, software asset management, and full IT "
        "asset lifecycle tracking, with a track record of troubleshooting hardware "
        "and software issues during rollout and deployment in large, security-"
        "controlled enterprise environments."
    ),
    "experience": [
        {
            "title": "IT Supervisor",
            "org": "EFFC — Supporting Sinopec Petroleum Branch  |  Haradh, Eastern Province, Saudi Arabia",
            "dates": "Jan 2025 – Present",
            "bullets": [
                "Supervise IT support staff and act as the bridge between senior management and the IT team.",
                "Perform software license activation, installation, configuration, and testing across Windows 10/11 endpoints and Windows Server systems.",
                "Administer Microsoft 365 licensing — assigning, reclaiming, and reconciling user licenses to keep usage within purchased licenses and agreements.",
                "Deploy and configure software to company IT standards and contractual agreements; ensure compliance with software policies and processes.",
                "Troubleshoot hardware and software issues during software rollout and deployment, minimising end-user downtime.",
                "Identify licensing compliance risks — unlicensed installs, over-allocation, expiring subscriptions — and recommend mitigation.",
                "Maintain the IT software and hardware asset register — asset tagging, license records, and technical documentation.",
                "Administer Active Directory — user provisioning, group policy, access control, and full account lifecycle management.",
                "Support and troubleshoot LAN/WAN infrastructure including routers, switches, and connectivity.",
                "Educate and transfer knowledge to project team members on software deployment, installation, and configuration.",
                "Maintain data confidentiality under site industrial security and work-permit protocols.",
            ],
        },
        {
            "title": "IT Specialist",
            "org": "Abacus Consulting International Organization  |  Pakistan / Remote",
            "dates": "Dec 2022 – Jan 2025",
            "bullets": [
                "Delivered Tier 1/2 end-user support for hardware, software, and peripherals, resolving incidents within agreed SLA targets.",
                "Provided full Microsoft 365 support — account and license configuration, mailbox setup, and issue resolution.",
                "Administered Active Directory for provisioning, access control, group policy, and account lifecycle management.",
                "Logged, tracked, and resolved incidents through ITSM ticketing aligned to ITIL practices, maintaining SLA compliance.",
                "Maintained accurate IT asset and software installation records through structured asset tagging and inventory.",
                "Managed and troubleshot routers and switches to maintain stable, secure LAN/WAN connectivity.",
            ],
        },
    ],
    "skills": [
        ("Software Deployment & Licensing", "Installation, Configuration & Testing, Enterprise Deployment & Rollout, License Activation, Software License Compliance, Software Asset Management (SAM), Microsoft 365 Licensing, Subscription Tracking, Procurement Support"),
        ("Operating Systems & Platforms", "Windows Server, Windows 10/11, Active Directory, Microsoft 365, Hyper-V, VMware"),
        ("IT Support", "Hardware & Software Troubleshooting, End-User Support (Tier 1/2), Endpoint Configuration, Remote Desktop Support, Application Support"),
        ("Networking", "LAN/WAN, Routing & Switching, DHCP, DNS, TCP/IP, Network Security, Proxy Server"),
        ("Endpoint Management", "Microsoft Intune (basic), Microsoft Endpoint Configuration Manager / SCCM (basic)"),
        ("Tools & Processes", "ServiceNow, Jira Service Management (basic), ITSM / Ticketing Systems, ITIL-Aligned Incident & Service Management, CMD & PowerShell Scripting, IT Asset Inventory, Performance Monitoring, Technical Documentation"),
    ],
    "education": [
        "Bachelor of Science in Information Technology — University of the Punjab (Major: Networking & Programming)",
        "CompTIA A+ — In Progress",
    ],
    "languages": "English: Professional / Bilingual  •  Urdu: Native  •  Arabic: Conversational (improving)",
}

INK = HexColor("#1a1a1a")
ACCENT = HexColor("#1a1a1a")
RULE = HexColor("#1a1a1a")


def styles():
    return {
        "name": ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=17,
                               alignment=TA_CENTER, textColor=INK, spaceAfter=2, leading=20),
        "headline": ParagraphStyle("headline", fontName="Helvetica-Bold", fontSize=9.5,
                                   alignment=TA_CENTER, textColor=ACCENT, spaceAfter=2, leading=12),
        "contact": ParagraphStyle("contact", fontName="Helvetica", fontSize=8.5,
                                  alignment=TA_CENTER, textColor=INK, leading=11),
        "section": ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=10.5,
                                  textColor=ACCENT, spaceBefore=9, spaceAfter=3, leading=13),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9,
                              textColor=INK, alignment=TA_JUSTIFY, leading=12.5),
        "jobtitle": ParagraphStyle("jobtitle", fontName="Helvetica-Bold", fontSize=9.5,
                                   textColor=INK, leading=12),
        "org": ParagraphStyle("org", fontName="Helvetica-Oblique", fontSize=8.5,
                             textColor=INK, leading=11, spaceAfter=2),
        "bullet": ParagraphStyle("bullet", fontName="Helvetica", fontSize=8.8,
                                textColor=INK, alignment=TA_JUSTIFY, leading=11.8),
        "cl": ParagraphStyle("cl", fontName="Helvetica", fontSize=10,
                           textColor=INK, alignment=TA_JUSTIFY, leading=15, spaceAfter=9),
    }


def rule():
    return HRFlowable(width="100%", thickness=0.8, color=RULE, spaceBefore=1, spaceAfter=3)


def job_header(title, dates, st):
    # title left, dates right — done with a two-cell paragraph trick via tab stops
    return Paragraph(
        f'<b>{title}</b><font color="#555555"> &nbsp;—&nbsp; {dates}</font>', st["jobtitle"]
    )


def build_cv(data, out_path):
    st = styles()
    doc = SimpleDocTemplate(str(out_path), pagesize=A4,
                            leftMargin=16*mm, rightMargin=16*mm,
                            topMargin=13*mm, bottomMargin=13*mm)
    e = []
    e.append(Paragraph(data["name"], st["name"]))
    e.append(Paragraph(data["headline"], st["headline"]))
    e.append(Paragraph(data["contact"], st["contact"]))
    e.append(Paragraph(data["contact2"], st["contact"]))
    e.append(Spacer(1, 4))

    e.append(Paragraph("PROFESSIONAL SUMMARY", st["section"]))
    e.append(rule())
    e.append(Paragraph(data["summary"], st["body"]))

    e.append(Paragraph("PROFESSIONAL EXPERIENCE", st["section"]))
    e.append(rule())
    for job in data["experience"]:
        e.append(job_header(job["title"], job["dates"], st))
        e.append(Paragraph(job["org"], st["org"]))
        items = [ListItem(Paragraph(b, st["bullet"]), leftIndent=6) for b in job["bullets"]]
        e.append(ListFlowable(items, bulletType="bullet", start="•",
                              bulletFontSize=7, leftIndent=10, spaceBefore=1, spaceAfter=4))

    e.append(Paragraph("TECHNICAL SKILLS", st["section"]))
    e.append(rule())
    for label, val in data["skills"]:
        e.append(Paragraph(f"<b>{label}:</b> {val}", st["bullet"]))
        e.append(Spacer(1, 1.5))

    e.append(Paragraph("EDUCATION & CERTIFICATIONS", st["section"]))
    e.append(rule())
    for ed in data["education"]:
        e.append(Paragraph(f"• {ed}", st["bullet"]))

    e.append(Paragraph("LANGUAGES", st["section"]))
    e.append(rule())
    e.append(Paragraph(data["languages"], st["bullet"]))

    doc.build(e)


def build_cover_letter(cl, out_path):
    """cl: dict with company, role, date, salutation, paragraphs[list], signoff."""
    st = styles()
    doc = SimpleDocTemplate(str(out_path), pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    e = []
    e.append(Paragraph(BASE["name"], st["name"]))
    e.append(Paragraph(BASE["headline"], st["headline"]))
    e.append(Paragraph(BASE["contact"], st["contact"]))
    e.append(Spacer(1, 10))
    if cl.get("date"):
        e.append(Paragraph(cl["date"], st["cl"]))
    head = cl.get("company", "")
    if cl.get("role"):
        head = f"Re: Application for {cl['role']} — {head}"
    e.append(Paragraph(f"<b>{head}</b>", st["cl"]))
    e.append(Paragraph(cl.get("salutation", "Dear Hiring Manager,"), st["cl"]))
    for para in cl.get("paragraphs", []):
        e.append(Paragraph(para, st["cl"]))
    e.append(Spacer(1, 6))
    e.append(Paragraph(cl.get("signoff", "Sincerely,"), st["cl"]))
    e.append(Paragraph(f"<b>{BASE['name'].title()}</b>", st["cl"]))
    doc.build(e)


def merge(base, override):
    out = json.loads(json.dumps(base))
    for k, v in override.items():
        out[k] = v
    return out


def safe(name):
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")[:40] or "Company"


def main():
    if len(sys.argv) < 3:
        sys.exit("Usage: python make_docs.py <tailoring.json> <output_dir>")
    tailoring = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_dir = Path(sys.argv[2]); out_dir.mkdir(parents=True, exist_ok=True)
    company = safe(tailoring.get("cover_letter", {}).get("company", "Company"))

    cv_data = merge(BASE, tailoring.get("cv", {}))
    cv_path = out_dir / f"CV_{company}.pdf"
    build_cv(cv_data, cv_path)

    cl_path = out_dir / f"CoverLetter_{company}.pdf"
    build_cover_letter(tailoring.get("cover_letter", {}), cl_path)
    print(f"Wrote:\n  {cv_path}\n  {cl_path}")


if __name__ == "__main__":
    main()
