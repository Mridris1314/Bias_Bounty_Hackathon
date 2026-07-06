"""ReportLab-based audit PDF renderer."""
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)


NAVY = colors.HexColor("#0A0E1A")
SURFACE = colors.HexColor("#131829")
VIOLET = colors.HexColor("#7C5CFC")
MUTED = colors.HexColor("#5F6982")
DANGER = colors.HexColor("#FF4757")
WARN = colors.HexColor("#FFB800")
OK = colors.HexColor("#00E5A0")
BORDER = colors.HexColor("#232A3F")

SEVERITY_COLOR = {
    "critical": DANGER,
    "high": DANGER,
    "medium": WARN,
    "low": OK,
    "info": MUTED,
}


def _styles():
    base = getSampleStyleSheet()
    return {
        "H1": ParagraphStyle(
            "H1", parent=base["Heading1"],
            fontName="Helvetica-Bold", fontSize=22,
            textColor=NAVY, spaceAfter=8, alignment=TA_LEFT,
        ),
        "H2": ParagraphStyle(
            "H2", parent=base["Heading2"],
            fontName="Helvetica-Bold", fontSize=13,
            textColor=NAVY, spaceBefore=14, spaceAfter=6,
        ),
        "H3": ParagraphStyle(
            "H3", parent=base["Heading3"],
            fontName="Helvetica-Bold", fontSize=11,
            textColor=NAVY, spaceBefore=8, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"],
            fontName="Helvetica", fontSize=9.5, leading=13,
            textColor=colors.HexColor("#1a1f2e"),
        ),
        "muted": ParagraphStyle(
            "muted", parent=base["BodyText"],
            fontName="Helvetica", fontSize=8.5, leading=12,
            textColor=MUTED,
        ),
        "code": ParagraphStyle(
            "code", parent=base["Code"],
            fontName="Courier", fontSize=8, leading=11,
            textColor=colors.HexColor("#2a3040"),
        ),
    }


def render_pdf(report: dict[str, Any], run_name: str, target_model: str) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"BiasBounty Audit — {run_name}",
    )
    S = _styles()
    flow = []

    # Header band
    flow.append(Paragraph("BIASBOUNTY", ParagraphStyle(
        "brand", parent=S["muted"],
        fontName="Helvetica-Bold", fontSize=9,
        textColor=VIOLET, letterSpacing=2,
    )))
    flow.append(Paragraph(f"Audit Report — {run_name}", S["H1"]))
    flow.append(Paragraph(
        f"Target model: <b>{target_model}</b> &nbsp; · &nbsp; "
        f"Generated: {report.get('generated_at', datetime.utcnow().isoformat())} &nbsp; · &nbsp; "
        f"Prompts run: {report.get('prompts_run', '?')}",
        S["muted"],
    ))
    flow.append(Spacer(1, 10))

    # Verdict card
    score = report.get("overall_score", 0)
    grade = report.get("grade", "?")
    verdict_data = [[
        Paragraph(f"<b>Overall score</b><br/><font size=24>{score:.0f}</font>/100", S["body"]),
        Paragraph(f"<b>Grade</b><br/><font size=24>{grade}</font>", S["body"]),
        Paragraph(f"<b>Findings</b><br/><font size=24>{len(report.get('findings', []))}</font>", S["body"]),
    ]]
    verdict = Table(verdict_data, colWidths=[60 * mm, 45 * mm, 45 * mm])
    verdict.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F6FA")),
        ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    flow.append(verdict)
    flow.append(Spacer(1, 14))

    # Executive summary
    flow.append(Paragraph("Executive Summary", S["H2"]))
    flow.append(Paragraph(
        report.get("executive_summary", "No summary generated."),
        S["body"],
    ))

    # Metrics matrix
    matrix = report.get("metrics_matrix", {})
    if matrix:
        flow.append(Paragraph("Bias Metrics", S["H2"]))
        header = ["Dimension", "Parity gap", "Sentiment Δ", "Refusal skew", "Stereotype"]
        rows = [header]
        for dim, m in matrix.items():
            rows.append([
                dim.capitalize(),
                f"{m.get('parity_gap', 0):.3f}",
                f"{m.get('sentiment_delta', 0):.3f}",
                f"{m.get('refusal_skew', 0):.3f}",
                f"{m.get('stereotype_score', 0):.3f}",
            ])
        t = Table(rows, colWidths=[35 * mm, 30 * mm, 30 * mm, 30 * mm, 30 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Courier"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FB")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        flow.append(t)

    # Findings
    findings = report.get("findings", [])
    if findings:
        flow.append(PageBreak())
        flow.append(Paragraph("Findings", S["H2"]))
        for f in findings:
            sev = str(f.get("severity", "info")).lower()
            sev_color = SEVERITY_COLOR.get(sev, MUTED)
            flow.append(Paragraph(
                f'<font color="{sev_color.hexval()}"><b>[{sev.upper()}]</b></font> '
                f'{f.get("title", "Finding")}',
                S["H3"],
            ))
            flow.append(Paragraph(f.get("summary", ""), S["body"]))

            # Regulations
            regs = f.get("regulations", [])
            if regs:
                flow.append(Paragraph("<b>Applicable regulations:</b>", S["muted"]))
                for r in regs[:4]:
                    flow.append(Paragraph(
                        f"• <b>{r.get('jurisdiction', '?')}</b> — {r.get('regulation', '?')}, "
                        f"{r.get('clause', '?')}: {r.get('excerpt', '')[:280]}…",
                        S["muted"],
                    ))

            # Recommendation
            rec = f.get("recommendation")
            if rec:
                flow.append(Paragraph(f"<b>Recommendation:</b> {rec}", S["body"]))
            flow.append(Spacer(1, 8))

    # Top actions
    actions = report.get("top_actions", [])
    if actions:
        flow.append(Paragraph("Top Actions", S["H2"]))
        for i, a in enumerate(actions, 1):
            flow.append(Paragraph(f"{i}. {a}", S["body"]))

    # Auto-remediation snippet
    snippet = report.get("remediation_snippet")
    if snippet:
        flow.append(Spacer(1, 10))
        flow.append(Paragraph("Auto-Remediation — System Prompt Patch", S["H2"]))
        flow.append(Paragraph(
            "Prepend this to the target model's system prompt to mitigate the "
            "specific disparities surfaced in this audit. Re-run the audit "
            "afterward to verify.",
            S["muted"],
        ))
        flow.append(Spacer(1, 4))
        # Render as a monospaced boxed block
        snippet_esc = (snippet
                       .replace("&", "&amp;")
                       .replace("<", "&lt;")
                       .replace(">", "&gt;")
                       .replace("\n", "<br/>"))
        code_tbl = Table(
            [[Paragraph(f'<font face="Courier" size=8>{snippet_esc}</font>', S["body"])]],
            colWidths=[170 * mm],
        )
        code_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F6FA")),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        flow.append(code_tbl)

    doc.build(flow)
    return buf.getvalue()
