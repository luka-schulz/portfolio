# My Portfolio

This is my portfolio there are many like it but this is mine. It has been made with love and a reverence for craft. It has been built to last with the belief that good HTML is good design. This is not just a portfolio it is a reflection on slow work, thoughtfulness, and a desire to endure.

## The site

Plain HTML, CSS and a little JavaScript. No build step, no libraries, no
frameworks. Every page works without JavaScript; the script only adds polish.

### Run it locally

```sh
cd ~/Documents/portfolio
python3 -m http.server 8000
```

Then open http://localhost:8000. (Use the server rather than opening `index.html`
directly: links go to folders like `writing/`, which only a server turns into pages.)
To test on your phone: same Wi-Fi, open `http://<your-mac's-IP>:8000`.

### Structure

Every page is a folder with an `index.html`, so addresses read
`lukaschulz.com/work/torre-glories/`. Each page keeps its own images next to it.

```
index.html                      Work: intro + masonry grid of projects
work/<project>/                 One folder per project: index.html (case study) + its images
  cover.jpg, cover-800.jpg      The project's tile on the home page
work/torre-glories/index.html   The case study template — duplicate the folder for a new project
writing/index.html              Writing: title, intro and the essay list
writing/<post>/index.html       Blog posts (making-sense/ is the template) + their images
photography/index.html          Photo grid + the photos (click a photo for the viewer)
404.html                        Not found / "coming soon"
archive/                        Every earlier version of the site (see below)
_drafts/                        Tools and drafts, not linked from the site: styleguide,
                                unlinked Writing layouts (A, C), arrow lab, tune panel

css/
  tokens.css      Type scale, spacing, colours, radii, theme values  ← edit here first
  base.css        Reset + default element styles
  layout.css      .container, .page--reading, .section, .grid, .split, .measure
  components.css  Everything else (header, mosaic, masonry, case study modules,
                  articles, footer, glass, toast, back to top, photo viewer, reveal)
js/main.js        Settings at the top (theme-switch jokes, pop and arrow motion), then behaviour
assets/           Site-wide files (favicon)
```

Links between pages are always relative (no leading `/`), so the site works
from any folder — the GitHub Pages preview, a custom domain, or the archive.

### How the system works

**Rems everywhere.** 1rem = the visitor's browser font size (16px by default).
The root size is never overridden, so zoom and accessibility settings scale the
whole site. Media queries use `em` (more reliable with zoom):
48em ≈ 768px (tablet), 64em ≈ 1024px (laptop), 150em ≈ 2400px (very wide).

**Fluid type.** Each step in `tokens.css` uses `clamp(min, rem + vw, max)`, so
text grows smoothly from phone to desktop. Nine roles cover every piece of text
(see `_drafts/styleguide.html`):

| Token / class                       | Use                                  |
|-------------------------------------|--------------------------------------|
| `--step-6`  `.type-mast`            | Page mastheads ("Writing")           |
| `--step-5`  `.type-display`         | Display                              |
| `--step-4`  `.type-title`           | Case study / article titles          |
| `--step-3`  `.type-heading`         | Pull quotes, big statements          |
| `--step-2`  `.type-subheading`      | Article section headings             |
| `--step-1`  `.type-lede`            | Ledes, opening paragraphs            |
| `--step-0`  `.type-body`            | Body text                            |
| `--step--1` `.type-small`           | Captions, intros, metadata           |
| `--step--2` `.type-micro`           | Badges, code                         |

**Light and dark.** Colours are tokens; `[data-theme]` on `<html>` (set by the
switch, remembered in localStorage) or the OS setting picks the set.

**Glass.** Floating controls (e-mail toast, back to top, photo viewer buttons)
share one look; add `class="glass"` to use it elsewhere.

### Adding things

**A project:** duplicate `work/torre-glories/`, rename the folder (that's the
address), and swap in its images. On the home page, point the tile's link at
`work/<project>/` and its image at `work/<project>/cover.jpg`.

**A project tile (home):** copy an `<li>` in the masonry list. Add
`data-span="2"` to make it two columns wide. Keep the image's `width`/`height`
(prevents layout jumps) and write real `alt` text. Images wider than ~1000px
should also get an 800px copy named `name-800.jpg` and a `srcset` like the
existing wide tiles, so the grid loads the small file and the viewer the big one.

**A photo:** put it in `photography/` and copy an `<li>` in
`photography/index.html` (same rules as above). Photos open in the viewer
automatically.

**A blog post:** duplicate `writing/making-sense/`, rename the folder, then add
a row to the list in `writing/index.html`. Images inside the article open in
the viewer.

**The photo viewer** works on anything inside an element with `data-lightbox`
(the photo grid, case studies, articles). Images that are links are skipped.

**Fade-in on scroll:** `data-reveal` on an element, or `data-reveal-children`
on a list to stagger its items. Hairlines listed in the "Hairlines" part of
`components.css` fade in with them.

### Still to do

- Real images and `alt` text (all current images are placeholders)
- Friends / Spirit Animal links in the footer
- Project pages for the tiles that point to `404.html`
- Remove `_drafts/tune.js` and its `<script>` line on each page when tuning is done
- E-mail address (`hello@example.com` placeholder)

## The archive

Every version of my portfolio in one place. Each version lives in its own
folder under `archive/` and works exactly as it did when it was live
(`/archive/` lists them all):

| Folder | Years | Came from |
|---|---|---|
| `archive/v1/` | 2016–17 | `luka-schulz/portfolio-archive` (`01/`, earlier `2017/` and the top level) |
| `archive/v2/` | 2017–19 | `luka-schulz/portfolio-archive` (top level) |
| `archive/v3/` | 2018 | `luka-schulz/lukaschulz.com` |
| `archive/v4/` | 2019 | lukaschulz.com, saved from the live site (Nov 2026) |
| `archive/v5/` | 2021–26 | lookaluka.com, saved from the live site (Nov 2026) |

v4 and v5 had no repository, so they start from a download of the live
sites; everything else is untouched. The full commit history of both old
repositories is kept here: `git log --follow -- archive/v1/index.html`
goes back to December 2016. The only later changes are making links point
inside each version's own folder, restoring v3's fonts, and removing Google
Analytics and the résumé.

### Retiring a version

When a new portfolio replaces the current one:

1. Copy the current site into the next folder (`archive/v6/`, `archive/v7/` …). Keep its links
   relative (no leading `/`) so it works from the folder.
2. Commit, and tag it: `git tag -a v6 -m "v6 as it was last published"`.
3. Add it to the list in `archive/index.html`.
4. Build the new site.

`robots.txt` keeps search engines out of `archive/` and `_drafts/`, so searches find
the current site.
