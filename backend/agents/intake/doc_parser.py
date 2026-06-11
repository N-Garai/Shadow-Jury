import re
from typing import Optional
from backend.schemas.models import ProjectBrief


class DocParserAgent:
    async def parse(self, files_content: list[dict], paste_text: Optional[str],
                    github_data: Optional[dict]) -> ProjectBrief:
        all_text = ""
        sources = []

        for f in files_content:
            all_text += f"\n\n--- File: {f['name']} ---\n{f['content']}"
            sources.append(f['name'])

        if paste_text:
            all_text += f"\n\n--- Pasted Text ---\n{paste_text}"
            sources.append("pasted_text")

        if github_data:
            if github_data.get("readme_content"):
                all_text += f"\n\n--- GitHub README ({github_data['repo_name']}) ---\n{github_data['readme_content']}"
                sources.append("github_readme")
            for rf in github_data.get("relevant_files", []):
                all_text += f"\n\n--- GitHub File: {rf['path']} ---\n{rf['content']}"
                sources.append(rf['path'])

        lines = all_text.split("\n")
        title = self._extract_title(lines)
        description = self._extract_description(lines, title)
        claims = self._extract_claims(lines)
        features = self._extract_features(lines)
        goals = self._extract_goals(lines)
        tech_stack = self._extract_tech_stack(lines)
        track_hint = self._detect_track_hint(all_text)

        return ProjectBrief(
            title=title,
            description=description,
            claims=claims,
            features=features,
            goals=goals,
            track_hint=track_hint,
            tech_stack=tech_stack,
            raw_text_chunks=self._chunk_text(all_text),
        )

    def _extract_title(self, lines: list[str]) -> str:
        for line in lines:
            line = line.strip()
            if line.startswith("# ") and len(line) > 2:
                return line[2:].strip()
            if line.startswith("#"):
                return line[1:].strip()
        return "Untitled Project"

    def _extract_description(self, lines: list[str], title: str) -> str:
        desc_lines = []
        found_title = False
        for line in lines:
            stripped = line.strip()
            if title in stripped and not found_title:
                found_title = True
                continue
            if found_title and stripped and not stripped.startswith("#"):
                desc_lines.append(stripped)
                if len(desc_lines) >= 5:
                    break
        return " ".join(desc_lines) if desc_lines else "No description provided."

    def _extract_claims(self, lines: list[str]) -> list[str]:
        claims = []
        patterns = [
            r"(?:Our|The)\s+(project|system|solution|app|agent)\s+(?:is|uses|leverages|provides|enables|supports|delivers)\s+(.+?)[\.\!]",
            r"(?:This|It)\s+(?:is|will|can)\s+(?:the\s+)?(?:first|best|fastest|most|only|unique)\s+(.+?)[\.\!]",
            r"we\s+(?:believe|claim|assert|guarantee)\s+that\s+(.+?)[\.\!]",
        ]
        text = "\n".join(lines)
        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for m in matches:
                claim = m.group(0).strip()
                if claim not in claims:
                    claims.append(claim)
        return claims[:15] or ["No explicit claims detected"]

    def _extract_features(self, lines: list[str]) -> list[str]:
        features = []
        in_list = False
        for line in lines:
            stripped = line.strip()
            if re.match(r"^##?\s+(Features|Capabilities|What It Does)", stripped, re.IGNORECASE):
                in_list = True
                continue
            if in_list and stripped.startswith("#"):
                in_list = False
                continue
            if in_list and (stripped.startswith("- ") or stripped.startswith("* ") or re.match(r"^\d+\.", stripped)):
                features.append(re.sub(r"^[-*\d.\.\s]+", "", stripped).strip())
        return features[:10] or ["No explicit features listed"]

    def _extract_goals(self, lines: list[str]) -> list[str]:
        goals = []
        in_list = False
        for line in lines:
            stripped = line.strip()
            if re.match(r"^##?\s+(Goals|Objectives|Aims|Purpose)", stripped, re.IGNORECASE):
                in_list = True
                continue
            if in_list and stripped.startswith("#"):
                in_list = False
                continue
            if in_list and (stripped.startswith("- ") or stripped.startswith("* ") or re.match(r"^\d+\.", stripped)):
                goals.append(re.sub(r"^[-*\d.\.\s]+", "", stripped).strip())
        return goals[:5] or ["No explicit goals listed"]

    def _extract_tech_stack(self, lines: list[str]) -> list[str]:
        tech_keywords = ["python", "javascript", "typescript", "react", "fastapi", "flask",
                         "django", "node", "docker", "azure", "aws", "gcp", "openai",
                         "langchain", "foundry", "tensorflow", "pytorch", "streamlit",
                         "tailwind", "nextjs", "vercel", "postgres", "redis", "mongodb"]
        text = "\n".join(lines).lower()
        found = []
        for tech in tech_keywords:
            if tech in text:
                found.append(tech.capitalize())
        return found or ["Unknown"]

    def _detect_track_hint(self, text: str) -> str:
        text_lower = text.lower()
        if "reasoning agent" in text_lower or "multi-step" in text_lower or "foundry" in text_lower:
            return "Reasoning Agents"
        if "creative" in text_lower or "generative" in text_lower or "ui" in text_lower:
            return "Creative Apps"
        if "enterprise" in text_lower or "business" in text_lower or "microsoft 365" in text_lower:
            return "Enterprise Agents"
        return "Unknown"

    def _chunk_text(self, text: str) -> list[str]:
        chunks = []
        lines = text.split("\n")
        current_chunk = []
        for line in lines:
            current_chunk.append(line)
            if len(current_chunk) >= 50:
                chunks.append("\n".join(current_chunk))
                current_chunk = []
        if current_chunk:
            chunks.append("\n".join(current_chunk))
        return chunks
