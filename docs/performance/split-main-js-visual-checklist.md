# Split Main JS Visual Checklist

Use this checklist after each split step. The goal is to catch visual timing
regressions before comparing only bundle size.

## Hard Loads

- `/`
- `/our-services`
- `/technology`
- `/about-us`
- `/blog`
- `/contact`
- `/join-the-team`
- One article page

For each page, verify that the loader, first hero state, nav theme, scroll
position, and first interactive section match the pre-split behavior.

## Barba Transitions

- Click a `[pt-inner]` link from home to each namespace.
- Click a `[pt-next]` card/link where available.
- Use browser back/forward to exercise the history transition.
- Trigger the default slide-scale transition with a regular Barba link.
- Repeat once with the menu open before navigation.

Expected invariants:

- `.page-info` labels and vertical offsets match the current transition.
- `.mask-overlay` appears before the outgoing page moves.
- Body background returns to `var(--primary)` after transition completion.
- Lenis scroll starts at the intended top position on the destination page.

## Heavy Chunks

- Contact: MapLibre appears, colors remain customized, and the hero map width
  animation still lands at `50.8em` on desktop.
- Services/home: Lottie icons show frame 0 before hover, hover plays, and icons
  reset after a Barba transition.
- Technology/about: workshops, sticky image sections, and navbar grid spread
  behavior remain aligned after resize and after a transition.
- Blog: Finsweet filters and load-more behavior continue to work after a Barba
  navigation into the blog page.
- Article: related article hover/parallax behavior survives a transition.

## Performance Comparisons

- Run `yarn build` and record `dist/main.js` gzip size plus large async chunks.
- Run a mobile throttled trace on `/` and compare LCP, CLS, total JS evaluated,
  and main-thread work before first interaction.
- Confirm `contact-*.js`, `service-icons-*.js`, `map-*.js`, and page-specific
  chunks are not requested on pages without matching namespaces/selectors.
