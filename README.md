# My Portfolio

This is my portfolio there are many like it but this is mine. It has been made with love and a reverence for craft. It has been built to last with the belief that good HTML is good design. This is not just a portfolio it is a reflection on slow work, thoughtfulness, and a desire to endure.

## The archive

Every version of my portfolio in one place. Each version lives in its own
folder and works exactly as it did when it was live:

| Folder | Years | Came from |
|---|---|---|
| `v1/` | 2016–17 | `luka-schulz/portfolio-archive` (`01/`, earlier `2017/` and the top level) |
| `v2/` | 2017–19 | `luka-schulz/portfolio-archive` (top level) |
| `v3/` | 2018 | `luka-schulz/lukaschulz.com` |
| `v4/` | 2019 | the live lukaschulz.com (to be added) |
| `v5/` | 2021– | lookaluka.com (to be added) |

The full commit history of both old repositories is kept here: `git log -- v1`
goes back to December 2016. The tags `v1-original`, `v2-original` and
`v3-original` mark each version exactly as it was before it moved in; the only
later change is making links point inside each version's own folder.

## Retiring a version

When a new portfolio replaces the current one:

1. Copy the current site into the next folder (`v6/`, `v7/` …). Keep its links
   relative (no leading `/`) so it works from the folder.
2. Commit, and tag it: `git tag -a v6 -m "v6 as it was last published"`.
3. Add it to the list in `index.html`.
4. Build the new site.

`robots.txt` keeps search engines out of the old versions, so searches find
the current site.
