# Accessing a prior version of this project

This repository (`GSMPRO-CL/mission-control-dashboard`) is the current home of the Mission Control dashboard. If you need the **older codebase or layout**, use one of the approaches below.

---

## Option A — Separate legacy repository on GitHub (clone the old repo)

Some teams keep the superseded project in **another** GitHub repository (different name or organization). If your administrator pointed you to that legacy repo:

1. Sign in to [GitHub](https://github.com/) with an account that has permission to that repository.
2. Open the **legacy repository** in your browser (use the URL your team shared).
3. Click the green **Code** button near the top of the repository page.
4. Copy the clone URL:
   - **HTTPS:** `https://github.com/OWNER/OLD-REPO-NAME.git`
   - **SSH** (if you use SSH keys): `git@github.com:OWNER/OLD-REPO-NAME.git`
5. On your machine, open a terminal and move to a folder **outside** your current clone (for example `~/src` or `~/Projects`).
6. Clone the legacy repository:
   ```bash
   git clone <paste-the-URL-from-step-4>
   cd OLD-REPO-NAME
   ```
7. (Optional) List branches and tags, then check out the exact version you need:
   ```bash
   git branch -a
   git tag
   git checkout <branch-name-or-tag-name>
   ```
8. Install dependencies and run the project **according to the README in that legacy repository** (paths and scripts may differ from this repo).

If nobody has given you a legacy URL, ask an owner of the GitHub organization or check your internal wiki for “dashboard archive” or “legacy repo.”

---

## Option B — Same GitHub repository, older snapshot (checkout a commit)

If there is **no** separate old repo and you only need an earlier state of **this** repository:

1. Open the commit history in GitHub, for example:
   - [Commits on `main`](https://github.com/GSMPRO-CL/mission-control-dashboard/commits/main)
   - Or switch to another branch from the branch dropdown, then open **Commits**.
2. Browse the list until you find the commit message or date that matches the version you want.
3. Click that commit to open its detail page. Copy the **full commit SHA** (for example `a1b2c3d4e5f6…`).
4. Clone this repository into a **new folder** so you do not overwrite your current work:
   ```bash
   cd ~/Projects
   git clone https://github.com/GSMPRO-CL/mission-control-dashboard.git mission-control-dashboard-prior
   cd mission-control-dashboard-prior
   ```
5. Check out that exact snapshot:
   ```bash
   git checkout <paste-commit-SHA-here>
   ```
6. Git will usually report **detached HEAD**. That is normal for read-only inspection or one-off builds.
7. If you need to make new commits from that old base, create a branch first:
   ```bash
   git checkout -b work-from-prior-<short-sha>
   ```
8. Follow the README (or deployment notes) **as they existed at that commit** to install dependencies and run the app.

---

## Option C — Download a ZIP for a specific commit (no Git history needed)

1. On GitHub, open the repository **Commits** page and select the commit you need.
2. On the commit page, open the **browse files** view for that commit (GitHub shows the tree at that revision).
3. Use GitHub’s **Download ZIP** flow for that revision if available from the UI, or continue using Option B with `git checkout` for a reliable reproducible tree.

---

## Quick reference — current canonical clone URL

```bash
git clone https://github.com/GSMPRO-CL/mission-control-dashboard.git
```

For SSH:

```bash
git clone git@github.com:GSMPRO-CL/mission-control-dashboard.git
```

Replace `OWNER/REPO` in Option A with whatever URL your team provides for the **previous** repository.
