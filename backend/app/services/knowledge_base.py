import yaml
import json
from typing import Optional, Dict, Any
from pathlib import Path


class KnowledgeBase:
    """Knowledge base for term definitions and lookups."""

    def __init__(self, data: Optional[Dict[str, Any]] = None):
        self._terms: Dict[str, Dict[str, Any]] = {}
        self._aliases: Dict[str, str] = {}  # alias -> canonical term

        if data:
            self._load(data)

    def _load(self, data: Dict[str, Any]) -> None:
        """Load terms from data dictionary."""
        terms = data.get("terms", [])

        # Handle both list and dict formats
        if isinstance(terms, list):
            # List format: [{"term": "ETL", "definition": "...", "aliases": [...]}]
            for term_data in terms:
                term_key = term_data.get("term", "")
                if not term_key:
                    continue

                # Store canonical term
                self._terms[term_key.lower()] = term_data

                # Build alias mapping
                aliases = term_data.get("aliases", [])
                for alias in aliases:
                    self._aliases[alias.lower()] = term_key.lower()
        else:
            # Dict format: {"ETL": {"definition": "...", "aliases": [...]}}
            for term_key, term_data in terms.items():
                # Store canonical term
                self._terms[term_key.lower()] = term_data

                # Build alias mapping
                aliases = term_data.get("aliases", [])
                for alias in aliases:
                    self._aliases[alias.lower()] = term_key.lower()

    def lookup(self, query: str) -> Optional[Dict[str, Any]]:
        """Look up a term and return its definition."""
        query_lower = query.lower().strip()

        # Check direct match
        if query_lower in self._terms:
            return self._format_result(query_lower)

        # Check aliases
        if query_lower in self._aliases:
            canonical = self._aliases[query_lower]
            return self._format_result(canonical)

        # Partial match (if term appears in query)
        for term in self._terms:
            if term in query_lower or query_lower in term:
                return self._format_result(term)

        # Check if any alias partially matches
        for alias, canonical in self._aliases.items():
            if alias in query_lower or query_lower in alias:
                return self._format_result(canonical)

        return None

    def _format_result(self, term: str) -> Dict[str, Any]:
        """Format lookup result."""
        data = self._terms[term]
        return {
            "term": term,
            "definition": data.get("definition", ""),
            "why": data.get("why"),
            "example": data.get("example"),
        }

    def get_terms_list(self) -> list:
        """Get list of all terms for LLM context."""
        return list(self._terms.keys())

    @classmethod
    def from_file_content(cls, file_content: bytes, filename: str) -> "KnowledgeBase":
        """Create KnowledgeBase from file content."""
        ext = Path(filename).suffix.lower()

        try:
            if ext in [".yaml", ".yml"]:
                data = yaml.safe_load(file_content.decode("utf-8"))
            elif ext == ".json":
                data = json.loads(file_content.decode("utf-8"))
            else:
                raise ValueError(f"Unsupported KB format: {ext}")
        except Exception as e:
            raise ValueError(f"Failed to parse KB file: {e}")

        return cls(data)

    def to_dict(self) -> Dict[str, Any]:
        """Export KB data for persistence."""
        return {"terms": self._terms}
