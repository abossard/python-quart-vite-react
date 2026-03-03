"""
Guidelines Loader Service

Loads KBA guidelines from markdown files in docs/kba_guidelines/
Provides auto-detection based on ticket categorization.

Following "Grokking Simplicity":
- Pure calculations: Category detection, mapping logic
- Actions: File I/O (reading .md files)
- Clear separation between loading and category detection

Example usage:
    loader = GuidelinesLoader()
    
    # Load system guidelines (always loaded)
    system_context = loader.load_system_guidelines()
    
    # Load specific category guideline
    vpn_content = loader.load_guideline("VPN", subdir="categories")
    
    # Auto-detect from ticket
    ticket = get_ticket(...)
    categories = loader.detect_categories_from_ticket(ticket)
    guidelines = loader.get_combined(categories)
    
    # Full context: system + categories
    full_context = loader.get_full_context(ticket)
"""

import logging
import re
from pathlib import Path
from typing import Optional

from tickets import Ticket

logger = logging.getLogger(__name__)


class GuidelinesLoader:
    """Load and manage KBA guidelines from markdown files"""
    
    # Category mapping: Tier1 -> Tier2 -> Guideline file (without .md)
    CATEGORY_MAP = {
        "Network Access": {
            "VPN": "VPN",
            "WiFi": "NETWORK",
            "LAN": "NETWORK",
            "Remote Access": "VPN",
        },
        "Security": {
            "Password Reset": "PASSWORD_RESET",
            "Account Locked": "PASSWORD_RESET",
            "Account Management": "PASSWORD_RESET",
        },
        "Network": {
            "Internet": "NETWORK",
            "WLAN": "NETWORK",
            "Ethernet": "NETWORK",
            "DNS": "NETWORK",
        },
        # Add more mappings as needed
    }
    
    def __init__(self, guidelines_dir: Path | str = None):
        """
        Initialize guidelines loader
        
        Args:
            guidelines_dir: Path to directory containing guideline .md files
        """
        if guidelines_dir is None:
            # Default: resolve relative to backend directory
            backend_dir = Path(__file__).parent
            guidelines_dir = backend_dir.parent / "docs" / "kba_guidelines"
        
        self.guidelines_dir = Path(guidelines_dir)
        self.system_dir = self.guidelines_dir / "system"
        self.categories_dir = self.guidelines_dir / "categories"
        
        if not self.guidelines_dir.exists():
            logger.error(f"Guidelines directory not found: {self.guidelines_dir}")
            raise FileNotFoundError(
                f"Guidelines directory not found: {self.guidelines_dir}"
            )
        
        logger.info(f"GuidelinesLoader initialized with directory: {self.guidelines_dir}")
    
    def _parse_frontmatter(self, content: str) -> tuple[dict, str]:
        """
        Extract YAML frontmatter from markdown content
        
        Args:
            content: Raw markdown content
            
        Returns:
            Tuple of (frontmatter_dict, content_without_frontmatter)
        """
        # Match YAML frontmatter: ---\n...yaml...\n---\n
        frontmatter_pattern = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
        match = frontmatter_pattern.match(content)
        
        if not match:
            return {}, content
        
        yaml_content = match.group(1)
        content_without_frontmatter = content[match.end():]
        
        # Simple YAML parsing (key: value pairs only)
        frontmatter = {}
        for line in yaml_content.split('\n'):
            line = line.strip()
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()
                
                # Parse boolean values
                if value.lower() in ('true', 'yes', 'on'):
                    value = True
                elif value.lower() in ('false', 'no', 'off'):
                    value = False
                # Parse numbers
                elif value.replace('.', '', 1).isdigit():
                    value = float(value) if '.' in value else int(value)
                
                frontmatter[key] = value
        
        return frontmatter, content_without_frontmatter
    
    def load_guideline(self, category: str, subdir: str = "categories") -> Optional[str]:
        """
        Load guideline content from .md file
        
        Args:
            category: Category name (e.g., "VPN", "GENERAL")
            subdir: Subdirectory ("system" or "categories")
            
        Returns:
            Guideline content as string (without frontmatter), or None if not found
        """
        filename = f"{category.upper()}.md"
        
        if subdir == "system":
            # System guidelines are numbered, so search by pattern
            pattern = f"*{category}*.md"
            matches = list(self.system_dir.glob(pattern))
            filepath = matches[0] if matches else self.system_dir / filename
        else:
            filepath = self.categories_dir / filename
        
        if not filepath.exists():
            logger.warning(f"Guideline not found: {filepath}")
            return None
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                raw_content = f.read()
            
            frontmatter, content = self._parse_frontmatter(raw_content)
            
            # Check if guideline is enabled
            if frontmatter.get('enabled', True) is False:
                logger.info(f"Guideline {filename} is disabled (enabled=false)")
                return None
            
            logger.debug(
                f"Loaded guideline: {filename}",
                extra={
                    "category": category,
                    "length": len(content),
                    "frontmatter": frontmatter
                }
            )
            return content
            
        except Exception as e:
            logger.error(f"Failed to load guideline {filename}: {e}")
            return None
    
    def list_available(self, subdir: str = "categories") -> list[str]:
        """
        List all available guideline categories
        
        Args:
            subdir: Subdirectory to scan ("system" or "categories")
        
        Returns:
            List of category names (without .md extension)
        """
        target_dir = self.system_dir if subdir == "system" else self.categories_dir
        
        if not target_dir.exists():
            logger.warning(f"Directory not found: {target_dir}")
            return []
        
        categories = [
            f.stem for f in target_dir.glob("*.md")
            if f.stem.upper() != "README"
        ]
        
        logger.debug(f"Available guidelines in {subdir}: {categories}")
        return categories
    
    def load_system_guidelines(self) -> str:
        """
        Load all system guidelines (from system/ directory) in alphabetical order
        
        System guidelines are always loaded and provide base context for KBA generation.
        Files are loaded alphabetically (00_*, 10_*, etc.)
        
        Returns:
            Combined system guidelines content
        """
        if not self.system_dir.exists():
            logger.warning(f"System guidelines directory not found: {self.system_dir}")
            return ""
        
        guideline_files = sorted(self.system_dir.glob("*.md"))
        contents = []
        
        for filepath in guideline_files:
            if filepath.stem.upper() == "README":
                continue
            
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    raw_content = f.read()
                
                frontmatter, content = self._parse_frontmatter(raw_content)
                
                # Check if enabled
                if frontmatter.get('enabled', True) is False:
                    logger.debug(f"Skipping disabled guideline: {filepath.name}")
                    continue
                
                contents.append(content)
                logger.debug(f"Loaded system guideline: {filepath.name}")
                
            except Exception as e:
                logger.error(f"Failed to load system guideline {filepath.name}: {e}")
        
        combined = "\n\n" + "="*80 + "\n\n".join(contents)
        
        logger.info(
            f"Loaded {len(contents)} system guidelines",
            extra={"total_length": len(combined)}
        )
        
        return combined
    
    def get_combined(self, categories: list[str], subdir: str = "categories") -> str:
        """
        Load and combine multiple guidelines
        
        Args:
            categories: List of category names to load
            subdir: Subdirectory to load from ("system" or "categories")
            
        Returns:
            Combined guideline content with separators
        """
        contents = []
        
        for category in categories:
            content = self.load_guideline(category, subdir=subdir)
            if content:
                contents.append(f"# {category.upper()}\n\n{content}")
                logger.debug(f"Added guideline to combined: {category}")
        
        if not contents:
            logger.warning("No guidelines could be loaded")
            return ""
        
        combined = "\n\n" + "="*80 + "\n\n".join(contents)
        
        logger.info(
            f"Combined {len(contents)} guidelines",
            extra={
                "categories": categories,
                "total_length": len(combined)
            }
        )
        
        return combined
    
    def detect_categories_from_ticket(self, ticket: Ticket) -> list[str]:
        """
        Auto-detect relevant guideline categories from ticket categorization
        
        Args:
            ticket: Ticket object with categorization fields
            
        Returns:
            List of category names (always includes "GENERAL")
        """
        categories = ["GENERAL"]  # Always include general guidelines
        
        tier1 = ticket.operational_category_tier1
        tier2 = ticket.operational_category_tier2
        
        logger.debug(
            f"Detecting categories from ticket",
            extra={
                "ticket_id": str(ticket.id),
                "tier1": tier1,
                "tier2": tier2
            }
        )
        
        # Check if tier1 exists in mapping
        if tier1 and tier1 in self.CATEGORY_MAP:
            tier1_map = self.CATEGORY_MAP[tier1]
            
            # Check if tier2 exists in tier1's mapping
            if tier2 and tier2 in tier1_map:
                guideline_category = tier1_map[tier2]
                if guideline_category not in categories:
                    categories.append(guideline_category)
                    logger.debug(f"Added category from tier2: {guideline_category}")
            else:
                # If no tier2 match, try to infer from tier1
                # For example, if tier1 is "Network", add NETWORK guideline
                if tier1 in ["Network", "Network Access"]:
                    if "NETWORK" not in categories:
                        categories.append("NETWORK")
                        logger.debug("Added NETWORK category from tier1")
        
        # Additional heuristics based on summary/keywords
        summary_lower = ticket.summary.lower() if ticket.summary else ""
        
        if "vpn" in summary_lower and "VPN" not in categories:
            categories.append("VPN")
            logger.debug("Added VPN category from summary")
        
        if any(word in summary_lower for word in ["password", "passwort", "kennwort"]) and "PASSWORD_RESET" not in categories:
            categories.append("PASSWORD_RESET")
            logger.debug("Added PASSWORD_RESET category from summary")
        
        if any(word in summary_lower for word in ["network", "netzwerk", "internet", "wifi", "wlan"]) and "NETWORK" not in categories:
            categories.append("NETWORK")
            logger.debug("Added NETWORK category from summary")
        
        logger.info(
            f"Detected categories for ticket",
            extra={
                "ticket_id": str(ticket.id),
                "categories": categories
            }
        )
        
        return categories
    
    def get_guidelines_for_ticket(self, ticket: Ticket) -> str:
        """
        Convenience method: Detect categories and load combined guidelines
        
        Args:
            ticket: Ticket object
            
        Returns: (categories only, no system guidelines)
        """
        categories = self.detect_categories_from_ticket(ticket)
        return self.get_combined(categories, subdir="categories")
    
    def get_full_context(self, ticket: Ticket) -> str:
        """
        Get full guideline context: system guidelines + category-specific guidelines
        
        Args:
            ticket: Ticket object for category detection
            
        Returns:
            Combined system + category guidelines
        """
        # Load system guidelines (always included)
        system_context = self.load_system_guidelines()
        
        # Load category-specific guidelines
        categories = self.detect_categories_from_ticket(ticket)
        category_context = self.get_combined(categories, subdir="categories")
        
        # Combine with clear separation
        full_context = (
            "# SYSTEM GUIDELINES\n\n"
            + system_context
            + "\n\n" + "="*80 + "\n\n"
            + "# CATEGORY-SPECIFIC GUIDELINES\n\n"
            + category_context
        )
        
        logger.info(
            f"Generated full context for ticket",
            extra={
                "ticket_id": str(ticket.id),
                "total_length": len(full_context),
                "categories": categories
            }
        )
        
        return full_contextfrom_ticket(ticket)
        return self.get_combined(categories)


# Singleton instance
_guidelines_loader: Optional[GuidelinesLoader] = None


def get_guidelines_loader() -> GuidelinesLoader:
    """
    Get singleton GuidelinesLoader instance
    
    Returns:
        Shared GuidelinesLoader instance
    """
    global _guidelines_loader
    if _guidelines_loader is None:
        _guidelines_loader = GuidelinesLoader()
    return _guidelines_loader
