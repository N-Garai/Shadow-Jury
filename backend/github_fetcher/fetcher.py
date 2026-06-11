import os
import httpx
from typing import Optional


class GitHubFetcher:
    GITHUB_API = "https://api.github.com"
    MAX_FILE_FETCHES = 5  # limit file fetches to stay under rate limit

    def _headers(self) -> dict:
        headers = {"Accept": "application/vnd.github.raw+json"}
        token = os.environ.get("GITHUB_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def fetch_repo(self, url: str) -> Optional[dict]:
        parts = url.rstrip("/").split("/")
        if len(parts) < 2:
            return None
        owner, repo = parts[-2], parts[-1]

        async with httpx.AsyncClient() as client:
            repo_resp = await client.get(
                f"{self.GITHUB_API}/repos/{owner}/{repo}",
                headers=self._headers(),
            )
            if repo_resp.status_code != 200:
                return None
            repo_data = repo_resp.json()
            default_branch = repo_data.get("default_branch", "main")

            readme_resp = await client.get(
                f"{self.GITHUB_API}/repos/{owner}/{repo}/readme",
                headers=self._headers(),
            )
            readme_content = readme_resp.text if readme_resp.status_code == 200 else None

            tree_resp = await client.get(
                f"{self.GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
            )
            tree_data = tree_resp.json() if tree_resp.status_code == 200 else {"tree": []}

            relevant_files = []
            fetched = 0
            for item in tree_data.get("tree", []):
                if fetched >= self.MAX_FILE_FETCHES:
                    break
                if item["type"] != "blob":
                    continue
                if not item["path"].endswith((".md", ".py", ".ts", ".js", ".json", ".yaml", ".toml", ".txt")):
                    continue
                if item["path"].lower() == "readme.md" or item["path"].lower() == "readme":
                    continue
                file_resp = await client.get(
                    f"{self.GITHUB_API}/repos/{owner}/{repo}/contents/{item['path']}",
                    headers=self._headers(),
                )
                if file_resp.status_code == 200:
                    relevant_files.append({
                        "path": item["path"],
                        "content": file_resp.text[:5000],
                    })
                    fetched += 1

            return {
                "repo_name": f"{owner}/{repo}",
                "default_branch": default_branch,
                "description": repo_data.get("description", ""),
                "topics": repo_data.get("topics", []),
                "readme_content": readme_content,
                "relevant_files": relevant_files,
                "file_count": len(tree_data.get("tree", [])),
            }

    async def fetch_readme_only(self, url: str) -> Optional[str]:
        parts = url.rstrip("/").split("/")
        if len(parts) < 2:
            return None
        owner, repo = parts[-2], parts[-1]

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.GITHUB_API}/repos/{owner}/{repo}/readme",
                headers=self._headers(),
            )
            return resp.text if resp.status_code == 200 else None
