"""Tests for internal link parsing, rewriting, and attachment reference extraction."""

from app.core.links import (
    extract_attachment_paths,
    extract_internal_links,
    rewrite_link_target,
)


def test_extract_internal_links():
    markdown = """
    Check out [[Cybersecurity]] for the overview.
    Also read [[BLE Security#Pairing Models]] and [[node_crypto_123|Cryptographic Primitives]].
    Here is an attachment: ![Diagram](attachments/images/diagram.png)
    """
    links = extract_internal_links(markdown)
    assert len(links) == 3

    assert links[0].target == "Cybersecurity"
    assert links[0].heading is None
    assert links[0].display is None

    assert links[1].target == "BLE Security"
    assert links[1].heading == "Pairing Models"
    assert links[1].display is None

    assert links[2].target == "node_crypto_123"
    assert links[2].heading is None
    assert links[2].display == "Cryptographic Primitives"


def test_extract_attachment_paths():
    markdown = """
    ![Architecture](attachments/images/arch.png)
    [Read Spec](attachments/documents/spec.pdf)
    """
    paths = extract_attachment_paths(markdown)
    assert "attachments/images/arch.png" in paths
    assert "attachments/documents/spec.pdf" in paths


def test_rewrite_link_target():
    markdown = "Refer to [[Old Security Guide]] and [[Old Security Guide#Section 2|Guide Link]]."
    rewritten = rewrite_link_target(markdown, "Old Security Guide", "New Security Framework")
    
    assert rewritten == "Refer to [[New Security Framework]] and [[New Security Framework#Section 2|Guide Link]]."
