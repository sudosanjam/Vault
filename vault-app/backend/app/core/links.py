"""Internal link parser, resolver, and rewriter."""

import re
from typing import List, NamedTuple, Optional, Set


class ParsedLink(NamedTuple):
    raw: str
    target: str  # Note title, alias, or ID
    heading: Optional[str]  # Optional heading anchor #Heading
    display: Optional[str]  # Optional display text |Custom Text
    start: int
    end: int


# Pattern matches:
# [[Note Title]]
# [[Note Title#Heading Anchor]]
# [[Note Title|Custom Display Text]]
# [[Note Title#Heading Anchor|Custom Display Text]]
WIKILINK_REGEX = re.compile(r"\[\[([^\]\|#\r\n]+)(?:#([^\]\|]+))?(?:\|([^\]\r\n]+))?\]\]")

# Pattern matches attachment references:
# ![alt](attachments/images/foo.png) or [alt](attachments/docs/bar.pdf)
ATTACHMENT_REGEX = re.compile(r"!{0,1}\[[^\]]*\]\(((?:attachments/[^)]+))\)")


def extract_internal_links(text: str) -> List[ParsedLink]:
    """Extract all [[wikilinks]] from markdown body."""
    links = []
    for match in WIKILINK_REGEX.finditer(text):
        raw = match.group(0)
        target = match.group(1).strip()
        heading = match.group(2).strip() if match.group(2) else None
        display = match.group(3).strip() if match.group(3) else None
        links.append(
            ParsedLink(
                raw=raw,
                target=target,
                heading=heading,
                display=display,
                start=match.start(),
                end=match.end(),
            )
        )
    return links


def extract_attachment_paths(text: str) -> Set[str]:
    """Extract relative attachment paths referenced in markdown."""
    paths = set()
    for match in ATTACHMENT_REGEX.finditer(text):
        path = match.group(1).strip()
        paths.add(path)
    return paths


def rewrite_link_target(text: str, old_title: str, new_title: str) -> str:
    """
    Rewrite internal links when a note is renamed.
    Example: [[Old Title]] -> [[New Title]]
             [[Old Title#Section|Label]] -> [[New Title#Section|Label]]
    """
    def _replacer(m: re.Match) -> str:
        target = m.group(1).strip()
        if target.lower() == old_title.lower():
            heading = f"#{m.group(2).strip()}" if m.group(2) else ""
            display = f"|{m.group(3).strip()}" if m.group(3) else ""
            return f"[[{new_title}{heading}{display}]]"
        return m.group(0)

    return WIKILINK_REGEX.sub(_replacer, text)


def build_link_markdown(target: str, heading: Optional[str] = None, display: Optional[str] = None) -> str:
    """Construct a [[wikilink]] string."""
    h = f"#{heading.strip()}" if heading else ""
    d = f"|{display.strip()}" if display else ""
    return f"[[{target.strip()}{h}{d}]]"
