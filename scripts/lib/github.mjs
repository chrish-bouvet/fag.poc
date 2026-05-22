export function getRepoContext() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required.");
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY must be on the form owner/repo.");
  }

  return { owner, repo };
}

export async function githubRequest(apiPath, { method = "GET", body } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required for GitHub API operations.");
  }

  const baseUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const response = await fetch(`${baseUrl}${apiPath}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "fag-bouvet-no",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function listIssues({ state = "all" } = {}) {
  const { owner, repo } = getRepoContext();
  const issues = [];

  for (let page = 1; page < 100; page += 1) {
    const chunk = await githubRequest(
      `/repos/${owner}/${repo}/issues?state=${state}&per_page=100&page=${page}`
    );

    const filtered = chunk.filter((item) => !item.pull_request);
    issues.push(...filtered);

    if (chunk.length < 100) {
      break;
    }
  }

  return issues;
}

export async function replaceIssueLabels(issueNumber, labels) {
  const { owner, repo } = getRepoContext();
  return githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: "PUT",
    body: { labels }
  });
}

export async function updateIssueState(issueNumber, state) {
  const { owner, repo } = getRepoContext();
  return githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: "PATCH",
    body: { state }
  });
}