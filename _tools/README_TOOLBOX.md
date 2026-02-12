# Git Toolbox

Run from project root:
- repo.cmd

It elevates to Administrator and runs:
- _tools/ps/repo.ps1

Menu:
1) Pull: (stash/commit prompt if dirty) -> git pull --rebase -> npm run tools:smoke -> stash pop if used
2) Push: npm run tools:smoke -> optional WIP commit prompt -> git push (auto pull --rebase + retry if rejected)
3) Check: git status -> npm run tools:smoke
0) Exit
